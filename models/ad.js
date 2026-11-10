const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    sponsor: { type: String, default: "Nexora Partner", trim: true },
    image: { type: String, default: "", trim: true },
    banner: { type: String, default: "", trim: true },
    link: { type: String, required: true, trim: true },
    reward: { type: Number, required: true },
    duration: { type: Number, default: 5 },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ad", adSchema);
