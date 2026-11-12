const User = require("../models/user");
const Commission = require("../models/commission");
const SiteSetting = require("../models/siteSetting");

const maskIdentifier = (str) => {
  if (!str) return "Member";
  if (str.length <= 4) return str;
  return str.slice(0, 3) + "****" + str.slice(-4);
};

const ensureUserReferralCode = async (user) => {
  if (user.referralCode && user.referralCode.trim()) {
    return user.referralCode;
  }
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NX";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  user.referralCode = code;
  await user.save();
  return code;
};

exports.getMyReferralTeam = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const myReferralCode = await ensureUserReferralCode(user);

    const settings = await SiteSetting.findOne().lean();
    const rateA = Number(settings?.commissionLevel1 ?? 10);
    const rateB = Number(settings?.commissionLevel2 ?? 5);
    const rateC = Number(settings?.commissionLevel3 ?? 2);

    const userIdentifiers = [
      myReferralCode,
      user._id.toString(),
      user.name,
      user.phone,
    ].filter(Boolean);

    const levelAUsers = await User.find({
      referredBy: { $in: userIdentifiers },
      _id: { $ne: userId },
    })
      .select("name phone plan totalDeposit balance createdAt referralCode")
      .sort({ createdAt: -1 })
      .lean();

    const levelAIdentifiers = [];
    levelAUsers.forEach((u) => {
      if (u.referralCode) levelAIdentifiers.push(u.referralCode);
      if (u._id) levelAIdentifiers.push(u._id.toString());
      if (u.name) levelAIdentifiers.push(u.name);
      if (u.phone) levelAIdentifiers.push(u.phone);
    });

    let levelBUsers = [];
    if (levelAIdentifiers.length > 0) {
      levelBUsers = await User.find({
        referredBy: { $in: levelAIdentifiers },
        _id: { $ne: userId },
      })
        .select("name phone plan totalDeposit balance createdAt referralCode")
        .sort({ createdAt: -1 })
        .lean();
    }

    const levelBIdentifiers = [];
    levelBUsers.forEach((u) => {
      if (u.referralCode) levelBIdentifiers.push(u.referralCode);
      if (u._id) levelBIdentifiers.push(u._id.toString());
      if (u.name) levelBIdentifiers.push(u.name);
      if (u.phone) levelBIdentifiers.push(u.phone);
    });

    let levelCUsers = [];
    if (levelBIdentifiers.length > 0) {
      levelCUsers = await User.find({
        referredBy: { $in: levelBIdentifiers },
        _id: { $ne: userId },
      })
        .select("name phone plan totalDeposit balance createdAt referralCode")
        .sort({ createdAt: -1 })
        .lean();
    }

    const commissions = await Commission.find({ recipient: userId }).lean();

    const calcTier = (userList, tierLetter, tierRate) => {
      const totalInvite = userList.length;
      const validUsers = userList.filter(
        (u) => Number(u.totalDeposit || 0) > 0
      ).length;
      const totalRecharge = userList.reduce(
        (sum, u) => sum + Number(u.totalDeposit || 0),
        0
      );
      const tierCommissions = commissions
        .filter((c) => c.level === tierLetter)
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);

      const members = userList.map((u, idx) => ({
        id: u._id || idx,
        mobile: maskIdentifier(u.phone || u.name),
        name: u.name,
        level: tierLetter,
        plan: u.plan || "Free",
        invest: Number(u.totalDeposit || 0).toFixed(2),
        hasDeposited: Number(u.totalDeposit || 0) > 0,
        joinDate: u.createdAt,
      }));

      return {
        totalInvite,
        validUsers,
        totalRecharge: totalRecharge.toFixed(2),
        teamCommission: tierCommissions.toFixed(2),
        commissionRate: tierRate,
        members,
      };
    };

    const teamA = calcTier(levelAUsers, "A", rateA);
    const teamB = calcTier(levelBUsers, "B", rateB);
    const teamC = calcTier(levelCUsers, "C", rateC);

    const totalMembers = teamA.totalInvite + teamB.totalInvite + teamC.totalInvite;
    const totalCommissionEarned = (
      Number(teamA.teamCommission) +
      Number(teamB.teamCommission) +
      Number(teamC.teamCommission)
    ).toFixed(2);

    return res.status(200).json({
      success: true,
      referralCode: myReferralCode,
      rates: {
        A: rateA,
        B: rateB,
        C: rateC,
      },
      stats: {
        totalMembers,
        totalCommissionEarned,
        team: {
          A: teamA,
          B: teamB,
          C: teamC,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load referral team",
    });
  }
};

exports.getMyCommissions = async (req, res) => {
  try {
    const userId = req.user._id;

    const [user, settings, history] = await Promise.all([
      User.findById(userId).select("referralCode name phone balance"),
      SiteSetting.findOne().lean(),
      Commission.find({ recipient: userId })
        .populate("fromUser", "name phone plan")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const rateA = Number(settings?.commissionLevel1 ?? 10);
    const rateB = Number(settings?.commissionLevel2 ?? 5);
    const rateC = Number(settings?.commissionLevel3 ?? 2);

    const totalEarned = history.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const earnedA = history
      .filter((c) => c.level === "A")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const earnedB = history
      .filter((c) => c.level === "B")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const earnedC = history
      .filter((c) => c.level === "C")
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const formattedHistory = history.map((c) => ({
      _id: c._id,
      fromUser: {
        name: c.fromUser?.name || "Team Member",
        phone: maskIdentifier(c.fromUser?.phone),
        plan: c.fromUser?.plan || "VIP",
      },
      level: c.level,
      percent: c.percent,
      amount: Number(c.amount || 0).toFixed(2),
      source: c.source,
      description: c.description || `Level ${c.level} Referral Commission`,
      createdAt: c.createdAt,
    }));

    return res.status(200).json({
      success: true,
      referralCode: user?.referralCode || "NEXORA",
      rates: {
        A: rateA,
        B: rateB,
        C: rateC,
      },
      summary: {
        totalEarned: totalEarned.toFixed(2),
        earnedA: earnedA.toFixed(2),
        earnedB: earnedB.toFixed(2),
        earnedC: earnedC.toFixed(2),
        totalRecords: history.length,
      },
      history: formattedHistory,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load commissions",
    });
  }
};

