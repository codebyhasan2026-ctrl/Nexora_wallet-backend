const express = require("express");
const {
  getActiveBanners,
  getAllBannersAdmin,
  createBannerAdmin,
  updateBannerAdmin,
  deleteBannerAdmin,
  toggleBannerStatusAdmin,
} = require("../controllers/bannerController");
const adminAuth = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/", getActiveBanners);

router.get("/admin/all", adminAuth, getAllBannersAdmin);
router.post("/admin", adminAuth, upload.single("image"), createBannerAdmin);
router.put("/admin/:id", adminAuth, upload.single("image"), updateBannerAdmin);
router.delete("/admin/:id", adminAuth, deleteBannerAdmin);
router.patch("/admin/:id/toggle", adminAuth, toggleBannerStatusAdmin);

module.exports = router;
