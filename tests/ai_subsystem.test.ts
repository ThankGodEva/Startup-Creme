import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine } from '../src/ai/policies/policyEngine';
import { ToolRegistry } from '../src/ai/tools/registry';
import { ResearchAgent } from '../src/ai/agents/research/researchAgent';
import { TaskManager } from '../src/ai/orchestrator/taskManager';
import { MemoryStore } from '../src/ai/memory/memoryStore';

describe('StartupCrème AI Operating Subsystem - Foundation Phase Tests', () => {

  describe('Editorial Constitution & Policy Engine', () => {
    test('Green actions are allowed autonomously without approval', () => {
      const researchPolicy = PolicyEngine.evaluateAction('research_topic');
      assert.equal(researchPolicy.level, 'green');
      assert.equal(researchPolicy.isAllowed, true);
      assert.equal(researchPolicy.requiresApproval, false);

      const auditPolicy = PolicyEngine.evaluateAction('suggest_internal_links');
      assert.equal(auditPolicy.level, 'green');
      assert.equal(auditPolicy.isAllowed, true);
      assert.equal(auditPolicy.requiresApproval, false);
    });

    test('Yellow actions require human editorial approval', () => {
      const publishPolicy = PolicyEngine.evaluateAction('publish_article');
      assert.equal(publishPolicy.level, 'yellow');
      assert.equal(publishPolicy.isAllowed, true);
      assert.equal(publishPolicy.requiresApproval, true);

      const archivePolicy = PolicyEngine.evaluateAction('archive_article');
      assert.equal(archivePolicy.level, 'yellow');
      assert.equal(archivePolicy.requiresApproval, true);
    });

    test('Red actions are strictly forbidden and blocked', () => {
      const dropDbPolicy = PolicyEngine.evaluateAction('delete_database_schema');
      assert.equal(dropDbPolicy.level, 'red');
      assert.equal(dropDbPolicy.isAllowed, false);

      const rawSqlPolicy = PolicyEngine.evaluateAction('execute_raw_sql');
      assert.equal(rawSqlPolicy.level, 'red');
      assert.equal(rawSqlPolicy.isAllowed, false);
    });

    test('Content sanity enforces factuality standards', () => {
      const validSanity = PolicyEngine.validateContentSanity(3, 2, 0.85);
      assert.equal(validSanity.valid, true);

      const ungroundedSanity = PolicyEngine.validateContentSanity(4, 0, 0.9);
      assert.equal(ungroundedSanity.valid, false);
      assert.match(ungroundedSanity.reason || '', /Zero sources provided/);

      const lowConfidenceSanity = PolicyEngine.validateContentSanity(2, 2, 0.35);
      assert.equal(lowConfidenceSanity.valid, false);
      assert.match(lowConfidenceSanity.reason || '', /Confidence score/);
    });
  });

  describe('Tool Registry & Controlled Execution Gateway', () => {
    test('Lists registered research tools with schemas and policy levels', () => {
      const tools = ToolRegistry.list();
      assert.ok(tools.length >= 4);

      const searchTool = ToolRegistry.get('search_content');
      assert.ok(searchTool);
      assert.equal(searchTool?.policyLevel, 'green');

      const createDraftTool = ToolRegistry.get('create_article_draft');
      assert.ok(createDraftTool);
      assert.equal(createDraftTool?.policyLevel, 'green');
    });

    test('Executes registered tool with parameter validation', async () => {
      const res = await ToolRegistry.execute('search_content', {
        query: 'venture',
        vertical: 'finance',
        limit: 2
      });

      assert.equal(res.success, true);
      assert.ok(Array.isArray((res.result as any)?.results));
    });

    test('Rejects tool execution with invalid parameters', async () => {
      const res = await ToolRegistry.execute('search_content', {
        query: 'x' // violates min(2) constraint
      });

      assert.equal(res.success, false);
      assert.match(res.error || '', /Invalid parameters/);
    });
  });

  describe('Lead Research Agent', () => {
    test('Validates research input schema properly', () => {
      const agent = new ResearchAgent();
      const valid = agent.validateInput({
        topic: 'Autonomous LLM Agents in Media',
        vertical: 'tech',
        depth: 'standard'
      });
      assert.equal(valid.success, true);

      const invalid = agent.validateInput({
        topic: '   ', // invalid blank topic
        vertical: 'invalid_vertical'
      });
      assert.equal(invalid.success, false);
    });

    test('Executes research and returns structured, validated output', async () => {
      const agent = new ResearchAgent();
      const res = await agent.execute({
        topic: 'Venture Capital in Africa: Cross-Border Fintech Rails',
        vertical: 'finance',
        depth: 'standard'
      });

      assert.equal(res.success, true);
      assert.ok(res.data);
      assert.ok(res.data.key_claims.length > 0);
      assert.ok(res.data.sources.length > 0);
      assert.ok(res.data.potential_article_angles.length > 0);
      assert.ok(res.confidence >= 0.5);
      assert.ok(res.audit.durationMs >= 0);
    });
  });

  describe('Task Manager & Human Approval Orchestrator', () => {
    test('Submits green task and completes execution', async () => {
      const tm = TaskManager.getInstance();
      const { task, isExisting } = await tm.submitTask({
        taskType: 'research_topic',
        assignedAgent: 'agent_research',
        payload: {
          topic: 'Token Engineering and Model Evaluation',
          vertical: 'tech'
        }
      });

      assert.equal(isExisting, false);
      assert.ok(task.id);
      assert.ok(['queued', 'running', 'completed'].includes(task.status));
    });

    test('Idempotency key prevents duplicate task execution', async () => {
      const tm = TaskManager.getInstance();
      const key = `idem_${Date.now()}_test`;

      const first = await tm.submitTask({
        taskType: 'research_topic',
        assignedAgent: 'agent_research',
        payload: { topic: 'AI FinOps' },
        idempotencyKey: key
      });

      const second = await tm.submitTask({
        taskType: 'research_topic',
        assignedAgent: 'agent_research',
        payload: { topic: 'AI FinOps' },
        idempotencyKey: key
      });

      assert.equal(first.isExisting, false);
      assert.equal(second.isExisting, true);
      assert.equal(first.task.id, second.task.id);
    });

    test('Yellow tasks pause in waiting_approval and require human intervention', async () => {
      const tm = TaskManager.getInstance();
      const { task } = await tm.submitTask({
        taskType: 'publish_article',
        assignedAgent: 'agent_editorial',
        payload: { postId: 'post-123' }
      });

      assert.equal(task.status, 'waiting_approval');
      assert.ok(task.approval_id);

      // Verify approval entry exists
      const approvals = tm.listApprovals('pending');
      const approval = approvals.find(a => a.id === task.approval_id);
      assert.ok(approval);
      assert.equal(approval?.status, 'pending');

      // Approve task
      const approveRes = await tm.approveTask(task.approval_id!, 'Head Editor', 'Quality verified');
      assert.equal(approveRes.success, true);
    });

    test('Red tasks are blocked immediately and log critical alert', async () => {
      const tm = TaskManager.getInstance();
      const { task } = await tm.submitTask({
        taskType: 'delete_database_schema',
        assignedAgent: 'rogue_agent',
        payload: { table: 'all' }
      });

      assert.equal(task.status, 'failed');
      assert.match(task.error || '', /Forbidden autonomous action/);

      const alerts = tm.listAlerts();
      const alert = alerts.find(a => a.title.includes('Policy Block'));
      assert.ok(alert);
      assert.equal(alert?.severity, 'critical');
    });
  });

  describe('Long-Term AI Memory Store', () => {
    test('Stores and retrieves structured memories', () => {
      const store = MemoryStore.getInstance();
      const mem = store.set({
        memoryType: 'strategic_decision',
        key: 'autonomous_foundation_phase',
        value: { phase: 1, completed: true, timestamp: '2026-09-07' },
        confidence: 1.0,
        tags: ['strategy', 'architecture']
      });

      assert.ok(mem.id);
      assert.equal(mem.key, 'autonomous_foundation_phase');

      const retrieved = store.get('strategic_decision', 'autonomous_foundation_phase');
      assert.ok(retrieved);
      assert.equal(retrieved?.value.phase, 1);
    });

    test('Searches memories by tag and key', () => {
      const store = MemoryStore.getInstance();
      const results = store.search('architecture');
      assert.ok(results.length > 0);
      assert.ok(results.some(r => r.key === 'autonomous_foundation_phase'));
    });
  });

  describe('Durable Supabase Persistence & Serverless Cold-Start Resilience', () => {
    test('Memory cold-start recovery: task is recovered from Supabase after memory cache is cleared', async () => {
      const tm = TaskManager.getInstance();
      const { task } = await tm.submitTask({
        taskType: 'research_topic',
        assignedAgent: 'agent_research',
        payload: { topic: 'Cold Start Resilience in Distributed Systems' }
      });
      assert.ok(task.id);

      // Simulate serverless cold start / fresh instance by wiping in-memory map
      tm.clearMemoryCache();
      assert.equal(tm.getTask(task.id), undefined);

      // Durable async retrieval loads the task from Supabase into memory
      const recovered = await tm.getTaskAsync(task.id);
      assert.ok(recovered, 'Task should be recovered from Supabase database');
      assert.equal(recovered?.id, task.id);
      assert.equal(recovered?.task_type, 'research_topic');
      assert.equal(tm.getTask(task.id)?.id, task.id, 'Task should now be cached in memory');
    });

    test('Cold executeTask(): loads and executes task from Supabase when absent from memory', async () => {
      const tm = TaskManager.getInstance();
      const { task } = await tm.submitTask({
        taskType: 'research_topic',
        assignedAgent: 'agent_research',
        payload: { topic: 'Cold Execution Handling' }
      });

      // Clear memory cache so executeTask sees no in-memory record
      tm.clearMemoryCache();
      assert.equal(tm.getTask(task.id), undefined);

      // Call executeTask directly on the cold instance
      const executed = await tm.executeTask(task.id);
      assert.ok(executed);
      assert.equal(executed.id, task.id);
      assert.ok(['running', 'completed'].includes(executed.status));

      // Verify that the task was loaded into memory and updated in the database
      const cached = tm.getTask(task.id);
      assert.ok(cached);
      assert.equal(cached?.id, task.id);
    });

    test('Idempotency across memory loss: reuses database record when memory cache is wiped', async () => {
      const tm = TaskManager.getInstance();
      const idempotencyKey = `serverless_idem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Submit first task
      const first = await tm.submitTask({
        taskType: 'research_topic',
        assignedAgent: 'agent_research',
        payload: { topic: 'Serverless Idempotency Persistence' },
        idempotencyKey
      });
      assert.equal(first.isExisting, false);
      assert.ok(first.task.id);

      // Simulate a different runtime instance with completely cold memory
      tm.clearMemoryCache();
      assert.equal(tm.getTask(first.task.id), undefined);

      // Submit the same task again with the same idempotency key
      const second = await tm.submitTask({
        taskType: 'research_topic',
        assignedAgent: 'agent_research',
        payload: { topic: 'Serverless Idempotency Persistence' },
        idempotencyKey
      });

      // Database idempotency index must match and prevent duplicate execution
      assert.equal(second.isExisting, true);
      assert.equal(second.task.id, first.task.id);
    });
  });

  after(() => {
    setTimeout(() => {
      process.exit(0);
    }, 200).unref();
  });
});
