const express = require("express");
const router = express.Router();
const userAuth = require("../middleware/userAuth");
const adminAuth = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");
const {
  getTasks,
  completeTask,
  getAllTasksAdmin,
  getTaskByIdAdmin,
  createTaskAdmin,
  updateTaskAdmin,
  deleteTaskAdmin,
  getTaskHistoryAdmin,
} = require("../controllers/taskController");

router.get("/", userAuth, getTasks);
router.post("/complete", userAuth, completeTask);

router.get("/admin/all", adminAuth, getAllTasksAdmin);
router.get("/admin/history", adminAuth, getTaskHistoryAdmin);
router.get("/admin/:id", adminAuth, getTaskByIdAdmin);
router.post("/admin", adminAuth, upload.single("image"), createTaskAdmin);
router.put("/admin/:id", adminAuth, upload.single("image"), updateTaskAdmin);
router.delete("/admin/:id", adminAuth, deleteTaskAdmin);

module.exports = router;
