const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { uploadToCloudinary, deleteFromCloudinary } = require("../middleware/upload");

exports.register = async (req, res) => {
  try {
    const { name, username, email, phone, password, securityPassword, recomCode } = req.body;
    const finalName = username || name;
    const finalEmail = email || `${finalName.toLowerCase().replace(/[^a-z0-9]/g, "")}@nexorawallet.io`;

    const existEmail = await User.findOne({ email: finalEmail });
    if (existEmail)
      return res.status(400).json({ message: "User already exists with this username/email" });

    const existPhone = await User.findOne({ phone });
    if (existPhone)
      return res.status(400).json({ message: "Phone number already registered" });

    const user = await User.create({
      name: finalName,
      email: finalEmail,
      phone,
      password,
      referredBy: recomCode || "",
    });

    return res.status(201).json({
      message: "Registration Successful",
      userId: user._id,
    });
  } catch {
    return res.status(500).json({ message: "Register Failed" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Username/email and password required" });
    }

    const user = await User.findOne({
      $or: [
        { email: identifier },
        { name: identifier },
        { phone: identifier }
      ]
    });

    if (!user)
      return res.status(400).json({ message: "Invalid username or password" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Invalid username or password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: "Login Successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch {
    res.status(500).json({ message: "Login Failed" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Profile fetched successfully",
      user: req.user,
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, bio, address, country, city, zip, profileImage } =
      req.body;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, phone, bio, address, country, city, zip, profileImage },
      { new: true },
    ).select("-password");

    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch {
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

exports.uploadUserProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.profileImage && user.profileImage.includes("cloudinary")) {
      try {
        await deleteFromCloudinary(user.profileImage);
      } catch (err) {}
    }

    const imageUrl = await uploadToCloudinary(req.file.buffer);

    user.profileImage = imageUrl;
    await user.save();

    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).json({
      message: "Profile image updated successfully",
      profileImage: imageUrl,
      user: safeUser,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to upload profile image" });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to change password" });
  }
};
