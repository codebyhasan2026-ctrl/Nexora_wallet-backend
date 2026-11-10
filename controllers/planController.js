const Plan = require("../models/plan");
const User = require("../models/user");
const Commission = require("../models/commission");
const Notification = require("../models/notification");
const SiteSetting = require("../models/siteSetting");
const { uploadToCloudinary } = require("../middleware/upload");

const seedDefaultPlansIfNeeded = async () => {
  const count = await Plan.countDocuments();
  if (count === 0) {
    await Plan.create([
      {
        name: "Basic Plan",
        level: "VIP 1",
        price: 15,
        currency: "USDT",
        validity: 1,
        dailyAdsLimit: 2,
        rewardPerAd: 0.75,
        dailyIncome: 1.5,
        referralBonus: "Upto 3 Level",
        image: "/vip-1.svg",
        isActive: true,
      },
      {
        name: "Silver VIP",
        level: "VIP 2",
        price: 45,
        currency: "USDT",
        validity: 15,
        dailyAdsLimit: 5,
        rewardPerAd: 0.9,
        dailyIncome: 4.5,
        referralBonus: "Upto 3 Level",
        image: "/vip-2.svg",
        isActive: true,
      },
      {
        name: "Gold VIP",
        level: "VIP 3",
        price: 100,
        currency: "USDT",
        validity: 30,
        dailyAdsLimit: 10,
        rewardPerAd: 1.2,
        dailyIncome: 12.0,
        referralBonus: "Upto 3 Level",
        image: "/vip-3.svg",
        isActive: true,
      },
      {
        name: "Diamond Elite",
        level: "VIP 4",
        price: 250,
        currency: "USDT",
        validity: 45,
        dailyAdsLimit: 20,
        rewardPerAd: 1.5,
        dailyIncome: 30.0,
        referralBonus: "Upto 3 Level",
        image: "/vip-4.svg",
        isActive: true,
      },
    ]);
  }
};

exports.getPlans = async (req, res) => {
  try {
    await seedDefaultPlansIfNeeded();
    const plans = await Plan.find({ isActive: true }).sort({ price: 1 }).lean();
    return res.status(200).json({ success: true, plans });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllPlansAdmin = async (req, res) => {
  try {
    await seedDefaultPlansIfNeeded();
    const plans = await Plan.find().sort({ price: 1 }).lean();
    return res.status(200).json({ success: true, plans });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPlanByIdAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await Plan.findById(id).lean();
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }
    return res.status(200).json({ success: true, plan });
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

    try {
      if (user.referredBy && user.referredBy.trim()) {
        const settings = await SiteSetting.findOne().lean();
        const rateA = Number(settings?.commissionLevel1 ?? 10);
        const rateB = Number(settings?.commissionLevel2 ?? 5);
        const rateC = Number(settings?.commissionLevel3 ?? 2);

        const findUpline = async (refKey) => {
          if (!refKey) return null;
          return await User.findOne({
            $or: [
              { referralCode: refKey },
              { name: refKey },
              { phone: refKey },
              { email: refKey },
            ],
          });
        };

        const uplineA = await findUpline(user.referredBy.trim());
        if (uplineA && uplineA._id.toString() !== user._id.toString()) {
          const commA = Number(((plan.price * rateA) / 100).toFixed(2));
          if (commA > 0) {
            uplineA.balance = Number((uplineA.balance + commA).toFixed(2));
            await uplineA.save();
            await Commission.create({
              recipient: uplineA._id,
              fromUser: user._id,
              level: "A",
              percent: rateA,
              amount: commA,
              source: "plan_purchase",
              description: `Level A commission from ${user.name} (${plan.name})`,
            });
            await Notification.create({
              user: uplineA._id,
              title: "Referral Commission Earned!",
              message: `You earned +$${commA.toFixed(2)} USD (Level A - ${rateA}%) from ${user.name}'s ${plan.name} purchase!`,
              type: "commission",
              amount: commA,
            });
          }

          if (uplineA.referredBy && uplineA.referredBy.trim()) {
            const uplineB = await findUpline(uplineA.referredBy.trim());
            if (
              uplineB &&
              uplineB._id.toString() !== uplineA._id.toString() &&
              uplineB._id.toString() !== user._id.toString()
            ) {
              const commB = Number(((plan.price * rateB) / 100).toFixed(2));
              if (commB > 0) {
                uplineB.balance = Number((uplineB.balance + commB).toFixed(2));
                await uplineB.save();
                await Commission.create({
                  recipient: uplineB._id,
                  fromUser: user._id,
                  level: "B",
                  percent: rateB,
                  amount: commB,
                  source: "plan_purchase",
                  description: `Level B commission from ${user.name} (${plan.name})`,
                });
                await Notification.create({
                  user: uplineB._id,
                  title: "Referral Commission Earned!",
                  message: `You earned +$${commB.toFixed(2)} USD (Level B - ${rateB}%) from ${user.name}'s ${plan.name} purchase!`,
                  type: "commission",
                  amount: commB,
                });
              }

              if (uplineB.referredBy && uplineB.referredBy.trim()) {
                const uplineC = await findUpline(uplineB.referredBy.trim());
                if (
                  uplineC &&
                  uplineC._id.toString() !== uplineB._id.toString() &&
                  uplineC._id.toString() !== user._id.toString()
                ) {
                  const commC = Number(((plan.price * rateC) / 100).toFixed(2));
                  if (commC > 0) {
                    uplineC.balance = Number((uplineC.balance + commC).toFixed(2));
                    await uplineC.save();
                    await Commission.create({
                      recipient: uplineC._id,
                      fromUser: user._id,
                      level: "C",
                      percent: rateC,
                      amount: commC,
                      source: "plan_purchase",
                      description: `Level C commission from ${user.name} (${plan.name})`,
                    });
                    await Notification.create({
                      user: uplineC._id,
                      title: "Referral Commission Earned!",
                      message: `You earned +$${commC.toFixed(2)} USD (Level C - ${rateC}%) from ${user.name}'s ${plan.name} purchase!`,
                      type: "commission",
                      amount: commC,
                    });
                  }
                }
              }
            }
          }
        }
      }
    } catch (commErr) {}

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
      referralBonus,
      features,
      isActive,
      image,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Plan name is required" });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      return res.status(400).json({ success: false, message: "Valid plan price is required" });
    }

    let imageUrl = image ? image.trim() : "";
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file.buffer);
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload plan image",
        });
      }
    }

    const numValidity = Number(validity) || 30;
    const numAds = Number(dailyAdsLimit) || 1;
    const numReward = Number(rewardPerAd) || 0;
    const calcDaily = dailyIncome ? Number(dailyIncome) : Number((numAds * numReward).toFixed(2));

    const plan = await Plan.create({
      name: name.trim(),
      level: level ? level.trim() : "VIP 1",
      price: numPrice,
      currency: currency || "USDT",
      validity: numValidity,
      dailyAdsLimit: numAds,
      rewardPerAd: numReward,
      dailyIncome: calcDaily,
      referralBonus: referralBonus ? referralBonus.trim() : "Upto 3 Level",
      image: imageUrl,
      features: Array.isArray(features) ? features : [],
      isActive: isActive !== undefined ? Boolean(isActive) : true,
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
    const {
      name,
      level,
      price,
      currency,
      validity,
      dailyAdsLimit,
      rewardPerAd,
      dailyIncome,
      referralBonus,
      features,
      isActive,
      image,
    } = req.body;

    const plan = await Plan.findById(id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    if (name !== undefined) plan.name = name.trim();
    if (level !== undefined) plan.level = level.trim();
    if (price !== undefined) plan.price = Number(price);
    if (currency !== undefined) plan.currency = currency;
    if (validity !== undefined) plan.validity = Number(validity);
    if (dailyAdsLimit !== undefined) plan.dailyAdsLimit = Number(dailyAdsLimit);
    if (rewardPerAd !== undefined) plan.rewardPerAd = Number(rewardPerAd);
    if (dailyIncome !== undefined) {
      plan.dailyIncome = Number(dailyIncome);
    } else if (dailyAdsLimit !== undefined || rewardPerAd !== undefined) {
      plan.dailyIncome = Number((plan.dailyAdsLimit * plan.rewardPerAd).toFixed(2));
    }
    if (referralBonus !== undefined) plan.referralBonus = referralBonus.trim();
    if (features !== undefined) plan.features = Array.isArray(features) ? features : [];
    if (isActive !== undefined) plan.isActive = Boolean(isActive);

    if (req.file) {
      try {
        plan.image = await uploadToCloudinary(req.file.buffer);
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload plan image",
        });
      }
    } else if (image !== undefined) {
      plan.image = image.trim();
    }

    await plan.save();

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
