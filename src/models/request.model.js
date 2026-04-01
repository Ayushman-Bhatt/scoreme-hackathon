const mongoose = require("mongoose");

const ruleEvaluationSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    operator: { type: String, enum: ["gt", "lt", "eq"], required: true },
    expectedValue: { type: mongoose.Schema.Types.Mixed, required: true },
    actualValue: { type: mongoose.Schema.Types.Mixed },
    passed: { type: Boolean, required: true },
  },
  { _id: false },
);

const stateHistorySchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "manual-review"],
      required: true,
    },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

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
    rulesEvaluated: { type: [ruleEvaluationSchema], default: [] },
    stateHistory: { type: [stateHistorySchema], default: [] },
    retryCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Request", requestSchema);
