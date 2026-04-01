# Loan Approval Workflow System

A production-ready Node.js REST API for processing loan applications with configurable business rules, automatic retries, and full audit logging.

## Features

- **Configurable Rules Engine** – Change approval logic via JSON, no code redeployment needed
- **Idempotent Processing** – Request deduplication prevents duplicate processing
- **Resilient External Integration** – Exponential backoff retry logic for external services
- **Complete Audit Trail** – Full decision trace with reasoning and timeline
- **Decision Explanations** – Explainable outcomes with rule-by-rule breakdown
- **Error Handling** – Graceful degradation with fallback to manual review

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js (REST API)
- **Database:** MongoDB + Mongoose
- **Config:** JSON-based workflow rules

## Setup

### Prerequisites

- Node.js v14+
- MongoDB (running locally or provide URI)

### Installation

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env and add your MongoDB URI
```

### Run

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

## API Endpoints

### Submit Application

```
POST /api/request
```

Submit a loan application for processing through the approval workflow.

**Request:**

```json
{
  "requestId": "unique-id-123",
  "applicantName": "John Doe",
  "data": {
    "age": 35,
    "salary": 75000,
    "creditScore": 720
  }
}
```

**Response:**

```json
{
  "status": "approved",
  "decision": "approved",
  "rulesEvaluated": [...],
  "stateHistory": [...]
}
```

### Get Request Details

```
GET /api/request/:requestId
```

Retrieve full details of a processed application.

### Get Audit Trail

```
GET /api/audit/:requestId
```

Get complete audit log of all decisions and state changes.

### Get Decision Explanation

```
GET /api/decision-explanation/:requestId
```

Get human-readable explanation of the approval/rejection decision.

## Configuration

Edit `src/config/workflow.config.json` to change:

- Approval rules (age, salary, credit score thresholds)
- Workflow stages and transitions

Example:

```json
{
  "rules": [
    {
      "name": "Age Check",
      "field": "age",
      "operator": "gt",
      "value": 18
    }
  ]
}
```

## Testing

```bash
npm test
```

Runs 13 comprehensive test scenarios covering:

- Happy path (approval)
- Validation failures
- External service retries
- Idempotency
- Audit logging
- Decision explanations

## Project Structure

```
src/
├── app.js                    # Express server setup
├── controllers/              # Business logic
├── models/                   # MongoDB schemas
├── routes/                   # API endpoints
├── engine/                   # Rule evaluation engine
├── config/                   # Configuration files
└── tests/                    # Test suite
```

## License

MIT
