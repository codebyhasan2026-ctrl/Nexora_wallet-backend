const mongoose = require("mongoose");
const User = require("../models/user");
const Deposit = require("../models/deposit");
const Withdraw = require("../models/withdraw");
const Commission = require("../models/commission");
const PromoCode = require("../models/promoCode");
const TaskCompletion = require("../models/taskCompletion");

exports.getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const search = (req.query.search || "").trim();
    const status = (req.query.status || "all").toLowerCase();

    const conditions = [];

    if (search) {
      const orConditions = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { referralCode: { $regex: search, $options: "i" } },
        { referredBy: { $regex: search, $options: "i" } },
      ];
      if (mongoose.Types.ObjectId.isValid(search)) {
        orConditions.push({ _id: search });
      }
      conditions.push({ $or: orConditions });
    }

    if (status === "active") {
      conditions.push({ isSuspended: false });
    } else if (status === "suspended") {
      conditions.push({ isSuspended: true });
    } else if (status === "vip") {
      conditions.push({ plan: { $nin: [null, "", "No Plan", "Free"] } });
    } else if (status === "deposited") {
      conditions.push({ totalDeposit: { $gt: 0 } });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};
    const skip = (page - 1) * limit;

    const [
      users,
      totalUsers,
      totalAllUsers,
      totalActive,
      totalSuspended,
      totalVip,
      totalDepositedUsers,
      balanceAgg,
    ] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
      User.countDocuments(),
      User.countDocuments({ isSuspended: false }),
      User.countDocuments({ isSuspended: true }),
      User.countDocuments({ plan: { $nin: [null, "", "No Plan", "Free"] } }),
      User.countDocuments({ totalDeposit: { $gt: 0 } }),
      User.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]),
    ]);

    const totalPages = Math.max(Math.ceil(totalUsers / limit), 1);

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      page,
      limit,
      totalUsers,
      totalPages,
      hasMore: page < totalPages,
      users,
      stats: {
        totalAllUsers,
        totalActive,
        totalSuspended,
        totalVip,
        totalDepositedUsers,
        totalUsersBalance: Number((balanceAgg[0]?.total || 0).toFixed(2)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch users",
    });
  }
};

exports.getSingleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const refIdentifiers = [
      user.referralCode,
      user._id.toString(),
      user.name,
      user.phone,
      user.email,
    ].filter(Boolean);

    const uplineKey = user.referredBy ? user.referredBy.trim() : "";
    const uplineQuery = uplineKey
      ? {
          $or: [
            { referralCode: uplineKey },
            { name: uplineKey },
            { phone: uplineKey },
            { email: uplineKey },
            ...(mongoose.Types.ObjectId.isValid(uplineKey) ? [{ _id: uplineKey }] : []),
          ],
        }
      : null;

    const [
      deposits,
      withdrawals,
      commissions,
      referrals,
      referredByUser,
      promoDocs,
      tasks,
      depositCount,
      approvedDepositAgg,
      withdrawCount,
      approvedWithdrawAgg,
      commissionAgg,
      taskStatsAgg,
    ] = await Promise.all([
      Deposit.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      Withdraw.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean(),
      Commission.find({ recipient: user._id })
        .populate("fromUser", "name phone email plan")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      User.find({
        referredBy: { $in: refIdentifiers },
        _id: { $ne: user._id },
      })
        .select("name email phone plan totalDeposit balance isSuspended createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      uplineQuery
        ? User.findOne(uplineQuery).select("name email phone referralCode").lean()
        : Promise.resolve(null),
      PromoCode.find({ "redeemedUsers.user": user._id })
        .select("code rewardAmount redeemedUsers")
        .lean(),
      TaskCompletion.find({ user: user._id })
        .populate("task", "title sponsor reward")
        .sort({ completedAt: -1 })
        .limit(50)
        .lean(),
      Deposit.countDocuments({ user: user._id }),
      Deposit.aggregate([
        { $match: { user: user._id, status: "approved" } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
      ]),
      Withdraw.countDocuments({ user: user._id }),
      Withdraw.aggregate([
        { $match: { user: user._id, status: "approved" } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amountUSDT" } } },
      ]),
      Commission.aggregate([
        { $match: { recipient: user._id } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$amount" } } },
      ]),
      TaskCompletion.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$reward" } } },
      ]),
    ]);

    const promoHistory = [];
    promoDocs.forEach((doc) => {
      (doc.redeemedUsers || []).forEach((entry) => {
        if (entry.user?.toString() === user._id.toString()) {
          promoHistory.push({
            id: entry._id || doc._id,
            code: doc.code,
            amount: Number(entry.amount || doc.rewardAmount || 0),
            redeemedAt: entry.redeemedAt,
          });
        }
      });
    });
    promoHistory.sort((a, b) => new Date(b.redeemedAt) - new Date(a.redeemedAt));

    const totalPromoEarned = promoHistory.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const depositedReferralCount = referrals.filter((r) => Number(r.totalDeposit || 0) > 0).length;

    return res.status(200).json({
      success: true,
      user,
      summary: {
        depositCount,
        approvedDepositCount: approvedDepositAgg[0]?.count || 0,
        totalDepositAmount: Number((approvedDepositAgg[0]?.total || user.totalDeposit || 0).toFixed(2)),
        withdrawCount,
        approvedWithdrawCount: approvedWithdrawAgg[0]?.count || 0,
        totalWithdrawAmount: Number((approvedWithdrawAgg[0]?.total || user.totalWithdraw || 0).toFixed(2)),
        commissionCount: commissionAgg[0]?.count || 0,
        totalCommissionEarned: Number((commissionAgg[0]?.total || 0).toFixed(2)),
        referralCount: referrals.length,
        depositedReferralCount,
        promoCount: promoHistory.length,
        totalPromoEarned: Number(totalPromoEarned.toFixed(2)),
        taskCompletedCount: taskStatsAgg[0]?.count || 0,
        totalTaskEarned: Number((taskStatsAgg[0]?.total || 0).toFixed(2)),
      },
      details: {
        referredByUser,
        deposits,
        withdrawals,
        commissions,
        referrals,
        promoHistory,
        tasks,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch user",
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "email",
      "phone",
      "role",
      "plan",
      "bio",
      "address",
      "country",
      "city",
      "zip",
    ];
    const updatePayload = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updatePayload[field] =
          typeof req.body[field] === "string" ? req.body[field].trim() : req.body[field];
      }
    });

    if (req.body.balance !== undefined) {
      const parsedBalance = Number(req.body.balance);
      if (Number.isNaN(parsedBalance) || parsedBalance < 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid non-negative wallet balance",
        });
      }
      updatePayload.balance = Number(parsedBalance.toFixed(2));
    }

    if (req.body.isSuspended !== undefined) {
      updatePayload.isSuspended = Boolean(req.body.isSuspended);
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updatePayload, {
      new: true,
      runValidators: true,
    })
      .select("-password")
      .lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updated,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email or phone number is already in use by another account",
      });
    }
    return res.status(500).json({
      success: false,
      message: error?.message || "User update failed",
    });
  }
};

exports.toggleSuspendUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isSuspended = !user.isSuspended;
    await user.save();

    return res.status(200).json({
      success: true,
      message: user.isSuspended
        ? "User suspended successfully"
        : "User activated successfully",
      isSuspended: user.isSuspended,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "User suspend action failed",
    });
  }
};
