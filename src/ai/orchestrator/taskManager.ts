import crypto from 'crypto';
import { 
  AiTask, 
  AiAction, 
  AiApproval, 
  AiAlert, 
  AiTaskStatus, 
  AiTaskPriority,
  PolicyLevel
} from '../../types';
import { IAgent } from '../types/agent';
import { ResearchAgent } from '../agents/research/researchAgent';
import { PolicyEngine } from '../policies/policyEngine';
import { aiDatabase } from './aiDatabase';
import { eventBus } from '../events/eventBus';
import { CorrelationMetadata, AIErrorCodes, createTaskError } from '../server/automationContract';

export interface CreateTaskOptions<TPayload = any> {
  taskType: string;
  assignedAgent?: string;
  payload: TPayload;
  priority?: AiTaskPriority;
  requestedBy?: string;
  idempotencyKey?: string;
  correlation?: CorrelationMetadata;
  webhookUrl?: string;
  timeoutMs?: number;
}

export class TaskManager {
  private static instance: TaskManager;

  // In-memory caches for 0ms access & offline fallback
  private tasks: Map<string, AiTask> = new Map();
  private actions: AiAction[] = [];
  private approvals: Map<string, AiApproval> = new Map();
  private alerts: AiAlert[] = [];
  private agents: Map<string, IAgent> = new Map();
  private idempotencyIndex: Map<string, string> = new Map(); // idempotencyKey -> taskId

  private constructor() {
    // Register default agents
    this.registerAgent(new ResearchAgent());
  }

  public static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  public registerAgent(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  public getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  public listAgents(): Array<{ id: string; name: string; description: string; version: string; capabilities: string[] }> {
    return Array.from(this.agents.values()).map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      version: a.version,
      capabilities: a.capabilities
    }));
  }

  /**
   * Submits and executes a task with persistent idempotency, database sync, and policy enforcement.
   */
  public async submitTask<TPayload = any, TResult = any>(
    options: CreateTaskOptions<TPayload>
  ): Promise<{ task: AiTask<TPayload, TResult>; isExisting: boolean }> {
    const correlation: CorrelationMetadata = options.correlation || {
      requestId: crypto.randomUUID(),
      idempotencyKey: options.idempotencyKey,
      source: 'n8n_orchestration'
    };

    // 1. Check idempotency in memory first
    if (options.idempotencyKey) {
      const existingTaskId = this.idempotencyIndex.get(options.idempotencyKey);
      if (existingTaskId) {
        let existingTask = this.tasks.get(existingTaskId);
        if (!existingTask) {
          existingTask = await this.getTaskAsync(existingTaskId);
        }
        if (existingTask) {
          return { task: existingTask as AiTask<TPayload, TResult>, isExisting: true };
        }
      }

      // Check persistent database for matching idempotency_key
      const dbTask = await aiDatabase.findTaskByIdempotencyKey(options.idempotencyKey);
      if (dbTask) {
        if (!dbTask.policy_level) {
          dbTask.policy_level = PolicyEngine.evaluateAction(dbTask.task_type).level;
        }
        if (!dbTask.metadata) {
          dbTask.metadata = correlation;
        }
        this.tasks.set(dbTask.id, dbTask);
        this.idempotencyIndex.set(options.idempotencyKey, dbTask.id);
        return { task: dbTask as AiTask<TPayload, TResult>, isExisting: true };
      }
    }

    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();
    const assignedAgent = options.assignedAgent || 'agent_research';
    const timeoutMs = options.timeoutMs || 60000;

    // 2. Evaluate Policy
    const policy = PolicyEngine.evaluateAction(options.taskType);

    const task: AiTask<TPayload, TResult> = {
      id: taskId,
      task_type: options.taskType,
      priority: options.priority || 'medium',
      status: 'queued',
      policy_level: policy.level,
      requested_by: options.requestedBy || 'n8n_control_plane',
      assigned_agent: assignedAgent,
      payload: options.payload,
      retry_count: 0,
      idempotency_key: options.idempotencyKey || null,
      metadata: correlation,
      timeout_ms: timeoutMs,
      created_at: now,
      updated_at: now,
    } as any;

    // If RED action: Reject immediately
    if (!policy.isAllowed) {
      task.status = 'failed';
      task.error = policy.reason;
      task.updated_at = now;
      task.completed_at = now;

      // Durable database persistence before reporting
      const persisted = await aiDatabase.insertTask(task);
      if (!persisted) {
        throw new Error(`Failed to persist AI task: ${policy.reason}`);
      }

      this.tasks.set(taskId, task);
      if (options.idempotencyKey) {
        this.idempotencyIndex.set(options.idempotencyKey, taskId);
      }

      this.recordAction({
        task_id: taskId,
        agent: assignedAgent,
        action: options.taskType,
        status: 'blocked_policy',
        policy_level: 'red',
        reason: policy.reason,
        input_summary: options.payload as any,
        error: policy.reason
      });

      this.createAlert({
        severity: 'critical',
        agent: assignedAgent,
        title: 'Policy Block: Forbidden AI Action Attempted',
        message: `Autonomous task '${options.taskType}' was blocked by policy: ${policy.reason}`,
        metadata: { taskId, payload: options.payload, correlation }
      });

      eventBus.emit('task.failed', task, correlation, options.webhookUrl);

      return { task, isExisting: false };
    }

    // If YELLOW action: Requires approval
    if (policy.requiresApproval) {
      task.status = 'waiting_approval';
      task.updated_at = now;

      const approvalId = crypto.randomUUID();
      const approval: AiApproval = {
        id: approvalId,
        task_id: taskId,
        action_name: options.taskType,
        agent: assignedAgent,
        policy_level: policy.level as 'yellow' | 'red',
        status: 'pending',
        description: `Autonomous task '${options.taskType}' requires editorial sign-off before proceeding.`,
        payload: options.payload as any,
        created_at: now
      };

      task.approval_id = approvalId;

      // Durable database persistence: insert approval and task before reporting success
      const approvalPersisted = await aiDatabase.insertApproval(approval);
      if (!approvalPersisted) {
        throw new Error('Failed to persist AI approval request');
      }

      const taskPersisted = await aiDatabase.insertTask(task);
      if (!taskPersisted) {
        throw new Error('Failed to persist AI task');
      }

      // Populate memory cache
      this.tasks.set(taskId, task);
      this.approvals.set(approvalId, approval);
      if (options.idempotencyKey) {
        this.idempotencyIndex.set(options.idempotencyKey, taskId);
      }

      this.recordAction({
        task_id: taskId,
        agent: assignedAgent,
        action: options.taskType,
        status: 'waiting_approval',
        policy_level: policy.level,
        reason: 'Task paused awaiting human approval.',
        input_summary: options.payload as any
      });

      eventBus.emit('task.waiting_approval', { task, approval }, correlation, options.webhookUrl);

      return { task, isExisting: false };
    }

    // If GREEN action: Persist task durably before reporting success
    const persisted = await aiDatabase.insertTask(task);
    if (!persisted) {
      throw new Error('Failed to persist AI task');
    }

    // Populate memory cache & index
    this.tasks.set(taskId, task);
    if (options.idempotencyKey) {
      this.idempotencyIndex.set(options.idempotencyKey, taskId);
    }

    // Emit created event
    eventBus.emit('task.created', task, correlation, options.webhookUrl);

    // Execute asynchronously with timeout boundary
    this.executeTask(taskId, options.webhookUrl).catch(err => {
      console.error(`[TaskManager] Background execution error on task ${taskId}:`, err);
    });

    return { task, isExisting: false };
  }

  /**
   * Internal worker loop executing an approved or green task with strict timeout safety.
   */
  public async executeTask(taskId: string, webhookUrl?: string): Promise<AiTask> {
    let task = this.tasks.get(taskId);
    if (!task) {
      task = await this.getTaskAsync(taskId);
    }
    if (!task) throw new Error(`Task '${taskId}' not found`);

    const agent = this.agents.get(task.assigned_agent);
    if (!agent) {
      task.status = 'failed';
      task.error = `Assigned agent '${task.assigned_agent}' is not registered.`;
      task.updated_at = new Date().toISOString();
      task.completed_at = task.updated_at;

      await aiDatabase.updateTask(taskId, {
        status: 'failed',
        error: task.error,
        completed_at: task.completed_at
      });

      eventBus.emit('task.failed', task, task.metadata as any, webhookUrl);
      return task;
    }

    task.status = 'running';
    task.updated_at = new Date().toISOString();

    await aiDatabase.updateTask(taskId, {
      status: 'running',
      updated_at: task.updated_at
    });

    eventBus.emit('task.started', task, task.metadata as any, webhookUrl);

    this.recordAction({
      task_id: taskId,
      agent: agent.id,
      action: task.task_type,
      status: 'started',
      policy_level: task.policy_level || 'green',
      input_summary: task.payload as any
    });

    // Timeout boundary execution
    const timeoutMs = task.timeout_ms || 60000;

    try {
      const executionPromise = agent.execute(task.payload, { 
        taskId, 
        metadata: task.metadata 
      });

      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<{ isTimeout: true }>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`TASK_TIMEOUT: Execution exceeded boundary of ${timeoutMs}ms`)), timeoutMs);
        timer.unref();
      });

      let result: any;
      try {
        result = await Promise.race([executionPromise, timeoutPromise]) as any;
      } finally {
        clearTimeout(timer!);
      }

      if (result.success) {
        task.status = 'completed';
        task.result = result.data;
        task.updated_at = new Date().toISOString();
        task.completed_at = task.updated_at;

        await aiDatabase.updateTask(taskId, {
          status: 'completed',
          result: result.data,
          completed_at: task.completed_at
        });

        this.recordAction({
          task_id: taskId,
          agent: agent.id,
          action: task.task_type,
          status: 'succeeded',
          policy_level: task.policy_level || 'green',
          confidence: result.confidence,
          reason: result.reasoningSummary,
          input_summary: task.payload as any,
          output_summary: {
            claimsCount: (result.data as any)?.key_claims?.length,
            sourcesCount: (result.data as any)?.sources?.length,
            anglesCount: (result.data as any)?.potential_article_angles?.length
          }
        });

        eventBus.emit('task.completed', task, task.metadata as any, webhookUrl);
      } else {
        task.status = 'failed';
        task.error = result.error || 'Agent execution failed';
        task.updated_at = new Date().toISOString();
        task.completed_at = task.updated_at;

        await aiDatabase.updateTask(taskId, {
          status: 'failed',
          error: task.error,
          completed_at: task.completed_at
        });

        this.recordAction({
          task_id: taskId,
          agent: agent.id,
          action: task.task_type,
          status: 'failed',
          policy_level: task.policy_level || 'green',
          reason: result.reasoningSummary,
          error: result.error,
          input_summary: task.payload as any
        });

        eventBus.emit('task.failed', task, task.metadata as any, webhookUrl);
      }
    } catch (err: any) {
      const isTimeout = err?.message?.includes('TASK_TIMEOUT');
      task.status = 'failed';
      task.error = isTimeout 
        ? `Task execution timed out after ${timeoutMs}ms` 
        : (err?.message || 'Unknown execution failure');
      task.updated_at = new Date().toISOString();
      task.completed_at = task.updated_at;

      await aiDatabase.updateTask(taskId, {
        status: 'failed',
        error: task.error,
        completed_at: task.completed_at
      });

      this.recordAction({
        task_id: taskId,
        agent: agent.id,
        action: task.task_type,
        status: 'failed',
        policy_level: task.policy_level || 'green',
        error: task.error,
        input_summary: task.payload as any
      });

      if (isTimeout) {
        this.createAlert({
          severity: 'warning',
          agent: agent.id,
          title: 'Execution Timeout Exceeded',
          message: `Task '${task.id}' (${task.task_type}) timed out after ${timeoutMs}ms`,
          metadata: { taskId, timeoutMs, correlation: task.metadata }
        });
      }

      eventBus.emit('task.failed', task, task.metadata as any, webhookUrl);
    }

    return task;
  }

  /**
   * Approves a waiting task and resumes execution.
   */
  public async approveTask(approvalId: string, decidedBy = 'admin', reason = 'Approved by editor'): Promise<{ success: boolean; task?: AiTask; error?: string }> {
    let approval = this.approvals.get(approvalId);
    if (!approval) {
      approval = await this.getApprovalAsync(approvalId);
    }
    if (!approval) return { success: false, error: 'Approval request not found' };
    if (approval.status !== 'pending') return { success: false, error: `Approval is already ${approval.status}` };

    approval.status = 'approved';
    approval.decided_by = decidedBy;
    approval.decision_reason = reason;
    approval.decided_at = new Date().toISOString();

    await aiDatabase.updateApproval(approvalId, {
      status: 'approved',
      decided_by: decidedBy,
      decision_reason: reason,
      decided_at: approval.decided_at
    });

    eventBus.emit('approval.decided', approval);

    if (approval.task_id) {
      let task = this.tasks.get(approval.task_id);
      if (!task) {
        task = await this.getTaskAsync(approval.task_id);
      }
      if (task) {
        task.status = 'queued';
        task.updated_at = new Date().toISOString();
        await aiDatabase.updateTask(task.id, { status: 'queued', updated_at: task.updated_at });
        this.executeTask(task.id).catch(() => {});
        return { success: true, task };
      }
    }

    return { success: true };
  }

  /**
   * Rejects a waiting task.
   */
  public async rejectTask(approvalId: string, decidedBy = 'admin', reason = 'Rejected by editor'): Promise<{ success: boolean; task?: AiTask; error?: string }> {
    let approval = this.approvals.get(approvalId);
    if (!approval) {
      approval = await this.getApprovalAsync(approvalId);
    }
    if (!approval) return { success: false, error: 'Approval request not found' };
    if (approval.status !== 'pending') return { success: false, error: `Approval is already ${approval.status}` };

    approval.status = 'rejected';
    approval.decided_by = decidedBy;
    approval.decision_reason = reason;
    approval.decided_at = new Date().toISOString();

    await aiDatabase.updateApproval(approvalId, {
      status: 'rejected',
      decided_by: decidedBy,
      decision_reason: reason,
      decided_at: approval.decided_at
    });

    eventBus.emit('approval.decided', approval);

    if (approval.task_id) {
      let task = this.tasks.get(approval.task_id);
      if (!task) {
        task = await this.getTaskAsync(approval.task_id);
      }
      if (task) {
        task.status = 'cancelled';
        task.error = `Rejected by human supervisor: ${reason}`;
        task.updated_at = new Date().toISOString();
        task.completed_at = task.updated_at;

        await aiDatabase.updateTask(task.id, {
          status: 'cancelled',
          error: task.error,
          completed_at: task.completed_at
        });

        eventBus.emit('task.failed', task, task.metadata as any);
        return { success: true, task };
      }
    }

    return { success: true };
  }

  /**
   * Records an immutable audit log entry.
   */
  public recordAction(action: Omit<AiAction, 'id' | 'created_at'>): AiAction {
    const now = new Date().toISOString();
    const entry: AiAction = {
      id: crypto.randomUUID(),
      created_at: now,
      ...action
    };
    this.actions.unshift(entry);
    aiDatabase.insertAction(entry).catch(() => {});
    return entry;
  }

  /**
   * Creates an operational alert.
   */
  public createAlert(alert: Omit<AiAlert, 'id' | 'is_dismissed' | 'created_at'>): AiAlert {
    const entry: AiAlert = {
      id: crypto.randomUUID(),
      is_dismissed: false,
      created_at: new Date().toISOString(),
      ...alert
    };
    this.alerts.unshift(entry);
    aiDatabase.insertAlert(entry).catch(() => {});
    return entry;
  }

  public dismissAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.is_dismissed = true;
      aiDatabase.dismissAlert(alertId).catch(() => {});
      return true;
    }
    return false;
  }

  // Getters for Command Center and API Polling
  public getTask(taskId: string): AiTask | undefined {
    return this.tasks.get(taskId);
  }

  public async getTaskAsync(taskId: string): Promise<AiTask | undefined> {
    const cached = this.tasks.get(taskId);
    if (cached) return cached;

    const dbTask = await aiDatabase.getTask(taskId);
    if (dbTask) {
      if (!dbTask.policy_level) {
        dbTask.policy_level = PolicyEngine.evaluateAction(dbTask.task_type).level;
      }
      if (!dbTask.metadata) {
        dbTask.metadata = {
          requestId: dbTask.id,
          idempotencyKey: dbTask.idempotency_key || undefined,
          source: 'database_recovery'
        };
      }
      if (!dbTask.timeout_ms) {
        dbTask.timeout_ms = 60000;
      }
      this.tasks.set(dbTask.id, dbTask);
      if (dbTask.idempotency_key) {
        this.idempotencyIndex.set(dbTask.idempotency_key, dbTask.id);
      }
      return dbTask;
    }
    return undefined;
  }

  public async getApprovalAsync(approvalId: string): Promise<AiApproval | undefined> {
    const cached = this.approvals.get(approvalId);
    if (cached) return cached;

    const dbApproval = await aiDatabase.getApproval(approvalId);
    if (dbApproval) {
      this.approvals.set(dbApproval.id, dbApproval);
      return dbApproval;
    }
    return undefined;
  }

  public clearMemoryCache(): void {
    this.tasks.clear();
    this.approvals.clear();
    this.idempotencyIndex.clear();
  }

  public listTasks(limit = 50, status?: AiTaskStatus): AiTask[] {
    let list = Array.from(this.tasks.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (status) {
      list = list.filter(t => t.status === status);
    }
    return list.slice(0, limit);
  }

  public async listTasksAsync(limit = 50, status?: AiTaskStatus): Promise<AiTask[]> {
    const dbTasks = await aiDatabase.listTasks(limit, status);
    if (dbTasks && dbTasks.length > 0) {
      for (const t of dbTasks) {
        if (!t.policy_level) {
          t.policy_level = PolicyEngine.evaluateAction(t.task_type).level;
        }
        this.tasks.set(t.id, t);
        if (t.idempotency_key) {
          this.idempotencyIndex.set(t.idempotency_key, t.id);
        }
      }
      return dbTasks;
    }
    return this.listTasks(limit, status);
  }

  public listActions(limit = 50): AiAction[] {
    return this.actions.slice(0, limit);
  }

  public listApprovals(status?: 'pending' | 'approved' | 'rejected', limit = 50): AiApproval[] {
    let list = Array.from(this.approvals.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (status) {
      list = list.filter(a => a.status === status);
    }
    return list.slice(0, limit);
  }

  public async listApprovalsAsync(status?: 'pending' | 'approved' | 'rejected', limit = 50): Promise<AiApproval[]> {
    const dbApprovals = await aiDatabase.listApprovals(status);
    if (dbApprovals && dbApprovals.length > 0) {
      for (const a of dbApprovals) {
        this.approvals.set(a.id, a);
      }
      return dbApprovals.slice(0, limit);
    }
    return this.listApprovals(status, limit);
  }

  public listAlerts(includeDismissed = false): AiAlert[] {
    if (includeDismissed) return this.alerts;
    return this.alerts.filter(a => !a.is_dismissed);
  }

  public getSystemMetrics() {
    const tasks = Array.from(this.tasks.values());
    const dbStatus = aiDatabase.getStatus();
    const webhookStats = eventBus.getWebhookStats();

    return {
      totalTasks: tasks.length,
      queued: tasks.filter(t => t.status === 'queued').length,
      running: tasks.filter(t => t.status === 'running').length,
      waitingApproval: tasks.filter(t => t.status === 'waiting_approval').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      pendingApprovalsCount: Array.from(this.approvals.values()).filter(a => a.status === 'pending').length,
      activeAlertsCount: this.alerts.filter(a => !a.is_dismissed).length,
      totalActionsLogged: this.actions.length,
      registeredAgentsCount: this.agents.size,
      databasePersistence: {
        isAvailable: aiDatabase.isAvailable(),
        hasServiceRole: dbStatus.hasServiceRole,
        schema: dbStatus.targetSchema
      },
      webhooks: {
        totalDispatched: webhookStats.totalDispatched,
        deliveredCount: webhookStats.deliveredCount,
        failedCount: webhookStats.failedCount
      }
    };
  }
}

export const taskManager = TaskManager.getInstance();
