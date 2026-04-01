const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, index: true },
    stage: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  {
    versionKey: false,
  },
);

module.exports = mongoose.model("AuditLog", auditLogSchema);
