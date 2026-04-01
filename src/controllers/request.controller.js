const Request = require("../models/request.model");
const AuditLog = require("../models/auditlog.model");
const { evaluateRules } = require("../engine/ruleEngine");

async function addAuditLog(requestId, stage, action, details = {}) {
  await AuditLog.create({
    requestId,
    stage,
    action,
    details,
    timestamp: new Date(),
  });
}

async function checkExternalCredit() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return Math.random() > 0.3;
}

function validatePayload(body) {
  const { requestId, applicantName, data } = body;

  return !!requestId && !!applicantName && !!data;
}

async function submitRequest(req, res) {
  try {
    if (!validatePayload(req.body)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { requestId, applicantName, data } = req.body;

    const existing = await Request.findOne({ requestId });
    if (existing) {
      return res.status(200).json(existing);
    }

    const requestDoc = new Request({
      requestId,
      applicantName,
      data,
      status: "pending",
      stateHistory: [
        { stage: "intake", status: "pending", timestamp: new Date() },
      ],
    });

    await addAuditLog(requestId, "intake", "request_received", {
      applicantName,
      data,
    });

    // Evaluate rules
    const ruleResult = evaluateRules(data);
    requestDoc.rulesEvaluated = ruleResult.evaluations;

    await addAuditLog(requestId, "rules_check", "rules_evaluated", {
      decisionFromRules: ruleResult.decision,
      rulesEvaluated: ruleResult.evaluations,
    });

    if (ruleResult.decision === "rejected") {
      requestDoc.status = "rejected";
      requestDoc.decision = "rejected";
      requestDoc.stateHistory.push({
        stage: "decision",
        status: "rejected",
        timestamp: new Date(),
      });

      await addAuditLog(requestId, "decision", "request_rejected", {
        reason: "One or more rules failed",
      });

      await requestDoc.save();

      return res.status(201).json(requestDoc);
    }

    let externalCheckPassed = false;
    try {
      externalCheckPassed = await checkExternalCredit();
    } catch (error) {
      externalCheckPassed = false;
    }

    await addAuditLog(requestId, "external_check", "external_credit_checked", {
      passed: externalCheckPassed,
    });

    if (!externalCheckPassed) {
      requestDoc.status = "manual-review";
      requestDoc.decision = "manual-review";
      requestDoc.stateHistory.push({
        stage: "decision",
        status: "manual-review",
        timestamp: new Date(),
      });

      await addAuditLog(requestId, "decision", "manual_review_required", {
        reason: "External credit check failed",
      });
    } else {
      requestDoc.status = "approved";
      requestDoc.decision = "approved";
      requestDoc.stateHistory.push({
        stage: "decision",
        status: "approved",
        timestamp: new Date(),
      });

      await addAuditLog(requestId, "decision", "request_approved", {
        reason: "All rules and external checks passed",
      });
    }

    await requestDoc.save();

    return res.status(201).json(requestDoc);
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getRequestById(req, res) {
  try {
    const { id } = req.params;

    const requestDoc = await Request.findOne({ requestId: id });
    if (!requestDoc) {
      return res.status(404).json({ message: "Request not found" });
    }

    return res.status(200).json(requestDoc);
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
}

async function getAuditByRequestId(req, res) {
  try {
    const { requestId } = req.params;

    const logs = await AuditLog.find({ requestId }).sort({ timestamp: 1 });

    return res.status(200).json({
      requestId,
      totalLogs: logs.length,
      logs,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
}

module.exports = {
  submitRequest,
  getRequestById,
  getAuditByRequestId,
};
