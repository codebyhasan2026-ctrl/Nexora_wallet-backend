const mongoose = require("mongoose");

const paymentGatewaySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    gatewayType: {
      type: String,
      default: "Personal",
      trim: true,
    },
    number: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    instruction: {
      type: String,
      default: "",
      trim: true,
    },
    minDeposit: {
      type: Number,
      default: 200,
    },
    maxDeposit: {
      type: Number,
      default: 50000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PaymentGateway", paymentGatewaySchema);

