const express = require("express");
const router = express.Router();
const userAuth = require("../middleware/userAuth");
const adminAuth = require("../middleware/adminAuth");
const {
  getPlans,
  purchasePlan,
  createPlan,
  updatePlan,
  deletePlan,
} = require("../controllers/planController");

router.get("/", getPlans);
router.post("/purchase", userAuth, purchasePlan);

router.post("/admin", adminAuth, createPlan);
router.put("/admin/:id", adminAuth, updatePlan);
router.delete("/admin/:id", adminAuth, deletePlan);

module.exports = router;

