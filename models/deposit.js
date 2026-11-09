const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    gateway: {
      type: String,
      required: true,
      trim: true,
      default: "bkash",
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    senderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    trxId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    screenshot: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
    },
    reviewedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Deposit", depositSchema);

