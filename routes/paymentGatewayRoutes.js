const express = require("express");
const {
  getActiveGateways,
  getAllGatewaysAdmin,
  createGatewayAdmin,
  updateGatewayAdmin,
  deleteGatewayAdmin,
} = require("../controllers/paymentGatewayController");
const adminAuth = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/", getActiveGateways);
router.get("/admin/all", adminAuth, getAllGatewaysAdmin);
router.post("/admin", adminAuth, upload.single("logo"), createGatewayAdmin);
router.put("/admin/:id", adminAuth, upload.single("logo"), updateGatewayAdmin);
router.delete("/admin/:id", adminAuth, deleteGatewayAdmin);

module.exports = router;

