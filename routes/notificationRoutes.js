const express = require("express");
const router = express.Router();
const userAuth = require("../middleware/userAuth");
const adminAuth = require("../middleware/adminAuth");
const {
  getUserNotifications,
  markAllAsRead,
  markAsRead,
  deleteNotification,
  clearAllNotifications,
  broadcastAdminNotification,
} = require("../controllers/notificationController");

router.get("/", userAuth, getUserNotifications);
router.patch("/read-all", userAuth, markAllAsRead);
router.patch("/:id/read", userAuth, markAsRead);
router.delete("/:id", userAuth, deleteNotification);
router.delete("/", userAuth, clearAllNotifications);

router.post("/broadcast", adminAuth, broadcastAdminNotification);

module.exports = router;

