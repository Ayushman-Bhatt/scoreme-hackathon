const express = require("express");
const {
  submitRequest,
  getRequestById,
  getAuditByRequestId,
  getDecisionExplanation,
} = require("../controllers/request.controller");

const router = express.Router();

router.post("request", submitRequest);
router.get("request/:id", getRequestById);
router.get("audit/:requestId", getAuditByRequestId);
router.get("decision-explanation/:requestId", getDecisionExplanation);

module.exports = router;
