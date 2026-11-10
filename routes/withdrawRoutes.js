const express = require("express");
const {
  createWithdraw,
  getUserWithdrawals,
  getAllWithdrawalsAdmin,
  getWithdrawalByIdAdmin,
  approveWithdrawalAdmin,
  rejectWithdrawalAdmin,
} = require("../controllers/withdrawController");
const userAuth = require("../middleware/userAuth");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

router.post("/create", userAuth, createWithdraw);
router.get("/my", userAuth, getUserWithdrawals);

router.get("/admin/all", adminAuth, getAllWithdrawalsAdmin);
router.get("/admin/:id", adminAuth, getWithdrawalByIdAdmin);
router.put("/admin/:id/approve", adminAuth, approveWithdrawalAdmin);
router.put("/admin/:id/reject", adminAuth, rejectWithdrawalAdmin);

module.exports = router;

