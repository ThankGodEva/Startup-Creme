import { z, ZodSchema } from 'zod';
import { ResearchInputSchema } from '../agents/research/researchSchemas';
import { PolicyEngine } from '../policies/policyEngine';
import { PolicyLevel } from '../../types';

export interface TaskTypeDefinition<TPayload = any> {
  taskType: string;
  name: string;
  description: string;
  assignedAgent: string;
  defaultPriority: 'low' | 'medium' | 'high' | 'critical';
  defaultPolicyLevel: PolicyLevel;
  schema: ZodSchema<TPayload>;
  timeoutMs: number;
}

export class TaskRegistry {
  private static taskTypes: Map<string, TaskTypeDefinition> = new Map();

  static {
    // 1. Research Topic Task
    this.register({
      taskType: 'research_topic',
      name: 'Topic Intelligence Research',
      description: 'Conducts deep, factual, verified research on technology, finance, startups, or market shifts.',
      assignedAgent: 'agent_research',
      defaultPriority: 'medium',
      defaultPolicyLevel: 'green',
      schema: ResearchInputSchema,
      timeoutMs: 60000
    });

    // 2. Review Content Task (Yellow Policy)
    this.register({
      taskType: 'review_content',
      name: 'Editorial Content Review',
      description: 'Reviews content for factuality, tone, and editorial standards.',
      assignedAgent: 'agent_research',
      defaultPriority: 'medium',
      defaultPolicyLevel: 'yellow',
      schema: z.object({
        content: z.string().min(10),
        vertical: z.enum(['finance', 'tech']).optional(),
        review_focus: z.string().optional()
      }),
      timeoutMs: 45000
    });

    // 3. Publish Article Task (Yellow Policy - Requires human editorial sign-off)
    this.register({
      taskType: 'publish_article',
      name: 'Publish Article to Live Site',
      description: 'Publishes article to live editorial site after human sign-off.',
      assignedAgent: 'agent_research',
      defaultPriority: 'high',
      defaultPolicyLevel: 'yellow',
      schema: z.object({
        slug: z.string().min(1),
        title: z.string().min(1)
      }),
      timeoutMs: 30000
    });

    // 4. Delete Database Schema (Red Policy - Strictly Forbidden)
    this.register({
      taskType: 'delete_database_schema',
      name: 'Delete Database Schema',
      description: 'Attempt to drop or alter underlying database schema.',
      assignedAgent: 'agent_research',
      defaultPriority: 'critical',
      defaultPolicyLevel: 'red',
      schema: z.object({
        schemaName: z.string()
      }),
      timeoutMs: 10000
    });
  }

  public static register<T>(definition: TaskTypeDefinition<T>): void {
    this.taskTypes.set(definition.taskType, definition);
  }

  public static get(taskType: string): TaskTypeDefinition | undefined {
    return this.taskTypes.get(taskType);
  }

  public static list(): Array<Omit<TaskTypeDefinition, 'schema'>> {
    return Array.from(this.taskTypes.values()).map(t => ({
      taskType: t.taskType,
      name: t.name,
      description: t.description,
      assignedAgent: t.assignedAgent,
      defaultPriority: t.defaultPriority,
      defaultPolicyLevel: t.defaultPolicyLevel,
      timeoutMs: t.timeoutMs
    }));
  }

  public static validatePayload(taskType: string, rawPayload: unknown): { success: boolean; data?: any; error?: string } {
    const def = this.taskTypes.get(taskType);
    if (!def) {
      // If task type is not pre-registered, allow if object, but note
      if (typeof rawPayload === 'object' && rawPayload !== null) {
        return { success: true, data: rawPayload };
      }
      return { success: false, error: `Invalid payload for task type '${taskType}'. Must be a valid object.` };
    }

    const res = def.schema.safeParse(rawPayload);
    if (!res.success) {
      const issues = res.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      return { success: false, error: `Payload validation failed for '${taskType}': ${issues}` };
    }

    return { success: true, data: res.data };
  }

  public static evaluatePolicy(taskType: string) {
    return PolicyEngine.evaluateAction(taskType);
  }
}
