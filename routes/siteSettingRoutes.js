const express = require("express");
const {
  getSiteSettings,
  updateSiteLogo,
  updateSiteSettings,
  uploadPopupImage,
} = require("../controllers/siteSettingController");
const adminAuth = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/", getSiteSettings);
router.post("/logo", adminAuth, upload.single("logo"), updateSiteLogo);
router.put("/logo", adminAuth, upload.single("logo"), updateSiteLogo);
router.post("/popup-image", adminAuth, upload.single("popupImage"), uploadPopupImage);
router.put("/", adminAuth, updateSiteSettings);

module.exports = router;
