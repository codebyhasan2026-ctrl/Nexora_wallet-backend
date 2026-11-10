const Deposit = require("../models/deposit");
const User = require("../models/user");
const SiteSetting = require("../models/siteSetting");
const { uploadToCloudinary } = require("../middleware/upload");

exports.createDeposit = async (req, res) => {
  try {
    const userId = req.user._id;
    const { gateway, amount, senderNumber, trxId } = req.body;

    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid deposit amount",
      });
    }

    const settings = await SiteSetting.findOne();
    const minDeposit = settings?.minDeposit ?? 200;
    const maxDeposit = settings?.maxDeposit ?? 50000;

    if (parsedAmount < minDeposit) {
      return res.status(400).json({
        success: false,
        message: `Minimum deposit amount is ${minDeposit} BDT`,
      });
    }

    if (parsedAmount > maxDeposit) {
      return res.status(400).json({
        success: false,
        message: `Maximum deposit amount is ${maxDeposit} BDT`,
      });
    }

    if (!senderNumber || !senderNumber.trim()) {
      return res.status(400).json({
        success: false,
        message: "Sender phone number is required",
      });
    }

    if (!trxId || !trxId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID (TrxID) is required",
      });
    }

    const cleanTrxId = trxId.trim();
    const existing = await Deposit.findOne({
      trxId: cleanTrxId,
      status: { $in: ["pending", "approved"] },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "This Transaction ID has already been submitted",
      });
    }

    let screenshotUrl = "";
    if (req.file) {
      try {
        screenshotUrl = await uploadToCloudinary(req.file.buffer);
      } catch (uploadErr) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload payment screenshot proof",
        });
      }
    }

    const newDeposit = await Deposit.create({
      user: userId,
      gateway: (gateway || "bkash").toLowerCase().trim(),
      amount: parsedAmount,
      senderNumber: senderNumber.trim(),
      trxId: cleanTrxId,
      screenshot: screenshotUrl,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Deposit request submitted successfully! Pending admin approval.",
      deposit: newDeposit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to submit deposit request",
    });
  }
};

exports.getUserDeposits = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [deposits, total] = await Promise.all([
      Deposit.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Deposit.countDocuments({ user: userId }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return res.status(200).json({
      success: true,
      deposits,
      page,
      limit,
      total,
      totalPages,
      hasMore,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch deposit history",
    });
  }
};

exports.getAllDepositsAdmin = async (req, res) => {
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
      query.$or = [
        { trxId: { $regex: term, $options: "i" } },
        { senderNumber: { $regex: term, $options: "i" } },
        { gateway: { $regex: term, $options: "i" } },
      ];
    }

    const [deposits, totalFiltered, totalPending, totalApproved, totalRejected, totalVolumeData] = await Promise.all([
      Deposit.find(query)
        .populate("user", "name email phone balance totalDeposit plan profileImage")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Deposit.countDocuments(query),
      Deposit.countDocuments({ status: "pending" }),
      Deposit.countDocuments({ status: "approved" }),
      Deposit.countDocuments({ status: "rejected" }),
      Deposit.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const totalVolume = totalVolumeData[0]?.total || 0;
    const totalPages = Math.ceil(totalFiltered / limit);
    const hasMore = page < totalPages;

    return res.status(200).json({
      success: true,
      deposits,
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
        totalVolume,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch deposits",
    });
  }
};

exports.getDepositByIdAdmin = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id)
      .populate("user", "name email phone balance totalDeposit plan profileImage")
      .lean();

    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: "Deposit record not found",
      });
    }

    return res.status(200).json({
      success: true,
      deposit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch deposit details",
    });
  }
};

exports.approveDepositAdmin = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: "Deposit record not found",
      });
    }

    if (deposit.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This deposit request is already ${deposit.status}`,
      });
    }

    const user = await User.findById(deposit.user);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Associated user not found",
      });
    }

    user.balance = Number(user.balance || 0) + Number(deposit.amount);
    user.totalDeposit = Number(user.totalDeposit || 0) + Number(deposit.amount);
    await user.save();

    deposit.status = "approved";
    deposit.adminNote = req.body?.adminNote?.trim() || "Approved by Admin. Balance credited.";
    deposit.reviewedAt = new Date();
    await deposit.save();

    return res.status(200).json({
      success: true,
      message: `Deposit of ${deposit.amount} BDT approved! User account balance updated.`,
      deposit,
      newBalance: user.balance,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to approve deposit",
    });
  }
};

exports.rejectDepositAdmin = async (req, res) => {
  try {
    const deposit = await Deposit.findById(req.params.id);
    if (!deposit) {
      return res.status(404).json({
        success: false,
        message: "Deposit record not found",
      });
    }

    if (deposit.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `This deposit request is already ${deposit.status}`,
      });
    }

    deposit.status = "rejected";
    deposit.adminNote = req.body?.adminNote?.trim() || "Payment verification failed or invalid TrxID";
    deposit.reviewedAt = new Date();
    await deposit.save();

    return res.status(200).json({
      success: true,
      message: "Deposit request rejected",
      deposit,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to reject deposit",
    });
  }
};

