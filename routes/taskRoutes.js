const express = require("express");
const router = express.Router();
const userAuth = require("../middleware/userAuth");
const adminAuth = require("../middleware/adminAuth");
const {
  getTasks,
  completeTask,
  createAd,
} = require("../controllers/taskController");

router.get("/", userAuth, getTasks);
router.post("/complete", userAuth, completeTask);
router.post("/admin/ad", adminAuth, createAd);

module.exports = router;

