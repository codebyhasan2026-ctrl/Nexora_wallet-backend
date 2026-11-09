const Plan = require("../models/plan");
const User = require("../models/user");

exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    return res.status(200).json({ success: true, plans });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.purchasePlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const { planId } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan || !plan.isActive) {
      return res.status(404).json({ message: "Plan not found or inactive" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.balance < plan.price) {
      return res.status(400).json({
        message: "Insufficient balance! Please deposit USDT to your wallet.",
      });
    }

    user.balance = Number((user.balance - plan.price).toFixed(2));
    user.plan = plan.name;
    user.planId = plan._id;
    user.planValidity = `${plan.validity} Days`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + plan.validity);
    user.planExpiresAt = expiresAt;

    user.dailyAdsLimit = plan.dailyAdsLimit;
    user.remainTasks = plan.dailyAdsLimit;
    user.completeTasks = 0;
    user.lastTaskResetDate = new Date().toISOString().slice(0, 10);

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Successfully purchased ${plan.name}!`,
      user: {
        balance: user.balance,
        plan: user.plan,
        planValidity: user.planValidity,
        dailyAdsLimit: user.dailyAdsLimit,
        remainTasks: user.remainTasks,
        completeTasks: user.completeTasks,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const {
      name,
      level,
      price,
      currency,
      validity,
      dailyAdsLimit,
      rewardPerAd,
      dailyIncome,
      features,
    } = req.body;

    const plan = await Plan.create({
      name,
      level: level || "VIP 1",
      price,
      currency: currency || "USDT",
      validity,
      dailyAdsLimit,
      rewardPerAd,
      dailyIncome: dailyIncome || Number((dailyAdsLimit * rewardPerAd).toFixed(2)),
      features: features || [],
    });

    return res.status(201).json({
      success: true,
      message: "Membership plan created successfully",
      plan,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findByIdAndUpdate(id, req.body, { new: true });
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    return res.status(200).json({
      success: true,
      message: "Plan updated successfully",
      plan,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    return res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

