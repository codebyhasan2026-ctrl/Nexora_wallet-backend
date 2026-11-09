const express = require("express");
const {
  register,
  login,
  getProfile,
  updateProfile,
  uploadUserProfileImage,
  changePassword,
} = require("../controllers/authController");
const userAuth = require("../middleware/userAuth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", userAuth, getProfile);
router.put("/profile/update", userAuth, updateProfile);
router.put("/change-password", userAuth, changePassword);
router.post("/change-password", userAuth, changePassword);
router.post(
  "/profile/upload-image",
  userAuth,
  upload.single("profileImage"),
  uploadUserProfileImage
);

module.exports = router;