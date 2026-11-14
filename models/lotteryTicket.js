const mongoose = require("mongoose");

const lotteryTicketSchema = new mongoose.Schema(
  {
    lottery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lottery",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ticketNumber: {
      type: String,
      required: true,
      index: true,
    },
    purchasePrice: {
      type: Number,
      required: true,
    },
    isWinner: {
      type: Boolean,
      default: false,
      index: true,
    },
    prizeRank: { type: Number, default: null },
    prizeName: { type: String, default: "" },
    prizeType: { type: String, default: "" },
    prizeValue: { type: String, default: "" },
    purchasedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

lotteryTicketSchema.index({ lottery: 1, ticketNumber: 1 }, { unique: true });

module.exports = mongoose.model("LotteryTicket", lotteryTicketSchema);

