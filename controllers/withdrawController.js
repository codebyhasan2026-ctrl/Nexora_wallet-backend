const Withdraw = require("../models/withdraw");
const User = require("../models/user");
const SiteSetting = require("../models/siteSetting");

exports.createWithdraw = async (req, res) => {
  try {
    const userId = req.user._id;
    const { method, accountNumber, accountType, amount, amountBDT, amountUSD } = req.body;

    const withdrawAmount = Number(amount ?? amountBDT ?? amountUSD);
    if (!withdrawAmount || isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid withdrawal amount",
      });
    }

    if (!accountNumber || accountNumber.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid account number or wallet address",
      });
    }

    const settings = await SiteSetting.findOne().lean();
    const minWithdraw = Number(settings?.minWithdraw) || 300;
    const maxWithdraw = Number(settings?.maxWithdraw) || 50000;
    const feePercent = Number(settings?.withdrawFeePercent) || 0;

    if (withdrawAmount < minWithdraw) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal amount is ${minWithdraw} BDT`,
      });
    }

    if (withdrawAmount > maxWithdraw) {
      return res.status(400).json({
        success: false,
        message: `Maximum withdrawal amount is ${maxWithdraw} BDT`,
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

    if (Number(user.balance) < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance for this withdrawal",
      });
    }

    const feeBDT = Number(((withdrawAmount * feePercent) / 100).toFixed(2));
    const finalAmountBDT = Number((withdrawAmount - feeBDT).toFixed(2));
    const amountUSDT = Number((withdrawAmount / 125).toFixed(2));

    user.balance = Number((user.balance - withdrawAmount).toFixed(2));
    await user.save();

    const withdrawal = await Withdraw.create({
      user: userId,
      method: (method || "bkash").toLowerCase(),
      accountNumber: accountNumber.trim(),
      accountType: accountType || "Personal",
      amount: withdrawAmount,
      amountUSDT,
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
    withdrawal.reviewedBy = req.admin?.id || req.user?._id;
    await withdrawal.save();

    const withdrawAmt = Number(withdrawal.amount || withdrawal.amountUSDT || 0);
    await User.findByIdAndUpdate(withdrawal.user, {
      $inc: { totalWithdraw: withdrawAmt },
    });

    try {
      const Notification = require("../models/notification");
      await Notification.create({
        user: withdrawal.user,
        title: "Withdrawal Approved & Paid",
        message: `Your withdrawal request of ৳${withdrawAmt.toFixed(2)} has been approved and sent to your destination account.`,
        type: "withdraw",
        amount: withdrawAmt,
      });
    } catch (e) {}

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
    withdrawal.reviewedBy = req.admin?.id || req.user?._id;
    await withdrawal.save();

    const refundAmt = Number(withdrawal.amount || withdrawal.amountUSDT || 0);
    await User.findByIdAndUpdate(withdrawal.user, {
      $inc: { balance: refundAmt },
    });

    try {
      const Notification = require("../models/notification");
      await Notification.create({
        user: withdrawal.user,
        title: "Withdrawal Rejected & Refunded",
        message: `Your withdrawal request of ৳${refundAmt.toFixed(2)} was rejected (${withdrawal.adminNote}) and refunded to your wallet balance.`,
        type: "withdraw",
        amount: refundAmt,
      });
    } catch (e) {}

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

