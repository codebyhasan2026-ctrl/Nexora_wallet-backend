const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    role: { type: String, default: "user" },
    isSuspended: { type: Boolean, default: false },

    balance: { type: Number, default: 0 },
    totalDeposit: { type: Number, default: 0 },
    totalWithdraw: { type: Number, default: 0 },

    plan: { type: String, default: "No Plan" },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan" },
    planValidity: { type: String, default: "N/A" },
    planExpiresAt: { type: Date },
    dailyAdsLimit: { type: Number, default: 0 },
    completeTasks: { type: Number, default: 0 },
    remainTasks: { type: Number, default: 0 },
    lastTaskResetDate: { type: String, default: "" },

    referralCode: { type: String },
    referredBy: { type: String },

    bio: { type: String },
    address: { type: String },
    country: { type: String },
    city: { type: String },
    zip: { type: String },
    profileImage: { type: String },
  },
  { timestamps: true }
);

userSchema.index({ name: 1, email: 1 });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model("User", userSchema);
