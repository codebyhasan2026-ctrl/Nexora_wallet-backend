const express = require("express");
const {
  getMyReferralTeam,
  getMyCommissions,
} = require("../controllers/referralController");
const userAuth = require("../middleware/userAuth");

const router = express.Router();

router.get("/team", userAuth, getMyReferralTeam);
router.get("/commissions", userAuth, getMyCommissions);

module.exports = router;

