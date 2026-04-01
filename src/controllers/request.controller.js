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

async function runExternalCheckWithRetry(
  maxRetries = 2,
  checkFn = checkExternalCredit,
) {
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const passed = await checkFn();
      return { passed, attempts: attempt + 1, failedByError: false };
    } catch (error) {
      if (attempt === maxRetries) {
        return { passed: false, attempts: attempt + 1, failedByError: true };
      }
    }
  }

  return { passed: false, attempts: maxRetries + 1, failedByError: true };
}

function validatePayload(body) {
  const { requestId, applicantName, data } = body;
  return Boolean(
    typeof requestId === "string" &&
    typeof applicantName === "string" &&
    data &&
    typeof data === "object" &&
    !Array.isArray(data),
  );
}

function pushState(stateHistory, stage, status) {
  stateHistory.push({ stage, status, timestamp: new Date() });
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

    const requestDoc = {
      requestId,
      applicantName,
      data,
      status: "pending",
      decision: null,
      rulesEvaluated: [],
      stateHistory: [],
    };
    pushState(requestDoc.stateHistory, "intake", "pending");

    await addAuditLog(requestId, "intake", "request_received", {
      applicantName,
      data,
    });

    const ruleResult = evaluateRules(data);
    requestDoc.rulesEvaluated = ruleResult.evaluations;

    await addAuditLog(requestId, "rules_check", "rules_evaluated", {
      decisionFromRules: ruleResult.decision,
      rulesEvaluated: ruleResult.evaluations,
    });

    if (ruleResult.decision === "rejected") {
      requestDoc.status = "rejected";
      requestDoc.decision = "rejected";
      pushState(requestDoc.stateHistory, "decision", "rejected");

      await addAuditLog(requestId, "decision", "request_rejected", {
        reason: "One or more rules failed",
      });

      const savedRejected = await Request.create(requestDoc);
      return res.status(201).json(savedRejected);
    }

    const externalResult = await runExternalCheckWithRetry();

    await addAuditLog(requestId, "external_check", "external_credit_checked", {
      passed: externalResult.passed,
      attempts: externalResult.attempts,
      failedByError: externalResult.failedByError,
    });

    if (!externalResult.passed) {
      requestDoc.status = "manual-review";
      requestDoc.decision = "manual-review";
      pushState(requestDoc.stateHistory, "decision", "manual-review");

      await addAuditLog(requestId, "decision", "manual_review_required", {
        reason: "External credit check failed",
      });
    } else {
      requestDoc.status = "approved";
      requestDoc.decision = "approved";
      pushState(requestDoc.stateHistory, "decision", "approved");

      await addAuditLog(requestId, "decision", "request_approved", {
        reason: "All rules and external checks passed",
      });
    }

    const saved = await Request.create(requestDoc);
    return res.status(201).json(saved);
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
  validatePayload,
  runExternalCheckWithRetry,
};
