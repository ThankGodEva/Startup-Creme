import { z, ZodSchema } from 'zod';
import { PolicyLevel } from '../../types';

export interface AgentContext {
  taskId?: string;
  requestedBy?: string;
  policyLevel?: PolicyLevel;
  executionId?: string;
  metadata?: Record<string, any>;
}

export interface AgentAuditMetadata {
  agentId: string;
  agentName: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  tokensUsed?: number;
  modelUsed?: string;
  claimsVerified?: number;
  sourcesExamined?: number;
  confidenceScore?: number;
}

export interface AgentExecutionResult<TOutput = any> {
  success: boolean;
  data?: TOutput;
  error?: string;
  confidence: number;
  audit: AgentAuditMetadata;
  reasoningSummary: string;
}

export interface IAgent<TInput = any, TOutput = any> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly capabilities: string[];
  readonly permissions: string[];
  readonly defaultPolicyLevel: PolicyLevel;
  readonly inputSchema: ZodSchema<TInput>;
  readonly outputSchema: ZodSchema<TOutput>;

  /**
   * Validates raw input against the agent's input schema.
   */
  validateInput(input: unknown): { success: boolean; data?: TInput; errors?: z.ZodIssue[] };

  /**
   * Validates raw output against the agent's output schema.
   */
  validateOutput(output: unknown): { success: boolean; data?: TOutput; errors?: z.ZodIssue[] };

  /**
   * Executes the agent's specific responsibility.
   */
  execute(input: TInput, context?: AgentContext): Promise<AgentExecutionResult<TOutput>>;
}
