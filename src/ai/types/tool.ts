import { ZodSchema, z } from 'zod';
import { PolicyLevel } from '../../types';

export interface ToolExecutionContext {
  agentId: string;
  taskId?: string;
  userId?: string;
  bypassApproval?: boolean;
}

export interface ToolExecutionResult<TResult = any> {
  success: boolean;
  result?: TResult;
  error?: string;
  reversible?: boolean;
  targetEntity?: string;
  targetEntityId?: string;
}

export interface ITool<TParams = any, TResult = any> {
  readonly name: string;
  readonly description: string;
  readonly parameters: ZodSchema<TParams>;
  readonly policyLevel: PolicyLevel;
  readonly permissions: string[];
  readonly reversible: boolean;

  /**
   * Validates parameters against tool schema.
   */
  validate(params: unknown): { success: boolean; data?: TParams; errors?: z.ZodIssue[] };

  /**
   * Executes the tool logic safely through controlled application boundaries.
   */
  execute(params: TParams, context: ToolExecutionContext): Promise<ToolExecutionResult<TResult>>;

  /**
   * Optional rollback mechanism if the action is reversible.
   */
  rollback?(targetEntityId: string, context: ToolExecutionContext): Promise<{ success: boolean; error?: string }>;
}
