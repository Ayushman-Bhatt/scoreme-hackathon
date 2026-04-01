const Request = require("../models/request.model");
const AuditLog = require("../models/auditlog.model");
const { evaluateRules } = require("../engine/ruleEngine");

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS) || 1000;

async function addAuditLog(requestId, stage, action, details = {}) {
  try {
    await AuditLog.create({
      requestId,
      stage,
      action,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error(
      `Failed to create audit log for ${requestId}:`,
      error.message,
    );
    throw error;
  }
}

async function checkExternalCredit(retryCount = 0) {
  try {
    // Simulate external API call with potential failures
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 30% failure rate for simulation
    if (Math.random() > 0.7) {
      throw new Error("External credit service temporarily unavailable");
    }
    return Math.random() > 0.3;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(
        `External credit check failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * (retryCount + 1)),
      );
      return checkExternalCredit(retryCount + 1);
    }
    throw error;
  }
}

function validatePayload(body) {
  const { requestId, applicantName, data } = body;

  if (!requestId || typeof requestId !== "string") {
    return "requestId is required and must be a string";
  }

  if (!applicantName || typeof applicantName !== "string") {
    return "applicantName is required and must be a string";
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "data is required and must be an object";
  }

  return null;
}

async function submitRequest(req, res) {
  try {
    const validationError = validatePayload(req.body);
    if (validationError) {
      return res.status(400).json({
        message: validationError,
        code: "VALIDATION_ERROR",
      });
    }

    const { requestId, applicantName, data } = req.body;

    // Idempotency: check if request already processed
    const existing = await Request.findOne({ requestId });
    if (existing) {
      return res.status(200).json({
        message: "Request already processed (idempotent)",
        data: existing,
      });
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

    // If rules rejected, save and return
    if (ruleResult.decision === "rejected") {
      requestDoc.status = "rejected";
      requestDoc.decision = "rejected";
      requestDoc.retryCount = 0;
      requestDoc.stateHistory.push({
        stage: "decision",
        status: "rejected",
        timestamp: new Date(),
      });

      await addAuditLog(requestId, "decision", "request_rejected", {
        reason: "One or more rules failed",
        failedRules: ruleResult.evaluations.filter((e) => !e.passed),
      });

      await requestDoc.save();

      return res.status(201).json(requestDoc);
    }

    // Try external credit check with retry logic
    let externalCheckPassed = false;
    let externalError = null;
    try {
      externalCheckPassed = await checkExternalCredit();
      requestDoc.retryCount = 0;
    } catch (error) {
      externalError = error.message;
      requestDoc.retryCount = MAX_RETRIES;
    }

    await addAuditLog(requestId, "external_check", "external_credit_checked", {
      passed: externalCheckPassed,
      error: externalError,
      retryAttempts: requestDoc.retryCount,
    });

    // Determine final status
    if (externalError) {
      requestDoc.status = "manual-review";
      requestDoc.decision = "manual-review";
      requestDoc.stateHistory.push({
        stage: "decision",
        status: "manual-review",
        timestamp: new Date(),
      });

      await addAuditLog(requestId, "decision", "manual_review_required", {
        reason: "External credit check failed after retries",
        error: externalError,
      });
    } else if (!externalCheckPassed) {
      requestDoc.status = "manual-review";
      requestDoc.decision = "manual-review";
      requestDoc.stateHistory.push({
        stage: "decision",
        status: "manual-review",
        timestamp: new Date(),
      });

      await addAuditLog(requestId, "decision", "manual_review_required", {
        reason: "External credit check validation failed",
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
    console.error("Submit request error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
      code: "INTERNAL_ERROR",
    });
  }
}

async function getRequestById(req, res) {
  try {
    const { id } = req.params;

    const requestDoc = await Request.findOne({ requestId: id });
    if (!requestDoc) {
      return res.status(404).json({
        message: "Request not found",
        code: "NOT_FOUND",
      });
    }

    return res.status(200).json(requestDoc);
  } catch (error) {
    console.error("Get request error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
      code: "INTERNAL_ERROR",
    });
  }
}

async function getAuditByRequestId(req, res) {
  try {
    const { requestId } = req.params;

    const logs = await AuditLog.find({ requestId }).sort({ timestamp: 1 });

    if (!logs.length) {
      return res.status(404).json({
        message: "No audit logs found for this request",
        requestId,
        code: "NOT_FOUND",
      });
    }

    return res.status(200).json({
      requestId,
      totalLogs: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Get audit error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
      code: "INTERNAL_ERROR",
    });
  }
}

// New endpoint: Get decision explanation
async function getDecisionExplanation(req, res) {
  try {
    const { requestId } = req.params;

    const requestDoc = await Request.findOne({ requestId });
    if (!requestDoc) {
      return res.status(404).json({
        message: "Request not found",
        code: "NOT_FOUND",
      });
    }

    const auditLogs = await AuditLog.find({ requestId }).sort({ timestamp: 1 });

    const explanation = {
      requestId,
      applicantName: requestDoc.applicantName,
      inputData: requestDoc.data,
      finalDecision: requestDoc.decision,
      finalStatus: requestDoc.status,
      rulesEvaluated: requestDoc.rulesEvaluated.map((rule) => ({
        field: rule.field,
        operator: rule.operator,
        expectedValue: rule.expectedValue,
        actualValue: rule.actualValue,
        result: rule.passed ? "PASS" : "FAIL",
      })),
      stateTransitions: requestDoc.stateHistory,
      auditTrail: auditLogs.map((log) => ({
        stage: log.stage,
        action: log.action,
        timestamp: log.timestamp,
        details: log.details,
      })),
      reasoning: generateReasoning(requestDoc, auditLogs),
    };

    return res.status(200).json(explanation);
  } catch (error) {
    console.error("Decision explanation error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
      code: "INTERNAL_ERROR",
    });
  }
}

// Helper to generate human-readable decision reasoning
function generateReasoning(requestDoc, auditLogs) {
  const failedRules = requestDoc.rulesEvaluated
    .filter((r) => !r.passed)
    .map(
      (r) =>
        `${r.field} ${r.operator} ${r.expectedValue} (actual: ${r.actualValue})`,
    );

  const decisions = [];
  decisions.push(
    `Initial Rules Check: ${requestDoc.rulesEvaluated.every((r) => r.passed) ? "PASSED" : "FAILED"}`,
  );

  if (failedRules.length > 0) {
    decisions.push(`Failed Rules: ${failedRules.join(", ")}`);
  }

  const externalCheckLog = auditLogs.find(
    (log) => log.action === "external_credit_checked",
  );
  if (externalCheckLog) {
    decisions.push(
      `External Check: ${externalCheckLog.details.passed ? "PASSED" : "FAILED"} ${externalCheckLog.details.error ? `(Error: ${externalCheckLog.details.error})` : ""}`,
    );
  }

  decisions.push(`Final Decision: ${requestDoc.decision.toUpperCase()}`);

  return decisions;
}

module.exports = {
  submitRequest,
  getRequestById,
  getAuditByRequestId,
  getDecisionExplanation,
};
