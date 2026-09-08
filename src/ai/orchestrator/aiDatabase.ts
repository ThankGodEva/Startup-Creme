import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AiTask, AiAction, AiApproval, AiAlert, AiTaskStatus } from '../../types';

export class AIDatabase {
  private static instance: AIDatabase;
  private client: SupabaseClient<any, any, any> | null = null;
  private isConfigured = false;
  private hasServiceRole = false;

  private constructor() {
    this.initClient();
  }

  public static getInstance(): AIDatabase {
    if (!AIDatabase.instance) {
      AIDatabase.instance = new AIDatabase();
    }
    return AIDatabase.instance;
  }

  private initClient() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    const chosenKey = serviceRoleKey || anonKey;

    if (url && chosenKey && !url.includes('your-supabase-project')) {
      try {
        this.client = createClient(url, chosenKey, {
          db: {
            schema: 'startupcreme'
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        this.isConfigured = true;
        this.hasServiceRole = Boolean(serviceRoleKey);
      } catch (e) {
        console.warn('[AIDatabase] Failed to initialize Supabase client:', e);
        this.client = null;
        this.isConfigured = false;
      }
    }
  }

  public isAvailable(): boolean {
    return this.isConfigured && this.client !== null;
  }

  public getStatus() {
    return {
      configured: this.isConfigured,
      hasServiceRole: this.hasServiceRole,
      targetSchema: 'startupcreme'
    };
  }

  // --------------------------------------------------------------------
  // AI Tasks Persistence
  // --------------------------------------------------------------------

  public async findTaskByIdempotencyKey(key: string): Promise<AiTask | null> {
    if (!this.client || !this.isConfigured) return null;
    try {
      const { data, error } = await this.client
        .from('ai_tasks')
        .select('*')
        .eq('idempotency_key', key)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[AIDatabase] findTaskByIdempotencyKey error:', error.message);
        return null;
      }
      return data as AiTask | null;
    } catch (err: any) {
      console.warn('[AIDatabase] findTaskByIdempotencyKey exception:', err?.message);
      return null;
    }
  }

  public async getTask(taskId: string): Promise<AiTask | null> {
    if (!this.client || !this.isConfigured) return null;
    try {
      const { data, error } = await this.client
        .from('ai_tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle();

      if (error) {
        console.warn('[AIDatabase] getTask error:', error.message);
        return null;
      }
      return data as AiTask | null;
    } catch (err: any) {
      console.warn('[AIDatabase] getTask exception:', err?.message);
      return null;
    }
  }

  public async insertTask(task: AiTask): Promise<boolean> {
    if (!this.client || !this.isConfigured) return false;
    try {
      const row: any = {
        id: task.id,
        task_type: task.task_type,
        priority: task.priority,
        status: task.status,
        requested_by: task.requested_by,
        assigned_agent: task.assigned_agent,
        payload: task.payload || {},
        result: task.result || null,
        error: task.error || null,
        retry_count: task.retry_count || 0,
        idempotency_key: task.idempotency_key || null,
        approval_id: task.approval_id || null,
        created_at: task.created_at,
        updated_at: task.updated_at,
        completed_at: task.completed_at || null
      };

      const { error } = await this.client.from('ai_tasks').insert(row);
      if (error) {
        console.warn('[AIDatabase] insertTask error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[AIDatabase] insertTask exception:', err?.message);
      return false;
    }
  }

  public async updateTask(taskId: string, updates: Partial<AiTask>): Promise<boolean> {
    if (!this.client || !this.isConfigured) return false;
    try {
      const payload: any = {
        updated_at: new Date().toISOString()
      };
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.result !== undefined) payload.result = updates.result;
      if (updates.error !== undefined) payload.error = updates.error;
      if (updates.retry_count !== undefined) payload.retry_count = updates.retry_count;
      if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;
      if (updates.approval_id !== undefined) payload.approval_id = updates.approval_id;

      const { error } = await this.client
        .from('ai_tasks')
        .update(payload)
        .eq('id', taskId);

      if (error) {
        console.warn('[AIDatabase] updateTask error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[AIDatabase] updateTask exception:', err?.message);
      return false;
    }
  }

  public async listTasks(limit = 50, status?: AiTaskStatus): Promise<AiTask[]> {
    if (!this.client || !this.isConfigured) return [];
    try {
      let query = this.client
        .from('ai_tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[AIDatabase] listTasks error:', error.message);
        return [];
      }
      return (data as AiTask[]) || [];
    } catch (err: any) {
      console.warn('[AIDatabase] listTasks exception:', err?.message);
      return [];
    }
  }

  // --------------------------------------------------------------------
  // AI Actions (Audit Log)
  // --------------------------------------------------------------------

  public async insertAction(action: AiAction): Promise<boolean> {
    if (!this.client || !this.isConfigured) return false;
    try {
      const row: any = {
        id: action.id,
        task_id: action.task_id || null,
        agent: action.agent,
        action: action.action,
        status: action.status,
        policy_level: action.policy_level,
        input_summary: action.input_summary || null,
        output_summary: action.output_summary || null,
        confidence: action.confidence || null,
        reason: action.reason || null,
        target_entity: action.target_entity || null,
        target_entity_id: action.target_entity_id || null,
        error: action.error || null,
        created_at: action.created_at,
        completed_at: action.completed_at || null
      };

      const { error } = await this.client.from('ai_actions').insert(row);
      if (error) {
        console.warn('[AIDatabase] insertAction error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[AIDatabase] insertAction exception:', err?.message);
      return false;
    }
  }

  public async listActions(limit = 50): Promise<AiAction[]> {
    if (!this.client || !this.isConfigured) return [];
    try {
      const { data, error } = await this.client
        .from('ai_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('[AIDatabase] listActions error:', error.message);
        return [];
      }
      return (data as AiAction[]) || [];
    } catch (err: any) {
      console.warn('[AIDatabase] listActions exception:', err?.message);
      return [];
    }
  }

  // --------------------------------------------------------------------
  // AI Approvals Persistence
  // --------------------------------------------------------------------

  public async insertApproval(approval: AiApproval): Promise<boolean> {
    if (!this.client || !this.isConfigured) return false;
    try {
      const row: any = {
        id: approval.id,
        task_id: approval.task_id || null,
        action_name: approval.action_name,
        agent: approval.agent,
        policy_level: approval.policy_level,
        status: approval.status,
        description: approval.description,
        payload: approval.payload || {},
        decided_by: approval.decided_by || null,
        decision_reason: approval.decision_reason || null,
        created_at: approval.created_at,
        decided_at: approval.decided_at || null
      };

      const { error } = await this.client.from('ai_approvals').insert(row);
      if (error) {
        console.warn('[AIDatabase] insertApproval error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[AIDatabase] insertApproval exception:', err?.message);
      return false;
    }
  }

  public async updateApproval(approvalId: string, updates: Partial<AiApproval>): Promise<boolean> {
    if (!this.client || !this.isConfigured) return false;
    try {
      const payload: any = {};
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.decided_by !== undefined) payload.decided_by = updates.decided_by;
      if (updates.decision_reason !== undefined) payload.decision_reason = updates.decision_reason;
      if (updates.decided_at !== undefined) payload.decided_at = updates.decided_at;

      const { error } = await this.client
        .from('ai_approvals')
        .update(payload)
        .eq('id', approvalId);

      if (error) {
        console.warn('[AIDatabase] updateApproval error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[AIDatabase] updateApproval exception:', err?.message);
      return false;
    }
  }

  public async listApprovals(status?: string): Promise<AiApproval[]> {
    if (!this.client || !this.isConfigured) return [];
    try {
      let query = this.client
        .from('ai_approvals')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[AIDatabase] listApprovals error:', error.message);
        return [];
      }
      return (data as AiApproval[]) || [];
    } catch (err: any) {
      console.warn('[AIDatabase] listApprovals exception:', err?.message);
      return [];
    }
  }

  // --------------------------------------------------------------------
  // AI Alerts Persistence
  // --------------------------------------------------------------------

  public async insertAlert(alert: AiAlert): Promise<boolean> {
    if (!this.client || !this.isConfigured) return false;
    try {
      const row: any = {
        id: alert.id,
        severity: alert.severity,
        agent: alert.agent,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata || {},
        is_dismissed: alert.is_dismissed,
        created_at: alert.created_at
      };

      const { error } = await this.client.from('ai_alerts').insert(row);
      if (error) {
        console.warn('[AIDatabase] insertAlert error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[AIDatabase] insertAlert exception:', err?.message);
      return false;
    }
  }

  public async dismissAlert(alertId: string): Promise<boolean> {
    if (!this.client || !this.isConfigured) return false;
    try {
      const { error } = await this.client
        .from('ai_alerts')
        .update({ is_dismissed: true })
        .eq('id', alertId);

      if (error) {
        console.warn('[AIDatabase] dismissAlert error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[AIDatabase] dismissAlert exception:', err?.message);
      return false;
    }
  }

  public async listAlerts(includeDismissed = false): Promise<AiAlert[]> {
    if (!this.client || !this.isConfigured) return [];
    try {
      let query = this.client
        .from('ai_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!includeDismissed) {
        query = query.eq('is_dismissed', false);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('[AIDatabase] listAlerts error:', error.message);
        return [];
      }
      return (data as AiAlert[]) || [];
    } catch (err: any) {
      console.warn('[AIDatabase] listAlerts exception:', err?.message);
      return [];
    }
  }
}

export const aiDatabase = AIDatabase.getInstance();
