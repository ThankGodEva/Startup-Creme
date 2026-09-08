import { z } from 'zod';
import { ResearchInputSchema } from '../agents/research/researchSchemas';
import { AiTaskStatus, AiTaskPriority, PolicyLevel } from '../../types';

// --------------------------------------------------------------------
// 1. Core Enums and Identifiers
// --------------------------------------------------------------------

export const TaskPriorityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export const TaskStatusEnum = z.enum([
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled'
]);
export const PolicyLevelEnum = z.enum(['green', 'yellow', 'red']);

// Known registered task types
export const RegisteredTaskTypeEnum = z.enum([
  'research_topic',
  'review_content',
  'publish_article',
  'social_repurpose'
]);

// --------------------------------------------------------------------
// 2. Correlation Metadata
// --------------------------------------------------------------------

export const CorrelationMetadataSchema = z.object({
  requestId: z.string().optional(),
  workflowId: z.string().optional(),
  executionId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  source: z.string().default('n8n_orchestration')
});

export type CorrelationMetadata = z.infer<typeof CorrelationMetadataSchema>;

// --------------------------------------------------------------------
// 3. Task Submission Request Contract (POST /api/ai/tasks)
// --------------------------------------------------------------------

export const SubmitTaskRequestSchema = z.object({
  // Accept both snake_case and camelCase
  task_type: z.string().min(1).optional(),
  taskType: z.string().min(1).optional(),
  
  priority: TaskPriorityEnum.default('medium'),
  
  assigned_agent: z.string().optional(),
  assignedAgent: z.string().optional(),
  
  requested_by: z.string().default('n8n_control_plane'),
  requestedBy: z.string().optional(),
  
  payload: z.record(z.string(), z.any()).default({}),
  
  idempotency_key: z.string().min(4).max(256).optional(),
  idempotencyKey: z.string().min(4).max(256).optional(),
  
  correlation: CorrelationMetadataSchema.partial().optional(),
  
  webhook_url: z.string().url().optional(),
  webhookUrl: z.string().url().optional(),
  
  timeout_ms: z.number().int().min(1000).max(300000).default(60000),
  timeoutMs: z.number().int().min(1000).max(300000).optional()
}).transform(data => {
  const finalTaskType = (data.taskType || data.task_type || '').trim();
  const finalAssignedAgent = (data.assignedAgent || data.assigned_agent || '').trim();
  const finalRequestedBy = (data.requestedBy || data.requested_by || 'n8n_control_plane').trim();
  const finalIdempotencyKey = (data.idempotencyKey || data.idempotency_key || '').trim() || undefined;
  const finalWebhookUrl = data.webhookUrl || data.webhook_url;
  const finalTimeoutMs = data.timeoutMs || data.timeout_ms;

  return {
    taskType: finalTaskType,
    priority: data.priority,
    assignedAgent: finalAssignedAgent,
    requestedBy: finalRequestedBy,
    payload: data.payload,
    idempotencyKey: finalIdempotencyKey,
    correlation: {
      requestId: data.correlation?.requestId,
      workflowId: data.correlation?.workflowId,
      executionId: data.correlation?.executionId,
      idempotencyKey: finalIdempotencyKey || data.correlation?.idempotencyKey,
      source: data.correlation?.source || 'n8n_orchestration'
    },
    webhookUrl: finalWebhookUrl,
    timeoutMs: finalTimeoutMs
  };
});

export type SubmitTaskRequest = z.infer<typeof SubmitTaskRequestSchema>;

// --------------------------------------------------------------------
// 4. Standard Task Result Envelope (AITaskResult)
// --------------------------------------------------------------------

export interface TaskErrorDetails {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export const TaskErrorDetailsSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean(),
  details: z.any().optional()
});

export interface AITaskResult<TData = any> {
  success: boolean;
  data?: TData;
  error?: TaskErrorDetails;
  confidence: number;
  reasoningSummary: string;
  audit?: {
    agentId: string;
    agentName: string;
    startTime: string;
    endTime?: string;
    durationMs?: number;
    modelUsed?: string;
    claimsVerified?: number;
    sourcesExamined?: number;
    confidenceScore?: number;
  };
}

// --------------------------------------------------------------------
// 5. Task Status & Polling Response Contract (GET /api/ai/tasks/:taskId)
// --------------------------------------------------------------------

export interface TaskStatusResponse {
  taskId: string;
  taskType: string;
  status: AiTaskStatus;
  priority: AiTaskPriority;
  policyLevel: PolicyLevel;
  correlation: CorrelationMetadata;
  result: AITaskResult | null;
  error: TaskErrorDetails | null;
  approval: {
    id: string;
    status: string;
    description: string;
    decidedBy?: string | null;
    decisionReason?: string | null;
  } | null;
  timestamps: {
    createdAt: string;
    updatedAt: string;
    completedAt?: string | null;
    durationMs?: number | null;
  };
  pollUrl: string;
}

// --------------------------------------------------------------------
// 6. Error Taxonomy & Codes
// --------------------------------------------------------------------

export const AIErrorCodes = {
  // Authentication & Security
  UNAUTHORIZED_AUTOMATION: 'UNAUTHORIZED_AUTOMATION',
  FORBIDDEN: 'FORBIDDEN',
  POLICY_BLOCKED_RED: 'POLICY_BLOCKED_RED',
  PROMPT_INJECTION_DETECTED: 'PROMPT_INJECTION_DETECTED',
  
  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_TASK_TYPE: 'UNKNOWN_TASK_TYPE',
  UNKNOWN_TOOL: 'UNKNOWN_TOOL',
  
  // Rate Limiting & Resource
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TASK_TIMEOUT: 'TASK_TIMEOUT',
  
  // Execution & Provider
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  AGENT_EXECUTION_FAILED: 'AGENT_EXECUTION_FAILED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export function isRetryableErrorCode(code: string): boolean {
  switch (code) {
    case AIErrorCodes.RATE_LIMIT_EXCEEDED:
    case AIErrorCodes.TASK_TIMEOUT:
    case AIErrorCodes.PROVIDER_UNAVAILABLE:
      return true;
    default:
      return false;
  }
}

export function createTaskError(
  code: string,
  message: string,
  retryable = isRetryableErrorCode(code),
  details?: unknown
): TaskErrorDetails {
  return {
    code,
    message,
    retryable,
    details
  };
}
