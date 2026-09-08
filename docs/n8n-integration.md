# StartupCrème AI Engine — n8n Control Plane Integration Guide

## 1. Architectural Philosophy & Trust Boundary

StartupCrème implements a strict **Controlled Execution Model**:
* **n8n Role**: High-level workflow scheduler, external trigger listener, and state coordinator.
* **StartupCrème Role**: The single, authoritative execution runtime housing the Editorial Constitution, Policy Engine, Gemini research agents, and audit database.

### Strict Non-Negotiable Boundaries
1. **No Direct Database Credentials**: n8n must **never** receive direct PostgreSQL connection strings, Supabase credentials, or `service_role` keys. All mutations flow through validated HTTP REST APIs.
2. **Policy Engine Primacy**: n8n workflows can never bypass the 3-tier policy engine:
   - **GREEN**: Autonomous execution allowed (e.g. `research_topic`, `suggest_seo_metadata`).
   - **YELLOW**: Pauses in `waiting_approval` requiring human sign-off before execution (e.g. `publish_article`, `archive_article`).
   - **RED**: Strictly forbidden actions rejected immediately with critical audit alerts (e.g. `delete_database_schema`, `execute_raw_sql`).
3. **Controlled Tool Gateway**: n8n cannot execute arbitrary commands or unregistered tools. Only tools formally cataloged in `ToolRegistry` are executable.
4. **Prompt Injection Defense**: External inputs (RSS feeds, competitor sites, user comments) must be treated as untrusted data and parsed through schema validators before submission.

---

## 2. Authentication & Correlation Headers

Every request from n8n to StartupCrème must provide authentication and correlation tracking headers.

### Headers Specification
| Header Name | Required | Description |
| :--- | :--- | :--- |
| `x-automation-secret` | **Yes** (or Bearer) | Pre-shared token configured in `STARTUPCREME_AUTOMATION_SECRET`. |
| `Authorization` | Alternative | Standard `Bearer <token>` format. |
| `Idempotency-Key` | Recommended | Unique key (e.g. `n8n-{{$execution.id}}-task`) to prevent duplicate runs on network retries. |
| `x-request-id` | Recommended | UUID tracing a single HTTP round-trip. |
| `x-workflow-id` | Optional | n8n workflow identifier (e.g. `wf_market_scan_01`). |
| `x-execution-id` | Optional | n8n execution run identifier (e.g. `{{$execution.id}}`). |

---

## 3. Endpoints Reference

### 3.1 Health Check & Diagnostic
* **Method**: `GET /api/ai/health`
* **Purpose**: Subsystem readiness, memory size, active policy levels, and Supabase persistence status.

```bash
curl -X GET "http://localhost:3000/api/ai/health" \
  -H "x-automation-secret: YOUR_SECRET"
```

---

### 3.2 Submit Task (Asynchronous)
* **Method**: `POST /api/ai/tasks`
* **Status Code**: `202 Accepted` (or `200 OK` if existing idempotent task returned)
* **Payload Format**: Supports both `camelCase` and `snake_case`.

#### Request Body
```json
{
  "taskType": "research_topic",
  "priority": "high",
  "assignedAgent": "agent_research",
  "idempotencyKey": "n8n_exec_9812_research",
  "payload": {
    "topic": "Venture Debt in African Tech Startups",
    "vertical": "finance",
    "depth": "deep"
  },
  "webhookUrl": "https://n8n.yourdomain.com/webhook/ai-task-completed",
  "timeoutMs": 60000
}
```

#### Response (202 Accepted)
```json
{
  "taskId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "taskType": "research_topic",
  "status": "running",
  "priority": "high",
  "policyLevel": "green",
  "isExisting": false,
  "pollUrl": "/api/ai/tasks/7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "correlation": {
    "requestId": "req_1a2b3c",
    "workflowId": "wf_market_scan_01",
    "executionId": "exec_9812"
  },
  "task": { ... }
}
```

---

### 3.3 Polling Task Status
* **Method**: `GET /api/ai/tasks/:taskId`
* **Status Code**: `200 OK` (or `404 Not Found`)

#### Response Envelope
```json
{
  "taskId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "taskType": "research_topic",
  "status": "completed",
  "priority": "high",
  "policyLevel": "green",
  "correlation": { ... },
  "timestamps": {
    "createdAt": "2026-09-08T11:00:00.000Z",
    "startedAt": "2026-09-08T11:00:01.000Z",
    "completedAt": "2026-09-08T11:00:07.500Z",
    "durationMs": 6500
  },
  "result": {
    "key_claims": [
      "Venture debt funding reached $800M across Lagos and Nairobi in 2025"
    ],
    "sources": [
      { "title": "African Tech Venture Index", "reliability": 0.95 }
    ],
    "potential_article_angles": [
      "Why Series A Startups Are Turning to Non-Dilutive Debt"
    ]
  },
  "pollUrl": "/api/ai/tasks/7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

---

### 3.4 Editorial Approvals (Yellow Policy)
When a task policy is `yellow`, it stops in `waiting_approval`.

* **List Pending**: `GET /api/ai/approvals?status=pending`
* **Review Approval**: `POST /api/ai/approvals/:approvalId/review`

```json
{
  "decision": "approve",
  "decided_by": "editor@startupcreme.com",
  "reason": "Claims verified against primary financial records."
}
```

---

### 3.5 Controlled Tool Gateway
* **List Tools**: `GET /api/ai/tools`
* **Execute Tool**: `POST /api/ai/tools/:toolName/execute`

```json
{
  "query": "cross-border payments",
  "vertical": "finance",
  "limit": 5
}
```

---

## 4. n8n Node Configuration Recipes

### Recipe A: Submitting an Autonomous Research Task (n8n HTTP Request)
1. **Method**: `POST`
2. **URL**: `https://app.startupcreme.com/api/ai/tasks`
3. **Authentication**: Generic Credential Type -> Header Auth
   - Name: `x-automation-secret`
   - Value: `{{ $env.STARTUPCREME_AUTOMATION_SECRET }}`
4. **Send Headers**:
   - `x-workflow-id`: `{{ $workflow.id }}`
   - `x-execution-id`: `{{ $execution.id }}`
   - `Idempotency-Key`: `n8n-{{ $workflow.id }}-{{ $execution.id }}`
5. **Body Parameters (JSON)**:
```json
{
  "taskType": "research_topic",
  "payload": {
    "topic": "={{ $json.newsHeadline }}",
    "vertical": "tech",
    "depth": "standard"
  },
  "webhookUrl": "https://n8n.yourdomain.com/webhook/ai-task-completed"
}
```

### Recipe B: Polling with n8n Loop Until Complete
1. Set a **Wait Node** for 3 seconds.
2. HTTP Request `GET` to `={{ $json.pollUrl }}`.
3. If-Else Node:
   - Condition: `{{ $json.status }}` is equal to `completed` -> Proceed to Draft Creation.
   - Condition: `{{ $json.status }}` is equal to `waiting_approval` -> Send Slack Alert to Editorial Team.
   - Condition: `{{ $json.status }}` is equal to `running` or `queued` -> Loop back to Wait.
   - Condition: `{{ $json.status }}` is equal to `failed` -> Error Notification.

---

## 5. Error Taxonomy & Retries
The API returns RFC-compliant error payloads:
```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests to AI automation endpoint. Limit is 120 per minute.",
  "retryable": true,
  "correlation": {
    "requestId": "req_83910"
  },
  "timestamp": "2026-09-08T11:05:00.000Z"
}
```

| Code | HTTP Status | Retryable | Recommended n8n Action |
| :--- | :--- | :--- | :--- |
| `UNAUTHORIZED_AUTOMATION` | 401 | **No** | Fail workflow; check credentials. |
| `VALIDATION_FAILED` | 400 | **No** | Fail workflow; fix payload schema. |
| `FORBIDDEN_ACTION` | 403 | **No** | Red action blocked; notify compliance. |
| `RATE_LIMIT_EXCEEDED` | 429 | **Yes** | Exponential backoff (respect `Retry-After`). |
| `TIMEOUT` | 504 | **Yes** | Retry task or increase `timeoutMs`. |
| `INTERNAL_ERROR` | 500 | **Yes** | Retry with jitter (max 3 retries). |
