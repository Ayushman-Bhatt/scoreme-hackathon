# Architecture Document

## 1) Goal

Build a simple configurable workflow decision platform that can process requests for multiple business use cases with minimum code changes.

## 2) High-Level Design

- API Layer (Express routes)
- Workflow Layer (controller + rule engine)
- Persistence Layer (MongoDB models)
- Config Layer (workflow.config.json)

## 3) Data Flow

1. Client sends POST /api/request.
2. Controller validates required schema.
3. Idempotency check on requestId.
4. Rules engine evaluates configured rules.
5. If rules fail: reject.
6. If rules pass: external dependency check with retry.
7. Final decision stored with state history.
8. Audit events stored for each stage.

## 4) Components

- src/routes/request.routes.js: endpoint mapping.
- src/controllers/request.controller.js: workflow execution and error handling.
- src/engine/ruleEngine.js: configurable rule evaluation.
- src/models/request.model.js: request lifecycle state.
- src/models/auditlog.model.js: full audit trail.
- src/config/workflow.config.json: workflow and rules.

## 5) Tradeoffs and Assumptions

- Kept schema simple (Mixed arrays) for faster requirement changes.
- Uses synchronous workflow for beginner readability over advanced queueing.
- External dependency is simulated; in production this should be a real service call.

## 6) Failure Handling

- Duplicate requests return existing result (idempotent).
- External dependency errors are retried and then routed to manual-review.
- All controllers are wrapped in try/catch.

## 7) Configurability

Rules and stages are read from JSON config. Threshold and workflow changes do not require controller rewrite.

## 8) Scaling Considerations

- Add indexes on frequently queried fields (already indexed requestId).
- Move external checks to async workers/queue for high throughput.
- Add transactional writes for strict multi-document consistency.
- Introduce API pagination for large audit histories.
