const User = require("../models/user");
const Deposit = require("../models/deposit");
const Withdraw = require("../models/withdraw");
const Plan = require("../models/plan");
const Ad = require("../models/ad");

exports.getAdminDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      suspendedUsers,
      todayUsers,
      userBalanceAgg,
      pendingDeposits,
      pendingWithdrawals,
      depositAgg,
      withdrawAgg,
      totalPlans,
      totalTasks,
      recentDeposits,
      recentWithdrawals,
      last7DaysUsers,
      last7DaysDeposits,
      last7DaysWithdrawals,
      monthlyDeposits,
      monthlyWithdrawals
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isSuspended: true }),
      User.countDocuments({ createdAt: { $gte: todayStart } }),
      User.aggregate([
        { $group: { _id: null, totalBalance: { $sum: "$balance" } } },
      ]),
      Deposit.countDocuments({ status: "pending" }),
      Withdraw.countDocuments({ status: "pending" }),
      Deposit.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, totalBDT: { $sum: "$amount" } } },
      ]),
      Withdraw.aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: null, totalBDT: { $sum: "$finalAmount" }, totalUSDT: { $sum: "$amountUSDT" } } },
      ]),
      Plan.countDocuments({}),
      Ad.countDocuments({}),
      Deposit.find({})
        .populate("user", "name email phone profileImage")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Withdraw.find({})
        .populate("user", "name email phone profileImage")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      User.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Deposit.aggregate([
        { $match: { status: "approved", createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalBDT: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Withdraw.aggregate([
        { $match: { status: "approved", createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            totalUSDT: { $sum: "$amountUSDT" },
            totalBDT: { $sum: "$finalAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Deposit.aggregate([
        { $match: { status: "approved", createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            totalBDT: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Withdraw.aggregate([
        { $match: { status: "approved", createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            totalUSDT: { $sum: "$amountUSDT" },
            totalBDT: { $sum: "$finalAmount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const totalUserBalanceUSDT = userBalanceAgg[0]?.totalBalance || 0;
    const totalUserBalanceBDT = totalUserBalanceUSDT * 125;

    const totalDepositBDT = depositAgg[0]?.totalBDT || 0;
    const totalDepositUSDT = totalDepositBDT / 125;

    const totalWithdrawBDT = withdrawAgg[0]?.totalBDT || 0;
    const totalWithdrawUSDT = withdrawAgg[0]?.totalUSDT || 0;

    const daysList = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dep = last7DaysDeposits.find((x) => x._id === key)?.totalBDT || 0;
      const withdr = last7DaysWithdrawals.find((x) => x._id === key)?.totalBDT || 0;
      const uCount = last7DaysUsers.find((x) => x._id === key)?.count || 0;

      daysList.push({
        date: key,
        day: dayName,
        depositsBDT: dep,
        depositsUSDT: Number((dep / 125).toFixed(2)),
        withdrawalsBDT: withdr,
        withdrawalsUSDT: Number((withdr / 125).toFixed(2)),
        newUsers: uCount,
      });
    }

    const monthsList = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const monthName = d.toLocaleDateString("en-US", { month: "short" });
      const dep = monthlyDeposits.find((x) => x._id === key)?.totalBDT || 0;
      const withdr = monthlyWithdrawals.find((x) => x._id === key)?.totalBDT || 0;

      monthsList.push({
        month: monthName,
        yearMonth: key,
        depositsBDT: dep,
        depositsUSDT: Number((dep / 125).toFixed(2)),
        withdrawalsBDT: withdr,
        withdrawalsUSDT: Number((withdr / 125).toFixed(2)),
      });
    }

    res.status(200).json({
      success: true,
      message: "Dashboard stats loaded successfully",
      stats: {
        users: {
          total: totalUsers,
          today: todayUsers,
          active: Math.max(0, totalUsers - suspendedUsers),
          suspended: suspendedUsers,
        },
        financials: {
          totalDepositsBDT: totalDepositBDT,
          totalDepositsUSDT: Number(totalDepositUSDT.toFixed(2)),
          totalWithdrawalsBDT: totalWithdrawBDT,
          totalWithdrawalsUSDT: Number(totalWithdrawUSDT.toFixed(2)),
          totalUserBalancesUSDT: Number(totalUserBalanceUSDT.toFixed(2)),
          totalUserBalancesBDT: Number(totalUserBalanceBDT.toFixed(2)),
          netSystemProfitBDT: Number((totalDepositBDT - totalWithdrawBDT).toFixed(2)),
          netSystemProfitUSDT: Number((totalDepositUSDT - totalWithdrawUSDT).toFixed(2)),
        },
        pending: {
          deposits: pendingDeposits,
          withdrawals: pendingWithdrawals,
        },
        platform: {
          totalPlans,
          totalTasks,
        },
        charts: {
          last7Days: daysList,
          monthly: monthsList,
        },
        recentActivities: {
          deposits: recentDeposits,
          withdrawals: recentWithdrawals,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load dashboard stats",
    });
  }
};
