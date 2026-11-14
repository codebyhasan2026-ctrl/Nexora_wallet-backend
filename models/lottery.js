const mongoose = require("mongoose");

const prizeSchema = new mongoose.Schema({
  rank: { type: Number, required: true },
  name: { type: String, required: true, trim: true },
  rewardType: {
    type: String,
    enum: ["cash", "product"],
    default: "cash",
  },
  rewardAmount: { type: Number, default: 0 },
  productTitle: { type: String, default: "", trim: true },
  productImage: { type: String, default: "", trim: true },
  winnerUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  winnerTicket: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LotteryTicket",
    default: null,
  },
  winnerTicketNumber: { type: String, default: "" },
});

const lotterySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    image: { type: String, default: "", trim: true },
    ticketPrice: { type: Number, required: true, min: 1 },
    totalTickets: { type: Number, default: 0 },
    soldTicketsCount: { type: Number, default: 0 },
    drawDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "drawn", "cancelled"],
      default: "active",
      index: true,
    },
    drawType: {
      type: String,
      enum: ["auto", "manual", "none"],
      default: "none",
    },
    drawnAt: { type: Date, default: null },
    prizes: [prizeSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lottery", lotterySchema);

