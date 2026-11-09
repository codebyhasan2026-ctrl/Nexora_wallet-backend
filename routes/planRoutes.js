const express = require("express");
const router = express.Router();
const userAuth = require("../middleware/userAuth");
const adminAuth = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");
const {
  getPlans,
  getAllPlansAdmin,
  getPlanByIdAdmin,
  purchasePlan,
  createPlan,
  updatePlan,
  deletePlan,
} = require("../controllers/planController");

router.get("/", getPlans);
router.get("/admin/all", adminAuth, getAllPlansAdmin);
router.get("/admin/:id", adminAuth, getPlanByIdAdmin);
router.post("/purchase", userAuth, purchasePlan);

router.post("/admin", adminAuth, upload.single("image"), createPlan);
router.put("/admin/:id", adminAuth, upload.single("image"), updatePlan);
router.delete("/admin/:id", adminAuth, deletePlan);

module.exports = router;
