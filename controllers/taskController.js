const Ad = require("../models/ad");
const User = require("../models/user");

exports.getTasks = async (req, res) => {
  try {
    const user = req.user;
    const today = new Date().toISOString().slice(0, 10);

    if (user.lastTaskResetDate !== today) {
      user.lastTaskResetDate = today;
      user.completeTasks = 0;
      user.remainTasks = user.dailyAdsLimit || 0;
      await user.save();
    }

    const ads = await Ad.find({ isActive: true }).limit(20);

    return res.status(200).json({
      success: true,
      ads,
      stats: {
        dailyLimit: user.dailyAdsLimit || 0,
        completeTasks: user.completeTasks || 0,
        remainTasks: user.remainTasks || 0,
        plan: user.plan || "No Plan",
        balance: user.balance || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeTask = async (req, res) => {
  try {
    const userId = req.user._id;
    const { adId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.plan || user.plan === "No Plan") {
      return res.status(400).json({
        message: "You must purchase a membership plan before watching ads.",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (user.lastTaskResetDate !== today) {
      user.lastTaskResetDate = today;
      user.completeTasks = 0;
      user.remainTasks = user.dailyAdsLimit || 0;
    }

    if (user.remainTasks <= 0) {
      return res.status(400).json({
        message: "You have reached your daily ads limit for today.",
      });
    }

    let reward = 0.75;
    if (adId) {
      const ad = await Ad.findById(adId);
      if (ad && ad.reward) {
        reward = ad.reward;
      }
    }

    user.balance = Number((user.balance + reward).toFixed(2));
    user.completeTasks += 1;
    user.remainTasks = Math.max(0, user.remainTasks - 1);

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Reward claimed! +${reward} USDT added to wallet.`,
      reward,
      user: {
        balance: user.balance,
        completeTasks: user.completeTasks,
        remainTasks: user.remainTasks,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAd = async (req, res) => {
  try {
    const { title, sponsor, banner, link, reward, duration } = req.body;
    const ad = await Ad.create({
      title,
      sponsor,
      banner: banner || "",
      link: link || "",
      reward: reward || 0.75,
      duration: duration || 5,
    });

    return res.status(201).json({
      success: true,
      message: "Ad created successfully",
      ad,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

