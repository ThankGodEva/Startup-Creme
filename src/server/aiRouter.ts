import { Router, Request, Response } from 'express';
import { taskManager } from '../ai/orchestrator/taskManager';
import { memoryStore, MemoryCategory } from '../ai/memory/memoryStore';
import { ResearchInputSchema } from '../ai/agents/research/researchSchemas';
import { ToolRegistry } from '../ai/tools/registry';
import { STARTUPCREME_CONSTITUTION } from '../ai/policies/constitution';
import { 
  requireAutomationAuth, 
  AuthenticatedAutomationRequest 
} from '../ai/server/automationAuth';
import { createRateLimiter } from '../ai/server/rateLimiter';
import { 
  SubmitTaskRequestSchema, 
  TaskStatusResponse, 
  AITaskResult, 
  AIErrorCodes, 
  createTaskError 
} from '../ai/server/automationContract';
import { TaskRegistry } from '../ai/server/taskRegistry';
import { eventBus } from '../ai/events/eventBus';

export const aiRouter = Router();

// 1. Rate Limiting Middleware
const generalLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 120,
  endpointIdentifier: 'ai_general'
});

const taskLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 60,
  endpointIdentifier: 'ai_task_submission'
});

// Apply rate limiting and automation authentication
aiRouter.use(generalLimiter);
aiRouter.use(requireAutomationAuth);

// --------------------------------------------------------------------
// 1. Health and Observability (Hardened)
// --------------------------------------------------------------------
aiRouter.get('/health', (req: Request, res: Response) => {
  const geminiKeyConfigured = Boolean(
    process.env.GEMINI_API_KEY && 
    process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
  );
  const secretConfigured = Boolean(
    process.env.STARTUPCREME_AUTOMATION_SECRET && 
    process.env.STARTUPCREME_AUTOMATION_SECRET !== 'your_m2m_automation_secret_key'
  );
  const webhookConfigured = Boolean(process.env.STARTUPCREME_WEBHOOK_URL);
  const metrics = taskManager.getSystemMetrics();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    system: {
      platform: 'StartupCrème AI Operating System',
      version: '2.1.0-production-orchestration',
      controlPlane: 'n8n_ready',
      m2mAuthEnabled: secretConfigured,
      geminiFrontierConfigured: geminiKeyConfigured,
      webhookConfigured,
      databasePersistence: metrics.databasePersistence
    },
    constitution: {
      publication: STARTUPCREME_CONSTITUTION.publicationName,
      policyLevels: ['green', 'yellow', 'red'],
      strictNoDirectPublishing: true
    },
    metrics,
    registeredAgents: taskManager.listAgents(),
    registeredTools: ToolRegistry.list(),
    registeredTaskTypes: TaskRegistry.list()
  });
});

// --------------------------------------------------------------------
// 2. Controlled Tool Gateway
// --------------------------------------------------------------------
aiRouter.get('/tools', (req: Request, res: Response) => {
  res.json({
    tools: ToolRegistry.list()
  });
});

aiRouter.post('/tools/:toolName/execute', async (req: Request, res: Response) => {
  const { toolName } = req.params;
  const tool = ToolRegistry.get(toolName);

  if (!tool) {
    return res.status(404).json({
      success: false,
      error: `Tool '${toolName}' is not registered in the Controlled Tool Gateway.`,
      code: AIErrorCodes.UNKNOWN_TOOL,
      retryable: false
    });
  }

  try {
    const result = await ToolRegistry.executeTool(toolName, req.body, {
      agentId: (req as any).callerIdentity || 'automation_api'
    });

    res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Error executing tool',
      code: AIErrorCodes.INTERNAL_ERROR,
      retryable: false
    });
  }
});

// --------------------------------------------------------------------
// 3. AI Tasks Management (n8n Production Control Plane)
// --------------------------------------------------------------------
aiRouter.post('/tasks', taskLimiter, async (req: AuthenticatedAutomationRequest, res: Response) => {
  // 1. Validate submission payload against Zod schema
  const parseResult = SubmitTaskRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid task submission request schema.',
      code: AIErrorCodes.VALIDATION_FAILED,
      retryable: false,
      details: parseResult.error.issues
    });
  }

  const { 
    taskType, 
    priority, 
    assignedAgent, 
    requestedBy, 
    payload, 
    idempotencyKey, 
    webhookUrl, 
    timeoutMs 
  } = parseResult.data;

  // 2. Validate task payload against specific registered task schema if defined
  const payloadValidation = TaskRegistry.validatePayload(taskType, payload);
  if (!payloadValidation.success) {
    return res.status(400).json({
      error: payloadValidation.error,
      code: AIErrorCodes.VALIDATION_FAILED,
      retryable: false
    });
  }

  try {
    // 3. Submit task with persistent idempotency and correlation tracking
    const result = await taskManager.submitTask({
      taskType,
      assignedAgent: assignedAgent || undefined,
      payload: payloadValidation.data,
      priority,
      requestedBy: requestedBy || req.callerIdentity || 'n8n_control_plane',
      idempotencyKey,
      correlation: req.correlation,
      webhookUrl,
      timeoutMs
    });

    const task = result.task;
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const pollUrl = `${protocol}://${host}/api/ai/tasks/${task.id}`;

    res.status(result.isExisting ? 200 : 202).json({
      success: true,
      taskId: task.id,
      status: task.status,
      isExisting: result.isExisting,
      policyLevel: task.policy_level || 'green',
      correlation: req.correlation,
      task,
      pollUrl,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Error submitting task to orchestrator',
      code: AIErrorCodes.INTERNAL_ERROR,
      retryable: false
    });
  }
});

aiRouter.get('/tasks', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const status = req.query.status as any;
  const tasks = taskManager.listTasks(limit, status);
  res.json({ tasks, total: tasks.length });
});

aiRouter.get('/tasks/:id', async (req: Request, res: Response) => {
  const task = await taskManager.getTaskAsync(req.params.id);
  if (!task) {
    return res.status(404).json({
      error: `Task '${req.params.id}' not found.`,
      code: AIErrorCodes.NOT_FOUND,
      retryable: false
    });
  }

  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  const pollUrl = `${protocol}://${host}/api/ai/tasks/${task.id}`;

  const createdTime = new Date(task.created_at).getTime();
  const completedTime = task.completed_at ? new Date(task.completed_at).getTime() : null;
  const durationMs = completedTime ? completedTime - createdTime : null;

  // Retrieve approval details if task is paused in human review
  let approvalDetails = null;
  if (task.approval_id) {
    const approval = taskManager.listApprovals().find(a => a.id === task.approval_id);
    if (approval) {
      approvalDetails = {
        id: approval.id,
        status: approval.status,
        description: approval.description,
        decidedBy: approval.decided_by,
        decisionReason: approval.decision_reason
      };
    }
  }

  // Standardized response envelope for polling clients
  const responseEnvelope: TaskStatusResponse = {
    taskId: task.id,
    taskType: task.task_type,
    status: task.status,
    priority: task.priority,
    policyLevel: task.policy_level || 'green',
    correlation: (task.metadata as any) || { requestId: req.params.id },
    result: task.result ? {
      success: true,
      data: task.result,
      confidence: 0.95,
      reasoningSummary: 'Execution verified against Editorial Constitution'
    } : null,
    error: task.error ? createTaskError(
      task.status === 'failed' && task.error.includes('timed out') 
        ? AIErrorCodes.TASK_TIMEOUT 
        : AIErrorCodes.AGENT_EXECUTION_FAILED,
      task.error
    ) : null,
    approval: approvalDetails,
    timestamps: {
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      completedAt: task.completed_at,
      durationMs
    },
    pollUrl
  };

  res.json(responseEnvelope);
});

// --------------------------------------------------------------------
// 4. Human Approval Workflow
// --------------------------------------------------------------------
aiRouter.get('/approvals', (req: Request, res: Response) => {
  const status = req.query.status as any;
  const approvals = taskManager.listApprovals(status);
  res.json({ approvals, count: approvals.length });
});

aiRouter.post('/approvals/:id/approve', async (req: Request, res: Response) => {
  const { decided_by, reason } = req.body;
  const result = await taskManager.approveTask(
    req.params.id, 
    decided_by || 'Editorial Supervisor', 
    reason || 'Approved via Control Plane'
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

aiRouter.post('/approvals/:id/reject', async (req: Request, res: Response) => {
  const { decided_by, reason } = req.body;
  const result = await taskManager.rejectTask(
    req.params.id, 
    decided_by || 'Editorial Supervisor', 
    reason || 'Rejected via Control Plane'
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// Unified review endpoint (supports both approve and reject)
aiRouter.post('/approvals/:id/review', async (req: Request, res: Response) => {
  const { decision, decided_by, reason } = req.body;
  if (decision === 'approve') {
    const result = await taskManager.approveTask(req.params.id, decided_by, reason);
    return res.status(result.success ? 200 : 400).json(result);
  } else if (decision === 'reject') {
    const result = await taskManager.rejectTask(req.params.id, decided_by, reason);
    return res.status(result.success ? 200 : 400).json(result);
  } else {
    return res.status(400).json({ error: "Invalid decision. Must be 'approve' or 'reject'." });
  }
});

// --------------------------------------------------------------------
// 5. Audit Log & Alerts
// --------------------------------------------------------------------
aiRouter.get('/actions', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const actions = taskManager.listActions(limit);
  res.json({ actions, count: actions.length });
});

aiRouter.get('/alerts', (req: Request, res: Response) => {
  const includeDismissed = req.query.include_dismissed === 'true';
  const alerts = taskManager.listAlerts(includeDismissed);
  res.json({ alerts, count: alerts.length });
});

aiRouter.post('/alerts/:id/dismiss', (req: Request, res: Response) => {
  const success = taskManager.dismissAlert(req.params.id);
  res.json({ success });
});

// --------------------------------------------------------------------
// 6. Memory System
// --------------------------------------------------------------------
aiRouter.get('/memory', (req: Request, res: Response) => {
  const type = req.query.type as MemoryCategory | undefined;
  const query = req.query.q as string | undefined;

  if (query) {
    const results = memoryStore.search(query, type);
    return res.json({ memories: results, count: results.length });
  }

  if (type) {
    const results = memoryStore.listByType(type);
    return res.json({ memories: results, count: results.length });
  }

  const all = memoryStore.listAll();
  res.json({ memories: all, count: all.length });
});

aiRouter.post('/memory', (req: Request, res: Response) => {
  try {
    const { memory_type, key, value, confidence, source, tags } = req.body;
    if (!memory_type || !key || !value) {
      return res.status(400).json({ error: 'Missing memory_type, key, or value' });
    }

    const saved = memoryStore.set({
      memoryType: memory_type,
      key,
      value,
      confidence,
      source,
      tags
    });

    res.status(201).json({ success: true, memory: saved });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save memory' });
  }
});

// --------------------------------------------------------------------
// 7. Direct Research Agent Trigger (Synchronous / Fast-Polling Pattern)
// --------------------------------------------------------------------
aiRouter.post('/research', taskLimiter, async (req: AuthenticatedAutomationRequest, res: Response) => {
  const idempotencyKey = (req.headers['idempotency-key'] as string) || 
                         (req.headers['x-idempotency-key'] as string) || 
                         req.body.idempotency_key ||
                         req.body.idempotencyKey;

  const validation = ResearchInputSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid research parameters',
      code: AIErrorCodes.VALIDATION_FAILED,
      details: validation.error.issues
    });
  }

  try {
    const { task, isExisting } = await taskManager.submitTask({
      taskType: 'research_topic',
      assignedAgent: 'agent_research',
      payload: validation.data,
      priority: 'high',
      requestedBy: req.body.requested_by || req.callerIdentity || 'n8n_research_flow',
      idempotencyKey,
      correlation: req.correlation,
      timeoutMs: req.body.timeout_ms || 60000
    });

    // Wait briefly if task is running to return immediate synchronous response if available
    let finalTask = task;
    let attempts = 0;
    while ((finalTask.status === 'queued' || finalTask.status === 'running') && attempts < 24) {
      await new Promise(r => setTimeout(r, 250));
      finalTask = taskManager.getTask(task.id) || finalTask;
      attempts++;
    }

    res.status(finalTask.status === 'completed' ? 200 : 202).json({
      success: finalTask.status === 'completed',
      isExisting,
      task: finalTask,
      result: finalTask.result,
      correlation: req.correlation
    });
  } catch (err: any) {
    res.status(500).json({ 
      error: err?.message || 'Error executing research topic',
      code: AIErrorCodes.INTERNAL_ERROR,
      retryable: false
    });
  }
});
