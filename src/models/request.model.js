const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    applicantName: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "manual-review"],
      default: "pending",
    },
    decision: {
      type: String,
      enum: ["approved", "rejected", "manual-review"],
      default: null,
    },
    rulesEvaluated: { type: [mongoose.Schema.Types.Mixed], default: [] },
    stateHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Request", requestSchema);
