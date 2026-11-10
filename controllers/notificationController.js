const Notification = require("../models/notification");
const User = require("../models/user");

exports.getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch notifications." });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update notifications." });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update notification." });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Notification.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.status(200).json({
      success: true,
      message: "Notification removed.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete notification." });
  }
};

exports.clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });

    return res.status(200).json({
      success: true,
      message: "All notifications cleared.",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to clear notifications." });
  }
};

exports.broadcastAdminNotification = async (req, res) => {
  try {
    const { title, message, targetUserId, type } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required." });
    }

    if (targetUserId) {
      const user = await User.findById(targetUserId);
      if (!user) {
        return res.status(404).json({ message: "Target user not found." });
      }

      await Notification.create({
        user: targetUserId,
        title: title.trim(),
        message: message.trim(),
        type: type || "system",
      });

      return res.status(201).json({
        success: true,
        message: `Notification sent to user ${user.name}.`,
      });
    }

    const users = await User.find({}, "_id");
    if (!users.length) {
      return res.status(200).json({ message: "No users found to notify." });
    }

    const docs = users.map((u) => ({
      user: u._id,
      title: title.trim(),
      message: message.trim(),
      type: type || "system",
    }));

    await Notification.insertMany(docs);

    return res.status(201).json({
      success: true,
      message: `Notification broadcasted to ${docs.length} users.`,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to broadcast notification.",
      error: error.message,
    });
  }
};

