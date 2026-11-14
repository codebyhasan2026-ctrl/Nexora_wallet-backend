const User = require("../models/user");
const Deposit = require("../models/deposit");
const Withdraw = require("../models/withdraw");
const Commission = require("../models/commission");
const Plan = require("../models/plan");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { uploadToCloudinary, deleteFromCloudinary } = require("../middleware/upload");

exports.register = async (req, res) => {
  try {
    const { name, username, email, phone, password, securityPassword, recomCode } = req.body;
    const finalName = username || name;
    const finalEmail = email || `${finalName.toLowerCase().replace(/[^a-z0-9]/g, "")}@nexorawallet.io`;

    const existEmail = await User.findOne({ email: finalEmail });
    if (existEmail)
      return res.status(400).json({ message: "User already exists with this username/email" });

    const existPhone = await User.findOne({ phone });
    if (existPhone)
      return res.status(400).json({ message: "Phone number already registered" });

    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let generatedRefCode = "NX";
    for (let i = 0; i < 6; i++) {
      generatedRefCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const user = await User.create({
      name: finalName,
      email: finalEmail,
      phone,
      password,
      referralCode: generatedRefCode,
      referredBy: recomCode ? recomCode.trim() : "",
    });

    return res.status(201).json({
      message: "Registration Successful",
      userId: user._id,
    });
  } catch {
    return res.status(500).json({ message: "Register Failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Username/email and password required" });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier },
        { name: identifier },
        { phone: identifier }
      ]
    });

    if (!user)
      return res.status(400).json({ message: "Invalid username or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid username or password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: "Login Successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch {
    res.status(500).json({ message: "Login Failed" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    if (!Array.isArray(user.purchasedPlans)) {
      user.purchasedPlans = [];
    }

    if (
      user.purchasedPlans.length === 0 &&
      user.planId &&
      user.plan &&
      user.plan !== "No Plan"
    ) {
      if (!user.planExpiresAt || new Date(user.planExpiresAt) > now) {
        user.purchasedPlans.push({
          planId: user.planId,
          planName: user.plan,
          level: "VIP",
          price: 0,
          validity: 30,
          dailyAdsLimit: user.dailyAdsLimit || 2,
          rewardPerAd: 0.75,
          purchasedAt: user.createdAt || now,
          expiresAt: user.planExpiresAt,
        });
        await user.save();
      }
    }

    const activePlans = user.purchasedPlans.filter(
      (p) => !p.expiresAt || new Date(p.expiresAt) > now
    );

    if (activePlans.length === 0 && user.plan && user.plan !== "No Plan") {
      user.plan = "No Plan";
      user.planId = undefined;
      user.planValidity = "Expired";
      user.dailyAdsLimit = 0;
      user.remainTasks = 0;
      await user.save();
    } else if (activePlans.length > 0) {
      const totalDailyLimit = activePlans.reduce(
        (sum, p) => sum + (Number(p.dailyAdsLimit) || 0),
        0
      );
      const combinedPlanName = activePlans.map((p) => p.planName).join(" + ");
      let needsSave = false;
      if (user.dailyAdsLimit !== totalDailyLimit) {
        user.dailyAdsLimit = totalDailyLimit;
        needsSave = true;
      }
      if (user.plan !== combinedPlanName) {
        user.plan = combinedPlanName;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    }

    if (!user.referralCode) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "NX";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      user.referralCode = code;
      await user.save();
    }

    const approvedDepositAgg = await Deposit.aggregate([
      { $match: { user: user._id, status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalDepositCalc = Math.max(
      Number(user.totalDeposit || 0),
      Number(approvedDepositAgg[0]?.total || 0)
    );
    user.totalDeposit = Number(totalDepositCalc.toFixed(2));

    const approvedWithdrawAgg = await Withdraw.aggregate([
      { $match: { user: user._id, status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalWithdrawCalc = Math.max(
      Number(user.totalWithdraw || 0),
      Number(approvedWithdrawAgg[0]?.total || 0)
    );
    user.totalWithdraw = Number(totalWithdrawCalc.toFixed(2));

    const pendingDepositAgg = await Deposit.aggregate([
      { $match: { user: user._id, status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const pendingInvestCalc = Number(pendingDepositAgg[0]?.total || 0);
    user.pendingInvest = Number(pendingInvestCalc.toFixed(2));

    const commissionAgg = await Commission.aggregate([
      { $match: { recipient: user._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const referralEarnCalc = Math.max(
      Number(user.referralEarn || 0),
      Number(commissionAgg[0]?.total || 0)
    );
    user.referralEarn = Number(referralEarnCalc.toFixed(2));

    const allPlans = await Plan.find().lean();
    for (const p of user.purchasedPlans) {
      if (!p.price || Number(p.price) <= 0) {
        const matched = allPlans.find(
          (pl) =>
            (p.planId && pl._id.toString() === p.planId.toString()) ||
            (p.planName && pl.name.toLowerCase() === p.planName.toLowerCase()) ||
            (p.level && pl.level && pl.level.toLowerCase() === p.level.toLowerCase())
        );
        if (matched && matched.price) {
          p.price = Number(matched.price);
        }
      }
    }

    let sumPurchased = 0;
    for (const p of user.purchasedPlans) {
      sumPurchased += Number(p.price || 0);
    }
    if (sumPurchased === 0 && user.plan && user.plan !== "No Plan") {
      const matched = allPlans.find(
        (pl) =>
          (user.planId && pl._id.toString() === user.planId.toString()) ||
          (user.plan && pl.name.toLowerCase() === user.plan.toLowerCase())
      );
      if (matched && matched.price) {
        sumPurchased = Number(matched.price);
      }
    }
    const totalInvestCalc = Math.max(
      Number(user.totalInvest || 0),
      Number(sumPurchased || 0)
    );
    user.totalInvest = Number(totalInvestCalc.toFixed(2));

    let lastPlanPrice = 0;
    if (user.purchasedPlans.length > 0) {
      lastPlanPrice = Number(
        user.purchasedPlans[user.purchasedPlans.length - 1]?.price || 0
      );
    }
    if (lastPlanPrice === 0 && user.plan && user.plan !== "No Plan") {
      const matched = allPlans.find(
        (pl) =>
          (user.planId && pl._id.toString() === user.planId.toString()) ||
          (user.plan && pl.name.toLowerCase() === user.plan.toLowerCase())
      );
      if (matched && matched.price) {
        lastPlanPrice = Number(matched.price);
      }
    }
    const recentInvestCalc =
      user.recentInvest && Number(user.recentInvest) > 0
        ? Number(user.recentInvest)
        : lastPlanPrice;
    user.recentInvest = Number(recentInvestCalc.toFixed(2));

    await user.save();

    return res.status(200).json({
      message: "Profile fetched successfully",
      user,
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, bio, address, country, city, zip, profileImage } =
      req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone, bio, address, country, city, zip, profileImage },
      { new: true },
    ).select("-password");

    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch {
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

exports.uploadUserProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.profileImage && user.profileImage.includes("cloudinary")) {
      try {
        await deleteFromCloudinary(user.profileImage);
      } catch (err) {}
    }

    const imageUrl = await uploadToCloudinary(req.file.buffer);

    user.profileImage = imageUrl;
    await user.save();

    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).json({
      message: "Profile image updated successfully",
      profileImage: imageUrl,
      user: safeUser,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to upload profile image" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to change password" });
  }
};
