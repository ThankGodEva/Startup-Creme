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
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export interface CreateTaskOptions<TPayload = any> {
  taskType: string;
  assignedAgent: string;
  payload: TPayload;
  priority?: AiTaskPriority;
  requestedBy?: string;
  idempotencyKey?: string;
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
   * Submits and executes a task with idempotency and policy enforcement.
   */
  public async submitTask<TPayload = any, TResult = any>(
    options: CreateTaskOptions<TPayload>
  ): Promise<{ task: AiTask<TPayload, TResult>; isExisting: boolean }> {
    // 1. Check idempotency
    if (options.idempotencyKey) {
      const existingTaskId = this.idempotencyIndex.get(options.idempotencyKey);
      if (existingTaskId) {
        const existingTask = this.tasks.get(existingTaskId);
        if (existingTask) {
          return { task: existingTask as AiTask<TPayload, TResult>, isExisting: true };
        }
      }
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const task: AiTask<TPayload, TResult> = {
      id: taskId,
      task_type: options.taskType,
      priority: options.priority || 'medium',
      status: 'queued',
      requestedBy: options.requestedBy || 'system',
      assigned_agent: options.assignedAgent,
      payload: options.payload,
      retry_count: 0,
      idempotency_key: options.idempotencyKey || null,
      created_at: now,
      updated_at: now,
    } as any;

    this.tasks.set(taskId, task);
    if (options.idempotencyKey) {
      this.idempotencyIndex.set(options.idempotencyKey, taskId);
    }

    // 2. Evaluate Policy
    const policy = PolicyEngine.evaluateAction(options.taskType);

    // If RED action: Reject immediately
    if (!policy.isAllowed) {
      task.status = 'failed';
      task.error = policy.reason;
      task.updated_at = new Date().toISOString();
      task.completed_at = task.updated_at;

      this.recordAction({
        task_id: taskId,
        agent: options.assignedAgent,
        action: options.taskType,
        status: 'blocked_policy',
        policy_level: 'red',
        reason: policy.reason,
        input_summary: options.payload as any,
        error: policy.reason
      });

      this.createAlert({
        severity: 'critical',
        agent: options.assignedAgent,
        title: 'Policy Block: Forbidden AI Action Attempted',
        message: `Autonomous task '${options.taskType}' was blocked: ${policy.reason}`,
        metadata: { taskId, payload: options.payload }
      });

      return { task, isExisting: false };
    }

    // If YELLOW action: Requires approval
    if (policy.requiresApproval) {
      task.status = 'waiting_approval';
      task.updated_at = new Date().toISOString();

      const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const approval: AiApproval = {
        id: approvalId,
        task_id: taskId,
        action_name: options.taskType,
        agent: options.assignedAgent,
        policy_level: policy.level as 'yellow' | 'red',
        status: 'pending',
        description: `Autonomous task '${options.taskType}' requires editorial sign-off before proceeding.`,
        payload: options.payload as any,
        created_at: now
      };

      this.approvals.set(approvalId, approval);
      task.approval_id = approvalId;

      this.recordAction({
        task_id: taskId,
        agent: options.assignedAgent,
        action: options.taskType,
        status: 'waiting_approval',
        policy_level: policy.level,
        reason: 'Task paused awaiting human approval.',
        input_summary: options.payload as any
      });

      return { task, isExisting: false };
    }

    // If GREEN action: Execute immediately
    this.executeTask(taskId);

    return { task, isExisting: false };
  }

  /**
   * Internal worker loop executing an approved or green task.
   */
  public async executeTask(taskId: string): Promise<AiTask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task '${taskId}' not found`);

    const agent = this.agents.get(task.assigned_agent);
    if (!agent) {
      task.status = 'failed';
      task.error = `Assigned agent '${task.assigned_agent}' is not registered.`;
      task.updated_at = new Date().toISOString();
      task.completed_at = task.updated_at;
      return task;
    }

    task.status = 'running';
    task.updated_at = new Date().toISOString();

    this.recordAction({
      task_id: taskId,
      agent: agent.id,
      action: task.task_type,
      status: 'started',
      policy_level: 'green',
      input_summary: task.payload as any
    });

    try {
      const result = await agent.execute(task.payload, { taskId });

      if (result.success) {
        task.status = 'completed';
        task.result = result.data;
        task.updated_at = new Date().toISOString();
        task.completed_at = task.updated_at;

        this.recordAction({
          task_id: taskId,
          agent: agent.id,
          action: task.task_type,
          status: 'succeeded',
          policy_level: 'green',
          confidence: result.confidence,
          reason: result.reasoningSummary,
          input_summary: task.payload as any,
          output_summary: {
            claimsCount: (result.data as any)?.key_claims?.length,
            sourcesCount: (result.data as any)?.sources?.length,
            anglesCount: (result.data as any)?.potential_article_angles?.length
          }
        });
      } else {
        task.status = 'failed';
        task.error = result.error || 'Agent execution failed';
        task.updated_at = new Date().toISOString();
        task.completed_at = task.updated_at;

        this.recordAction({
          task_id: taskId,
          agent: agent.id,
          action: task.task_type,
          status: 'failed',
          policy_level: 'green',
          reason: result.reasoningSummary,
          error: result.error,
          input_summary: task.payload as any
        });
      }
    } catch (err: any) {
      task.status = 'failed';
      task.error = err?.message || 'Unknown execution failure';
      task.updated_at = new Date().toISOString();
      task.completed_at = task.updated_at;

      this.recordAction({
        task_id: taskId,
        agent: agent.id,
        action: task.task_type,
        status: 'failed',
        policy_level: 'green',
        error: err?.message,
        input_summary: task.payload as any
      });
    }

    return task;
  }

  /**
   * Approves a waiting task and resumes execution.
   */
  public async approveTask(approvalId: string, decidedBy = 'admin', reason = 'Approved by editor'): Promise<{ success: boolean; task?: AiTask; error?: string }> {
    const approval = this.approvals.get(approvalId);
    if (!approval) return { success: false, error: 'Approval request not found' };
    if (approval.status !== 'pending') return { success: false, error: `Approval is already ${approval.status}` };

    approval.status = 'approved';
    approval.decided_by = decidedBy;
    approval.decision_reason = reason;
    approval.decided_at = new Date().toISOString();

    if (approval.task_id) {
      const task = this.tasks.get(approval.task_id);
      if (task) {
        task.status = 'queued';
        await this.executeTask(task.id);
        return { success: true, task };
      }
    }

    return { success: true };
  }

  /**
   * Rejects a waiting task.
   */
  public async rejectTask(approvalId: string, decidedBy = 'admin', reason = 'Rejected by editor'): Promise<{ success: boolean; task?: AiTask; error?: string }> {
    const approval = this.approvals.get(approvalId);
    if (!approval) return { success: false, error: 'Approval request not found' };
    if (approval.status !== 'pending') return { success: false, error: `Approval is already ${approval.status}` };

    approval.status = 'rejected';
    approval.decided_by = decidedBy;
    approval.decision_reason = reason;
    approval.decided_at = new Date().toISOString();

    if (approval.task_id) {
      const task = this.tasks.get(approval.task_id);
      if (task) {
        task.status = 'cancelled';
        task.error = `Rejected by human supervisor: ${reason}`;
        task.updated_at = new Date().toISOString();
        task.completed_at = task.updated_at;
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
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: now,
      ...action
    };
    this.actions.unshift(entry);
    return entry;
  }

  /**
   * Creates an operational alert.
   */
  public createAlert(alert: Omit<AiAlert, 'id' | 'is_dismissed' | 'created_at'>): AiAlert {
    const entry: AiAlert = {
      id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      is_dismissed: false,
      created_at: new Date().toISOString(),
      ...alert
    };
    this.alerts.unshift(entry);
    return entry;
  }

  public dismissAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.is_dismissed = true;
      return true;
    }
    return false;
  }

  // Getters for Command Center
  public getTask(taskId: string): AiTask | undefined {
    return this.tasks.get(taskId);
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

  public listActions(limit = 50): AiAction[] {
    return this.actions.slice(0, limit);
  }

  public listApprovals(status?: 'pending' | 'approved' | 'rejected'): AiApproval[] {
    let list = Array.from(this.approvals.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (status) {
      list = list.filter(a => a.status === status);
    }
    return list;
  }

  public listAlerts(includeDismissed = false): AiAlert[] {
    if (includeDismissed) return this.alerts;
    return this.alerts.filter(a => !a.is_dismissed);
  }

  public getSystemMetrics() {
    const tasks = Array.from(this.tasks.values());
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
      registeredAgentsCount: this.agents.size
    };
  }
}

export const taskManager = TaskManager.getInstance();
