const PromoCode = require("../models/promoCode");
const User = require("../models/user");
const Notification = require("../models/notification");

exports.redeemPromoCode = async (req, res) => {
  try {
    const rawCode = req.body?.code;
    if (!rawCode || typeof rawCode !== "string") {
      return res.status(400).json({ message: "Please provide a valid promo code." });
    }

    const normalizedCode = rawCode.trim().toUpperCase();
    if (!normalizedCode) {
      return res.status(400).json({ message: "Please provide a valid promo code." });
    }

    const promo = await PromoCode.findOne({ code: normalizedCode });
    if (!promo) {
      return res.status(404).json({ message: "Invalid promo code. Please check and try again." });
    }

    if (!promo.isActive) {
      return res.status(400).json({ message: "This promo code is currently disabled." });
    }

    if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ message: "This promo code has expired." });
    }

    if (promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ message: "This promo code has reached its maximum redemption limit." });
    }

    const alreadyRedeemed = promo.redeemedUsers.some(
      (entry) => entry.user && entry.user.toString() === req.user._id.toString()
    );
    if (alreadyRedeemed) {
      return res.status(400).json({ message: "You have already redeemed this promo code!" });
    }

    const updatedPromo = await PromoCode.findOneAndUpdate(
      {
        _id: promo._id,
        isActive: true,
        usedCount: { $lt: promo.maxUses },
        "redeemedUsers.user": { $ne: req.user._id },
      },
      {
        $inc: { usedCount: 1 },
        $push: {
          redeemedUsers: {
            user: req.user._id,
            name: req.user.name || "User",
            email: req.user.email || "",
            phone: req.user.phone || "",
            amount: promo.rewardAmount,
            redeemedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updatedPromo) {
      return res.status(400).json({
        message: "Failed to redeem promo code. Redemption limit reached or already used.",
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { balance: promo.rewardAmount } },
      { new: true }
    );

    await Notification.create({
      user: req.user._id,
      title: "Promo Code Redeemed!",
      message: `Congratulations! You successfully redeemed code ${promo.code} and received $${Number(
        promo.rewardAmount
      ).toFixed(2)} USD in your wallet.`,
      type: "promo",
      amount: promo.rewardAmount,
    });

    return res.status(200).json({
      success: true,
      message: `Promo code applied successfully! +$${Number(promo.rewardAmount).toFixed(
        2
      )} USD added to your wallet.`,
      code: promo.code,
      rewardAmount: promo.rewardAmount,
      newBalance: updatedUser.balance,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error while redeeming promo code.",
      error: error.message,
    });
  }
};

exports.getMyRedeemedCodes = async (req, res) => {
  try {
    const promoCodes = await PromoCode.find({
      "redeemedUsers.user": req.user._id,
    }).sort({ updatedAt: -1 });

    const history = [];
    promoCodes.forEach((promo) => {
      promo.redeemedUsers.forEach((r) => {
        if (r.user && r.user.toString() === req.user._id.toString()) {
          history.push({
            id: promo._id,
            code: promo.code,
            amount: r.amount || promo.rewardAmount,
            redeemedAt: r.redeemedAt,
          });
        }
      });
    });

    history.sort((a, b) => new Date(b.redeemedAt) - new Date(a.redeemedAt));

    return res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch redemption history." });
  }
};

exports.getAdminPromoCodes = async (req, res) => {
  try {
    const promoCodes = await PromoCode.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      promoCodes,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch promo codes." });
  }
};

exports.getAdminRedemptionHistory = async (req, res) => {
  try {
    const promoCodes = await PromoCode.find({
      "redeemedUsers.0": { $exists: true },
    })
      .populate("redeemedUsers.user", "name email phone")
      .sort({ updatedAt: -1 });

    const history = [];
    promoCodes.forEach((promo) => {
      promo.redeemedUsers.forEach((item) => {
        history.push({
          redemptionId: item._id,
          promoId: promo._id,
          code: promo.code,
          rewardAmount: item.amount || promo.rewardAmount,
          userId: item.user?._id || item.user,
          userName: item.user?.name || item.name || "Member",
          userEmail: item.user?.email || item.email || "N/A",
          userPhone: item.user?.phone || item.phone || "N/A",
          redeemedAt: item.redeemedAt,
        });
      });
    });

    history.sort((a, b) => new Date(b.redeemedAt) - new Date(a.redeemedAt));

    return res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch redemption log." });
  }
};

exports.createPromoCode = async (req, res) => {
  try {
    let { code, rewardAmount, maxUses, expiresAt, description } = req.body;

    if (!rewardAmount || Number(rewardAmount) <= 0) {
      return res.status(400).json({ message: "Reward amount must be greater than 0." });
    }

    if (!code || !code.trim()) {
      code = "NX" + Math.random().toString(36).substring(2, 8).toUpperCase();
    } else {
      code = code.trim().toUpperCase();
    }

    const existing = await PromoCode.findOne({ code });
    if (existing) {
      return res.status(400).json({ message: `Promo code "${code}" already exists.` });
    }

    const promo = await PromoCode.create({
      code,
      rewardAmount: Number(rewardAmount),
      maxUses: maxUses && Number(maxUses) > 0 ? Number(maxUses) : 1,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      description: (description || "").trim(),
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: `Promo code "${promo.code}" created successfully!`,
      promo,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create promo code.",
      error: error.message,
    });
  }
};

exports.togglePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await PromoCode.findById(id);
    if (!promo) {
      return res.status(404).json({ message: "Promo code not found." });
    }

    promo.isActive = !promo.isActive;
    await promo.save();

    return res.status(200).json({
      success: true,
      message: `Promo code "${promo.code}" is now ${promo.isActive ? "Active" : "Disabled"}.`,
      promo,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to toggle promo code." });
  }
};

exports.deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await PromoCode.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Promo code not found." });
    }
    return res.status(200).json({
      success: true,
      message: `Promo code "${deleted.code}" deleted successfully.`,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete promo code." });
  }
};

