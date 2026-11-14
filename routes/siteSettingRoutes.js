const express = require("express");
const {
  getSiteSettings,
  updateSiteLogo,
  updateSiteSettings,
  uploadPopupImage,
  uploadContactImage,
} = require("../controllers/siteSettingController");
const adminAuth = require("../middleware/adminAuth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/", getSiteSettings);
router.post("/logo", adminAuth, upload.single("logo"), updateSiteLogo);
router.put("/logo", adminAuth, upload.single("logo"), updateSiteLogo);
router.post("/popup-image", adminAuth, upload.single("popupImage"), uploadPopupImage);
router.post("/contact-image", adminAuth, upload.single("contactImage"), uploadContactImage);
router.put("/", adminAuth, updateSiteSettings);

module.exports = router;
