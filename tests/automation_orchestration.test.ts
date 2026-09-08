import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import express from 'express';
import { aiRouter } from '../src/server/aiRouter';
import { TaskManager } from '../src/ai/orchestrator/taskManager';
import { TaskRegistry } from '../src/ai/server/taskRegistry';
import { ToolRegistry } from '../src/ai/tools/registry';
import { eventBus } from '../src/ai/events/eventBus';
import { 
  SubmitTaskRequestSchema, 
  AIErrorCodes 
} from '../src/ai/server/automationContract';
import { extractCorrelation } from '../src/ai/server/automationAuth';

describe('Phase 2.1: Production Orchestration + n8n Control Plane', () => {

  // Setup test server for end-to-end endpoint verification
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);

  let server: any;
  let baseUrl = '';
  const testSecret = process.env.STARTUPCREME_AUTOMATION_SECRET || 'test_automation_secret';

  // Start local ephemeral HTTP server
  test('Server boots ephemeral instance for orchestration testing', async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}/api/ai`;
        resolve();
      });
    });
    assert.ok(baseUrl.startsWith('http://127.0.0.1:'));
  });

  // --------------------------------------------------------------------
  // 1. Automation Authentication & Correlation
  // --------------------------------------------------------------------
  describe('Automation Authentication & Correlation Middleware', () => {
    test('Rejects unauthorized requests without credentials', async () => {
      // Set secret in env for strict testing
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'hardened_n8n_secret_123';

      const res = await fetch(`${baseUrl}/health`, {
        method: 'GET'
      });

      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
      assert.equal(json.retryable, false);
      assert.ok(json.correlation);
      assert.ok(json.correlation.requestId);
    });

    test('Rejects invalid credentials with 401 UNAUTHORIZED_AUTOMATION', async () => {
      const res = await fetch(`${baseUrl}/health`, {
        headers: {
          'x-automation-secret': 'invalid_secret_token'
        }
      });

      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
    });

    test('Accepts valid x-automation-secret header', async () => {
      const res = await fetch(`${baseUrl}/health`, {
        headers: {
          'x-automation-secret': 'hardened_n8n_secret_123'
        }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.status, 'healthy');
      assert.equal(json.system.controlPlane, 'n8n_ready');
    });

    test('Accepts valid Authorization: Bearer token', async () => {
      const res = await fetch(`${baseUrl}/health`, {
        headers: {
          'Authorization': 'Bearer hardened_n8n_secret_123'
        }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.status, 'healthy');
    });

    test('Propagates correlation headers into response and logs', async () => {
      const reqId = `req_${crypto.randomUUID()}`;
      const workflowId = 'wf_n8n_market_radar_01';
      const executionId = 'exec_48291';

      const res = await fetch(`${baseUrl}/health`, {
        headers: {
          'x-automation-secret': 'hardened_n8n_secret_123',
          'x-request-id': reqId,
          'x-workflow-id': workflowId,
          'x-execution-id': executionId
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-request-id'), reqId);
    });
  });

  // --------------------------------------------------------------------
  // 2. Automation Contract & Zod Validation
  // --------------------------------------------------------------------
  describe('Automation Request Contract & Zod Validation', () => {
    test('Validates SubmitTaskRequestSchema with camelCase and snake_case', () => {
      const snakeCaseInput = {
        task_type: 'research_topic',
        priority: 'high',
        assigned_agent: 'agent_research',
        payload: { topic: 'Autonomous Media Rails' },
        idempotency_key: 'idem_test_key_001'
      };

      const parsedSnake = SubmitTaskRequestSchema.safeParse(snakeCaseInput);
      assert.equal(parsedSnake.success, true);
      if (parsedSnake.success) {
        assert.equal(parsedSnake.data.taskType, 'research_topic');
        assert.equal(parsedSnake.data.priority, 'high');
        assert.equal(parsedSnake.data.assignedAgent, 'agent_research');
        assert.equal(parsedSnake.data.idempotencyKey, 'idem_test_key_001');
      }

      const camelCaseInput = {
        taskType: 'research_topic',
        priority: 'critical',
        assignedAgent: 'agent_research',
        payload: { topic: 'Autonomous Media Rails' },
        idempotencyKey: 'idem_test_key_002'
      };

      const parsedCamel = SubmitTaskRequestSchema.safeParse(camelCaseInput);
      assert.equal(parsedCamel.success, true);
      if (parsedCamel.success) {
        assert.equal(parsedCamel.data.priority, 'critical');
        assert.equal(parsedCamel.data.idempotencyKey, 'idem_test_key_002');
      }
    });

    test('Rejects invalid task submission schema via POST /api/ai/tasks', async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': 'hardened_n8n_secret_123'
        },
        body: JSON.stringify({
          priority: 'not_a_valid_priority' // Missing taskType & invalid priority
        })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, AIErrorCodes.VALIDATION_FAILED);
      assert.equal(json.retryable, false);
      assert.ok(json.details);
    });

    test('Rejects invalid payload schema for registered task type', async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': 'hardened_n8n_secret_123'
        },
        body: JSON.stringify({
          taskType: 'research_topic',
          payload: {
            topic: '' // Fails min(2) constraint for ResearchInputSchema
          }
        })
      });

      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.code, AIErrorCodes.VALIDATION_FAILED);
    });
  });

  // --------------------------------------------------------------------
  // 3. Persistent Idempotency & Task Lifecycle
  // --------------------------------------------------------------------
  describe('Persistent Idempotency & Task Lifecycle', () => {
    test('Idempotency prevents duplicate task creation and returns existing task', async () => {
      const uniqueKey = `idem_wf_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // First submission
      const firstRes = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': 'hardened_n8n_secret_123',
          'x-workflow-id': 'wf_market_scan',
          'x-execution-id': 'exec_001'
        },
        body: JSON.stringify({
          taskType: 'research_topic',
          payload: {
            topic: 'Idempotency in Distributed Orchestration Engines',
            vertical: 'tech'
          },
          idempotencyKey: uniqueKey
        })
      });

      assert.equal(firstRes.status, 202);
      const firstJson = await firstRes.json();
      assert.equal(firstJson.isExisting, false);
      assert.ok(firstJson.taskId);

      // Re-submission with exact same idempotency key (simulating n8n node retry)
      const retryRes = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': 'hardened_n8n_secret_123',
          'x-workflow-id': 'wf_market_scan',
          'x-execution-id': 'exec_001'
        },
        body: JSON.stringify({
          taskType: 'research_topic',
          payload: {
            topic: 'Idempotency in Distributed Orchestration Engines',
            vertical: 'tech'
          },
          idempotencyKey: uniqueKey
        })
      });

      assert.equal(retryRes.status, 200); // 200 OK for existing, 202 Accepted for newly created
      const retryJson = await retryRes.json();
      assert.equal(retryJson.isExisting, true);
      assert.equal(retryJson.taskId, firstJson.taskId);
    });
  });

  // --------------------------------------------------------------------
  // 4. Policy Engine Enforcement on Invocations
  // --------------------------------------------------------------------
  describe('Policy Engine Enforcement on Invocations', () => {
    test('Blocks RED actions immediately without executing (delete_database_schema)', async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': 'hardened_n8n_secret_123'
        },
        body: JSON.stringify({
          taskType: 'delete_database_schema',
          payload: { schemaName: 'startupcreme' }
        })
      });

      const json = await res.json();
      assert.equal(json.task.status, 'failed');
      assert.equal(json.policyLevel, 'red');
      assert.match(json.task.error || '', /Forbidden autonomous action/);

      // Verify alert was raised
      const alertsRes = await fetch(`${baseUrl}/alerts`, {
        headers: { 'x-automation-secret': 'hardened_n8n_secret_123' }
      });
      const alertsJson = await alertsRes.json();
      assert.ok(alertsJson.alerts.some((a: any) => a.severity === 'critical'));
    });

    test('Pauses YELLOW actions in waiting_approval state (publish_article)', async () => {
      const res = await fetch(`${baseUrl}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': 'hardened_n8n_secret_123'
        },
        body: JSON.stringify({
          taskType: 'publish_article',
          payload: { slug: 'fintech-growth-africa', title: 'Fintech Growth in Africa' }
        })
      });

      const json = await res.json();
      assert.equal(json.task.status, 'waiting_approval');
      assert.equal(json.policyLevel, 'yellow');
      assert.ok(json.task.approval_id);

      // Verify approval exists
      const apprRes = await fetch(`${baseUrl}/approvals`, {
        headers: { 'x-automation-secret': 'hardened_n8n_secret_123' }
      });
      const apprJson = await apprRes.json();
      const match = apprJson.approvals.find((a: any) => a.id === json.task.approval_id);
      assert.ok(match);
      assert.equal(match.status, 'pending');

      // Review & approve via unified endpoint
      const reviewRes = await fetch(`${baseUrl}/approvals/${match.id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': 'hardened_n8n_secret_123'
        },
        body: JSON.stringify({
          decision: 'approve',
          decided_by: 'Editorial Director',
          reason: 'Verified by Editorial Board'
        })
      });

      assert.equal(reviewRes.status, 200);
      const reviewJson = await reviewRes.json();
      assert.equal(reviewJson.success, true);
    });
  });

  // --------------------------------------------------------------------
  // 5. Polling Envelope (GET /api/ai/tasks/:taskId)
  // --------------------------------------------------------------------
  describe('Standardized Polling Response Envelope', () => {
    test('Returns complete structured envelope with timestamps, correlation, and pollUrl', async () => {
      const tm = TaskManager.getInstance();
      const { task } = await tm.submitTask({
        taskType: 'review_content',
        payload: { content: 'Testing content review standard envelope' }
      });

      const res = await fetch(`${baseUrl}/tasks/${task.id}`, {
        headers: { 'x-automation-secret': 'hardened_n8n_secret_123' }
      });

      assert.equal(res.status, 200);
      const envelope = await res.json();

      assert.equal(envelope.taskId, task.id);
      assert.equal(envelope.taskType, 'review_content');
      assert.ok(envelope.status);
      assert.ok(envelope.priority);
      assert.ok(envelope.policyLevel);
      assert.ok(envelope.correlation);
      assert.ok(envelope.timestamps);
      assert.ok(envelope.timestamps.createdAt);
      assert.ok(envelope.pollUrl);
      assert.ok(envelope.pollUrl.includes(task.id));
    });

    test('Returns 404 with NOT_FOUND code for unknown task ID', async () => {
      const res = await fetch(`${baseUrl}/tasks/non-existent-task-id-12345`, {
        headers: { 'x-automation-secret': 'hardened_n8n_secret_123' }
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.code, AIErrorCodes.NOT_FOUND);
      assert.equal(json.retryable, false);
    });
  });

  // --------------------------------------------------------------------
  // 6. Controlled Tool Gateway
  // --------------------------------------------------------------------
  describe('Controlled Tool Gateway', () => {
    test('Lists registered tools with schemas and policy levels', async () => {
      const res = await fetch(`${baseUrl}/tools`, {
        headers: { 'x-automation-secret': 'hardened_n8n_secret_123' }
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.ok(Array.isArray(json.tools));
      assert.ok(json.tools.length >= 4);
    });

    test('Safely executes registered tool through gateway', async () => {
      const res = await fetch(`${baseUrl}/tools/search_content/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': 'hardened_n8n_secret_123'
        },
        body: JSON.stringify({
          query: 'funding',
          vertical: 'finance',
          limit: 2
        })
      });

      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.result);
    });

    test('Rejects execution of unregistered tool with 404 UNKNOWN_TOOL', async () => {
      const res = await fetch(`${baseUrl}/tools/unregistered_dangerous_tool/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-secret': 'hardened_n8n_secret_123'
        },
        body: JSON.stringify({})
      });

      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.code, AIErrorCodes.UNKNOWN_TOOL);
    });
  });

  // --------------------------------------------------------------------
  // 7. Rate Limiting Headers
  // --------------------------------------------------------------------
  describe('Rate Limiting', () => {
    test('Includes standard X-RateLimit headers in responses', async () => {
      const res = await fetch(`${baseUrl}/health`, {
        headers: { 'x-automation-secret': 'hardened_n8n_secret_123' }
      });

      assert.ok(res.headers.has('x-ratelimit-limit'));
      assert.ok(res.headers.has('x-ratelimit-remaining'));
      assert.ok(res.headers.has('x-ratelimit-reset'));
    });
  });

  // --------------------------------------------------------------------
  // 8. Event Bus & Webhook Infrastructure
  // --------------------------------------------------------------------
  describe('Event Bus & Webhook Dispatch Foundation', () => {
    test('Emits events to in-process subscribers', (t, done) => {
      const unsubscribe = eventBus.subscribe('task.created', (event) => {
        assert.equal(event.event, 'task.created');
        assert.ok(event.id);
        assert.ok(event.timestamp);
        unsubscribe();
        done();
      });

      eventBus.emit('task.created', { testData: true });
    });

    test('Records webhook delivery metrics', () => {
      const stats = eventBus.getWebhookStats();
      assert.ok(typeof stats.totalDispatched === 'number');
      assert.ok(typeof stats.deliveredCount === 'number');
      assert.ok(typeof stats.failedCount === 'number');
    });
  });

  // --------------------------------------------------------------------
  // 9. Teardown
  // --------------------------------------------------------------------
  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Allow any pending microtasks to flush, then cleanly exit
    setTimeout(() => {
      process.exit(0);
    }, 100).unref();
  });
});
