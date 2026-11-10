const mongoose = require("mongoose");

const taskCompletionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ad",
      required: true,
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      index: true,
    },
    reward: {
      type: Number,
      required: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

taskCompletionSchema.index({ user: 1, task: 1, completedAt: -1 });

module.exports = mongoose.model("TaskCompletion", taskCompletionSchema);

