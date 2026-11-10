const express = require("express");
const router = express.Router();
const userAuth = require("../middleware/userAuth");
const adminAuth = require("../middleware/adminAuth");
const {
  redeemPromoCode,
  getMyRedeemedCodes,
  getAdminPromoCodes,
  getAdminRedemptionHistory,
  createPromoCode,
  togglePromoCode,
  deletePromoCode,
} = require("../controllers/promoCodeController");

router.post("/redeem", userAuth, redeemPromoCode);
router.get("/my-history", userAuth, getMyRedeemedCodes);

router.get("/admin", adminAuth, getAdminPromoCodes);
router.get("/admin/history", adminAuth, getAdminRedemptionHistory);
router.post("/admin", adminAuth, createPromoCode);
router.patch("/admin/:id/toggle", adminAuth, togglePromoCode);
router.delete("/admin/:id", adminAuth, deletePromoCode);

module.exports = router;

