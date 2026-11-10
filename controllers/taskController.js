const Ad = require("../models/ad");
const User = require("../models/user");
const Plan = require("../models/plan");
const TaskCompletion = require("../models/taskCompletion");
const { uploadToCloudinary } = require("../middleware/upload");

exports.getTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let userPlanId = user.planId;
    if (!userPlanId && user.plan && user.plan !== "No Plan") {
      const matchedPlan = await Plan.findOne({
        $or: [{ name: user.plan }, { level: user.plan }],
      });
      if (matchedPlan) {
        userPlanId = matchedPlan._id;
        user.planId = matchedPlan._id;
        user.dailyAdsLimit = matchedPlan.dailyAdsLimit;
        await user.save();
      }
    }

    if (!userPlanId || !user.plan || user.plan === "No Plan") {
      return res.status(200).json({
        success: true,
        hasActivePlan: false,
        message: "No active membership plan. Please purchase a VIP plan.",
        availableTasks: [],
        completedTasks: [],
        stats: {
          plan: "No Plan",
          dailyLimit: 0,
          completedCount: 0,
          remainingCount: 0,
          balance: user.balance || 0,
        },
      });
    }

    if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) {
      return res.status(200).json({
        success: true,
        hasActivePlan: false,
        isExpired: true,
        message: "Your membership plan has expired. Please renew your plan.",
        availableTasks: [],
        completedTasks: [],
        stats: {
          plan: user.plan,
          dailyLimit: user.dailyAdsLimit || 0,
          completedCount: 0,
          remainingCount: 0,
          balance: user.balance || 0,
        },
      });
    }

    const allPlanTasks = await Ad.find({
      plan: userPlanId,
      isActive: true,
    }).sort({ createdAt: -1 });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentCompletions = await TaskCompletion.find({
      user: userId,
      completedAt: { $gte: twentyFourHoursAgo },
    });

    const completionMap = {};
    recentCompletions.forEach((item) => {
      completionMap[item.task.toString()] = item.completedAt;
    });

    const availableTasks = [];
    const completedTasks = [];

    allPlanTasks.forEach((task) => {
      const completedTime = completionMap[task._id.toString()];
      if (completedTime) {
        const nextTime = new Date(new Date(completedTime).getTime() + 24 * 60 * 60 * 1000);
        const remainingMs = Math.max(0, nextTime.getTime() - Date.now());
        completedTasks.push({
          ...task.toObject(),
          completedAt: completedTime,
          nextAvailableAt: nextTime,
          remainingMs,
          remainingHours: Math.ceil(remainingMs / (1000 * 60 * 60)),
        });
      } else {
        availableTasks.push(task);
      }
    });

    return res.status(200).json({
      success: true,
      hasActivePlan: true,
      plan: user.plan,
      availableTasks,
      completedTasks,
      stats: {
        plan: user.plan,
        dailyLimit: user.dailyAdsLimit || allPlanTasks.length,
        totalPlanTasks: allPlanTasks.length,
        availableCount: availableTasks.length,
        completed24hCount: completedTasks.length,
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
    const { taskId, adId } = req.body;
    const targetTaskId = taskId || adId;

    if (!targetTaskId) {
      return res.status(400).json({
        success: false,
        message: "Task ID is required",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.plan || user.plan === "No Plan") {
      return res.status(400).json({
        success: false,
        message: "You must purchase a membership plan before performing tasks.",
      });
    }

    if (user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Your membership plan has expired. Please renew your plan.",
      });
    }

    const task = await Ad.findById(targetTaskId).populate("plan");
    if (!task || !task.isActive) {
      return res.status(404).json({
        success: false,
        message: "Task not found or is currently inactive",
      });
    }

    let userPlanId = user.planId;
    if (!userPlanId) {
      const matchedPlan = await Plan.findOne({
        $or: [{ name: user.plan }, { level: user.plan }],
      });
      if (matchedPlan) {
        userPlanId = matchedPlan._id;
        user.planId = matchedPlan._id;
        await user.save();
      }
    }

    const taskPlanId = task.plan?._id || task.plan;
    if (userPlanId && taskPlanId && taskPlanId.toString() !== userPlanId.toString()) {
      return res.status(403).json({
        success: false,
        message: "This task does not belong to your active membership plan tier.",
      });
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existingCompletion = await TaskCompletion.findOne({
      user: userId,
      task: task._id,
      completedAt: { $gte: twentyFourHoursAgo },
    });

    if (existingCompletion) {
      const nextTime = new Date(new Date(existingCompletion.completedAt).getTime() + 24 * 60 * 60 * 1000);
      const remainingHours = Math.ceil((nextTime.getTime() - Date.now()) / (1000 * 60 * 60));
      return res.status(400).json({
        success: false,
        message: `You already completed this task! It will become available again in ${remainingHours} hour(s).`,
      });
    }

    const reward = Number(task.reward) || 0.75;
    user.balance = Number((user.balance + reward).toFixed(2));
    user.completeTasks = (user.completeTasks || 0) + 1;
    await user.save();

    await TaskCompletion.create({
      user: userId,
      task: task._id,
      plan: task.plan?._id || task.plan,
      reward,
      completedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: `Task completed successfully! +$${reward.toFixed(2)} USDT added to your wallet.`,
      reward,
      link: task.link,
      user: {
        balance: user.balance,
        completeTasks: user.completeTasks,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllTasksAdmin = async (req, res) => {
  try {
    const tasks = await Ad.find().populate("plan", "name level dailyAdsLimit rewardPerAd").sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      tasks,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTaskByIdAdmin = async (req, res) => {
  try {
    const task = await Ad.findById(req.params.id).populate("plan");
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }
    return res.status(200).json({ success: true, task });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTaskAdmin = async (req, res) => {
  try {
    const { title, sponsor, link, reward, plan: planId, duration, isActive, image } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Task title is required" });
    }

    if (!link || !link.trim()) {
      return res.status(400).json({ success: false, message: "Task link is required" });
    }

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "You must select a Membership Plan for this task",
      });
    }

    const plan = await Plan.findById(planId);
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Selected membership plan was not found",
      });
    }

    const currentCount = await Ad.countDocuments({ plan: plan._id });
    const maxAllowed = Number(plan.dailyAdsLimit) || 1;

    if (currentCount >= maxAllowed) {
      return res.status(400).json({
        success: false,
        message: `Plan "${plan.name}" has a daily task limit of ${maxAllowed}. You cannot add more than ${maxAllowed} tasks for this plan.`,
      });
    }

    let imageUrl = image ? image.trim() : "";
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file.buffer);
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload task image",
        });
      }
    }

    const numReward = Number(reward) > 0 ? Number(reward) : Number(plan.rewardPerAd) || 0.75;

    const task = await Ad.create({
      title: title.trim(),
      sponsor: sponsor ? sponsor.trim() : "Nexora Partner",
      image: imageUrl,
      banner: imageUrl,
      link: link.trim(),
      reward: numReward,
      duration: Number(duration) || 5,
      plan: plan._id,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTaskAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, sponsor, link, reward, plan: planId, duration, isActive, image } = req.body;

    const task = await Ad.findById(id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (planId && planId.toString() !== task.plan.toString()) {
      const newPlan = await Plan.findById(planId);
      if (!newPlan) {
        return res.status(400).json({ success: false, message: "Target plan not found" });
      }

      const currentCountInNewPlan = await Ad.countDocuments({
        plan: newPlan._id,
        _id: { $ne: task._id },
      });
      const maxAllowed = Number(newPlan.dailyAdsLimit) || 1;

      if (currentCountInNewPlan >= maxAllowed) {
        return res.status(400).json({
          success: false,
          message: `Plan "${newPlan.name}" has a limit of ${maxAllowed} tasks. It already has ${currentCountInNewPlan} tasks.`,
        });
      }

      task.plan = newPlan._id;
    }

    if (title !== undefined) task.title = title.trim();
    if (sponsor !== undefined) task.sponsor = sponsor.trim();
    if (link !== undefined) task.link = link.trim();
    if (reward !== undefined) task.reward = Number(reward) || task.reward;
    if (duration !== undefined) task.duration = Number(duration) || task.duration;
    if (isActive !== undefined) task.isActive = Boolean(isActive);

    if (req.file) {
      try {
        const uploadedUrl = await uploadToCloudinary(req.file.buffer);
        task.image = uploadedUrl;
        task.banner = uploadedUrl;
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload task image",
        });
      }
    } else if (image !== undefined) {
      task.image = image.trim();
      task.banner = image.trim();
    }

    await task.save();

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTaskAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Ad.findByIdAndDelete(id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTaskHistoryAdmin = async (req, res) => {
  try {
    const { search, planId } = req.query;

    const query = {};
    if (planId) {
      query.plan = planId;
    }

    const history = await TaskCompletion.find(query)
      .populate("user", "name email phone profileImage plan")
      .populate("task", "title link image reward")
      .populate("plan", "name level")
      .sort({ completedAt: -1 })
      .limit(100);

    let filteredHistory = history;
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filteredHistory = history.filter((item) => {
        const userName = item.user?.name?.toLowerCase() || "";
        const userEmail = item.user?.email?.toLowerCase() || "";
        const userPhone = item.user?.phone?.toLowerCase() || "";
        const taskTitle = item.task?.title?.toLowerCase() || "";
        return (
          userName.includes(term) ||
          userEmail.includes(term) ||
          userPhone.includes(term) ||
          taskTitle.includes(term)
        );
      });
    }

    const totalCompletions = await TaskCompletion.countDocuments();
    const totalRewardsAgg = await TaskCompletion.aggregate([
      { $group: { _id: null, total: { $sum: "$reward" } } },
    ]);
    const totalRewards = totalRewardsAgg[0]?.total || 0;

    return res.status(200).json({
      success: true,
      history: filteredHistory,
      stats: {
        totalCompletions,
        totalRewards,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
