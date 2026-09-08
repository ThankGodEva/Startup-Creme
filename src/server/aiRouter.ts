import { Router, Request, Response, NextFunction } from 'express';
import { taskManager } from '../ai/orchestrator/taskManager';
import { memoryStore, MemoryCategory } from '../ai/memory/memoryStore';
import { ResearchInputSchema } from '../ai/agents/research/researchSchemas';
import { ToolRegistry } from '../ai/tools/registry';
import { STARTUPCREME_CONSTITUTION } from '../ai/policies/constitution';

export const aiRouter = Router();

/**
 * Middleware: Machine-to-Machine and Admin Authorization
 */
function requireAutomationAuth(req: Request, res: Response, next: NextFunction): void {
  const configuredSecret = process.env.STARTUPCREME_AUTOMATION_SECRET;
  const authHeader = req.headers.authorization;
  const customSecretHeader = req.headers['x-startupcreme-automation-secret'] as string | undefined;
  const adminRoleHeader = req.headers['x-admin-role'] as string | undefined;

  let providedToken = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedToken = authHeader.slice(7).trim();
  } else if (customSecretHeader) {
    providedToken = customSecretHeader.trim();
  }

  // 1. If configuredSecret is set, verify match
  if (configuredSecret && configuredSecret !== 'your_m2m_automation_secret_key') {
    if (providedToken && providedToken === configuredSecret) {
      return next();
    }
  }

  // 2. Allow requests coming from internal admin UI (with role header or local session)
  if (adminRoleHeader === 'admin' || (req as any).user?.role === 'admin') {
    return next();
  }

  // 3. In development/fallback mode if secret is not set yet, allow with a warning header
  if (!configuredSecret || configuredSecret === 'your_m2m_automation_secret_key') {
    res.setHeader('X-StartupCreme-Auth-Warning', 'STARTUPCREME_AUTOMATION_SECRET not configured; development mode active');
    return next();
  }

  res.status(401).json({
    error: 'Unauthorized: Invalid or missing automation credentials. Provide valid Bearer token or X-StartupCreme-Automation-Secret header.',
    code: 'ERR_UNAUTHORIZED_AUTOMATION'
  });
}

// Apply auth middleware to all /api/ai routes
aiRouter.use(requireAutomationAuth);

// --------------------------------------------------------------------
// 1. Health and Observability
// --------------------------------------------------------------------
aiRouter.get('/health', (req: Request, res: Response) => {
  const geminiKeyConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  const secretConfigured = Boolean(process.env.STARTUPCREME_AUTOMATION_SECRET && process.env.STARTUPCREME_AUTOMATION_SECRET !== 'your_m2m_automation_secret_key');
  const metrics = taskManager.getSystemMetrics();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    system: {
      platform: 'StartupCrème AI Operating System',
      version: '1.0.0-foundation',
      m2mAuthEnabled: secretConfigured,
      geminiFrontierConfigured: geminiKeyConfigured,
    },
    constitution: {
      publication: STARTUPCREME_CONSTITUTION.publicationName,
      policyLevels: ['green', 'yellow', 'red']
    },
    metrics,
    registeredAgents: taskManager.listAgents(),
    registeredTools: ToolRegistry.list()
  });
});

// --------------------------------------------------------------------
// 2. AI Tasks Management (n8n ready)
// --------------------------------------------------------------------
aiRouter.post('/tasks', async (req: Request, res: Response) => {
  try {
    const { task_type, assigned_agent, payload, priority, requested_by } = req.body;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || 
                           (req.headers['x-idempotency-key'] as string) || 
                           req.body.idempotency_key;

    if (!task_type) {
      return res.status(400).json({ error: 'Missing required field: task_type' });
    }

    const result = await taskManager.submitTask({
      taskType: task_type,
      assignedAgent: assigned_agent || 'agent_research',
      payload: payload || {},
      priority: priority || 'medium',
      requestedBy: requested_by || 'm2m_orchestrator',
      idempotencyKey
    });

    res.status(result.isExisting ? 200 : 202).json({
      success: true,
      isExisting: result.isExisting,
      task: result.task
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error submitting task' });
  }
});

aiRouter.get('/tasks', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const status = req.query.status as any;
  const tasks = taskManager.listTasks(limit, status);
  res.json({ tasks, total: tasks.length });
});

aiRouter.get('/tasks/:id', (req: Request, res: Response) => {
  const task = taskManager.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: `Task '${req.params.id}' not found` });
  }
  res.json({ task });
});

// --------------------------------------------------------------------
// 3. Human Approval System
// --------------------------------------------------------------------
aiRouter.get('/approvals', (req: Request, res: Response) => {
  const status = req.query.status as any;
  const approvals = taskManager.listApprovals(status);
  res.json({ approvals, count: approvals.length });
});

aiRouter.post('/approvals/:id/approve', async (req: Request, res: Response) => {
  const { decided_by, reason } = req.body;
  const result = await taskManager.approveTask(req.params.id, decided_by, reason);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

aiRouter.post('/approvals/:id/reject', async (req: Request, res: Response) => {
  const { decided_by, reason } = req.body;
  const result = await taskManager.rejectTask(req.params.id, decided_by, reason);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// --------------------------------------------------------------------
// 4. Audit Log & Alerts
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
// 5. Memory System
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
// 6. Direct Research Agent Trigger (Synchronous / Autonomous)
// --------------------------------------------------------------------
aiRouter.post('/research', async (req: Request, res: Response) => {
  const idempotencyKey = (req.headers['idempotency-key'] as string) || 
                         (req.headers['x-idempotency-key'] as string) || 
                         req.body.idempotency_key;

  const validation = ResearchInputSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: 'Invalid research parameters',
      details: validation.error.issues
    });
  }

  try {
    const { task, isExisting } = await taskManager.submitTask({
      taskType: 'research_topic',
      assignedAgent: 'agent_research',
      payload: validation.data,
      priority: 'high',
      requestedBy: req.body.requested_by || 'api_client',
      idempotencyKey
    });

    // Wait for task completion if it's currently running (or immediately return existing)
    let finalTask = task;
    let attempts = 0;
    while ((finalTask.status === 'queued' || finalTask.status === 'running') && attempts < 20) {
      await new Promise(r => setTimeout(r, 250));
      finalTask = taskManager.getTask(task.id) || finalTask;
      attempts++;
    }

    res.status(finalTask.status === 'completed' ? 200 : 202).json({
      success: finalTask.status === 'completed',
      isExisting,
      task: finalTask,
      result: finalTask.result
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error executing research' });
  }
});
