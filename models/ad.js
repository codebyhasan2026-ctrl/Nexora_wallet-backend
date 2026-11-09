const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    sponsor: { type: String, required: true },
    banner: { type: String, default: "" },
    link: { type: String, default: "" },
    reward: { type: Number, required: true },
    duration: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ad", adSchema);

