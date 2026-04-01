const express = require("express");
const {
  submitRequest,
  getRequestById,
  getAuditByRequestId,
} = require("../controllers/request.controller");

const router = express.Router();

router.post("/request", submitRequest);
router.get("/request/:id", getRequestById);
router.get("/audit/:requestId", getAuditByRequestId);

module.exports = router;
