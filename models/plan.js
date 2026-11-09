const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    level: { type: String, default: "VIP 1" },
    price: { type: Number, required: true },
    currency: { type: String, default: "USDT" },
    validity: { type: Number, required: true },
    dailyAdsLimit: { type: Number, required: true },
    rewardPerAd: { type: Number, required: true },
    dailyIncome: { type: Number, default: 0 },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Plan", planSchema);

