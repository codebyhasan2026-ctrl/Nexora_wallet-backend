const Withdraw = require("../models/withdraw");
const User = require("../models/user");
const SiteSetting = require("../models/siteSetting");

exports.createWithdraw = async (req, res) => {
  try {
    const userId = req.user._id;
    const { method, accountNumber, accountType, amount, amountUSD } = req.body;

    let withdrawAmountUSDT = 0;
    let withdrawAmountBDT = 0;

    if (amountUSD !== undefined && amountUSD !== null && Number(amountUSD) > 0) {
      withdrawAmountUSDT = Number(Number(amountUSD).toFixed(2));
      withdrawAmountBDT = Number((withdrawAmountUSDT * 125).toFixed(2));
    } else if (amount !== undefined && amount !== null && Number(amount) > 0) {
      const rawNum = Number(amount);
      if (rawNum <= 1000) {
        withdrawAmountUSDT = Number(rawNum.toFixed(2));
        withdrawAmountBDT = Number((withdrawAmountUSDT * 125).toFixed(2));
      } else {
        withdrawAmountBDT = Number(rawNum.toFixed(2));
        withdrawAmountUSDT = Number((withdrawAmountBDT / 125).toFixed(2));
      }
    }

    if (!withdrawAmountUSDT || isNaN(withdrawAmountUSDT) || withdrawAmountUSDT <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid withdrawal amount in USD ($)",
      });
    }

    if (!accountNumber || accountNumber.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid account number or wallet address",
      });
    }

    const settings = await SiteSetting.findOne().lean();
    const rawMin = Number(settings?.minWithdraw) || 300;
    const rawMax = Number(settings?.maxWithdraw) || 50000;
    const feePercent = Number(settings?.withdrawFeePercent) || 0;

    const minWithdrawUSD = rawMin >= 100 ? Number((rawMin / 125).toFixed(2)) : rawMin;
    const maxWithdrawUSD = rawMax >= 100 ? Number((rawMax / 125).toFixed(2)) : rawMax;

    if (withdrawAmountUSDT < minWithdrawUSD) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is $${minWithdrawUSD}`,
      });
    }

    if (withdrawAmountUSDT > maxWithdrawUSD) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal amount is $${maxWithdrawUSD}`,
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: "Your account is suspended. Contact support.",
      });
    }

    if (Number(user.balance) < withdrawAmountUSDT) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance for this withdrawal",
      });
    }

    const feeUSDT = Number(((withdrawAmountUSDT * feePercent) / 100).toFixed(2));
    const finalAmountUSDT = Number((withdrawAmountUSDT - feeUSDT).toFixed(2));
    const feeBDT = Number(((withdrawAmountBDT * feePercent) / 100).toFixed(2));
    const finalAmountBDT = Number((withdrawAmountBDT - feeBDT).toFixed(2));

    user.balance = Number((user.balance - withdrawAmountUSDT).toFixed(4));
    await user.save();

    const withdrawal = await Withdraw.create({
      user: userId,
      method: (method || "bkash").toLowerCase(),
      accountNumber: accountNumber.trim(),
      accountType: accountType || "Personal",
      amount: withdrawAmountBDT,
      amountUSDT: withdrawAmountUSDT,
      fee: feeBDT,
      finalAmount: finalAmountBDT,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Withdrawal request submitted successfully",
      withdrawal,
      remainingBalance: user.balance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit withdrawal request",
    });
  }
};

exports.getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
      Withdraw.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Withdraw.countDocuments({ user: userId }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return res.status(200).json({
      success: true,
      withdrawals,
      page,
      limit,
      total,
      totalPages,
      hasMore,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal history",
    });
  }
};

exports.getAllWithdrawalsAdmin = async (req, res) => {
  try {
    const { status, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = {};
    if (status && status !== "all") {
      query.status = status.toLowerCase();
    }

    if (search && search.trim()) {
      const term = search.trim();
      const matchedUsers = await User.find({
        $or: [
          { name: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
          { phone: { $regex: term, $options: "i" } },
        ],
      }).select("_id").lean();
      const userIds = matchedUsers.map((u) => u._id);

      query.$or = [
        { accountNumber: { $regex: term, $options: "i" } },
        { trxId: { $regex: term, $options: "i" } },
        { user: { $in: userIds } },
      ];
    }

    const [withdrawals, totalFiltered, totalPending, totalApproved, totalRejected, totalVolumeData] = await Promise.all([
      Withdraw.find(query)
        .populate("user", "name email phone balance plan profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Withdraw.countDocuments(query),
      Withdraw.countDocuments({ status: "pending" }),
      Withdraw.countDocuments({ status: "approved" }),
      Withdraw.countDocuments({ status: "rejected" }),
      Withdraw.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, totalBDT: { $sum: "$finalAmount" }, totalUSDT: { $sum: "$amountUSDT" } } },
      ]),
    ]);

    const totalVolumeBDT = totalVolumeData[0]?.totalBDT || 0;
    const totalVolumeUSDT = totalVolumeData[0]?.totalUSDT || 0;
    const totalPages = Math.ceil(totalFiltered / limit);
    const hasMore = page < totalPages;

    return res.status(200).json({
      success: true,
      withdrawals,
      page,
      limit,
      total: totalFiltered,
      totalPages,
      hasMore,
      stats: {
        total: totalFiltered,
        totalPending,
        totalApproved,
        totalRejected,
        totalVolumeBDT,
        totalVolumeUSDT,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawals",
    });
  }
};

exports.getWithdrawalByIdAdmin = async (req, res) => {
  try {
    const withdrawal = await Withdraw.findById(req.params.id)
      .populate("user", "name email phone balance totalWithdraw plan profileImage")
      .lean();

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal record not found",
      });
    }

    return res.status(200).json({
      success: true,
      withdrawal,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch withdrawal details",
    });
  }
};

exports.approveWithdrawalAdmin = async (req, res) => {
  try {
    const { trxId, adminNote } = req.body;
    const withdrawal = await Withdraw.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal record not found",
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This withdrawal is already ${withdrawal.status}`,
      });
    }

    withdrawal.status = "approved";
    withdrawal.trxId = trxId ? trxId.trim() : "";
    withdrawal.adminNote = adminNote ? adminNote.trim() : "";
    withdrawal.reviewedAt = new Date();
    withdrawal.reviewedBy = req.user._id;
    await withdrawal.save();

    await User.findByIdAndUpdate(withdrawal.user, {
      $inc: { totalWithdraw: withdrawal.amountUSDT },
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal approved successfully",
      withdrawal,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to approve withdrawal",
    });
  }
};

exports.rejectWithdrawalAdmin = async (req, res) => {
  try {
    const { adminNote } = req.body;
    const withdrawal = await Withdraw.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal record not found",
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This withdrawal is already ${withdrawal.status}`,
      });
    }

    withdrawal.status = "rejected";
    withdrawal.adminNote = adminNote ? adminNote.trim() : "Declined by admin";
    withdrawal.reviewedAt = new Date();
    withdrawal.reviewedBy = req.user._id;
    await withdrawal.save();

    await User.findByIdAndUpdate(withdrawal.user, {
      $inc: { balance: withdrawal.amountUSDT },
    });

    return res.status(200).json({
      success: true,
      message: "Withdrawal rejected and balance refunded to user",
      withdrawal,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reject withdrawal",
    });
  }
};

