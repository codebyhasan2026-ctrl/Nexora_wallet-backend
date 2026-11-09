const express = require("express");
const {
  createDeposit,
  getUserDeposits,
  getAllDepositsAdmin,
  getDepositByIdAdmin,
  approveDepositAdmin,
  rejectDepositAdmin,
} = require("../controllers/depositController");
const userAuth = require("../middleware/userAuth");
const adminAuth = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.post("/", userAuth, upload.single("screenshot"), createDeposit);
router.get("/my", userAuth, getUserDeposits);

router.get("/admin/all", adminAuth, getAllDepositsAdmin);
router.get("/admin/:id", adminAuth, getDepositByIdAdmin);
router.put("/admin/:id/approve", adminAuth, approveDepositAdmin);
router.put("/admin/:id/reject", adminAuth, rejectDepositAdmin);

module.exports = router;

