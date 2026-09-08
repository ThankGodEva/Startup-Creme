import { ITool, ToolExecutionContext, ToolExecutionResult } from '../types/tool';
import { PolicyEngine } from '../policies/policyEngine';
import { 
  SearchContentTool, 
  GetArticleTool, 
  CreateArticleDraftTool, 
  GetSiteMetricsTool 
} from './researchTools';

export class ToolRegistry {
  private static tools: Map<string, ITool> = new Map();

  static {
    // Register default safe foundation tools
    this.register(new SearchContentTool());
    this.register(new GetArticleTool());
    this.register(new CreateArticleDraftTool());
    this.register(new GetSiteMetricsTool());
  }

  public static register(tool: ITool): void {
    this.tools.set(tool.name, tool);
  }

  public static get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  public static list(): Array<{ name: string; description: string; policyLevel: string; permissions: string[] }> {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      policyLevel: t.policyLevel,
      permissions: t.permissions
    }));
  }

  /**
   * Executes a tool with automatic input validation and policy checks.
   */
  public static async executeTool(
    toolName: string, 
    rawParams: unknown, 
    context: ToolExecutionContext = { agentId: 'system' }
  ): Promise<ToolExecutionResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found in registry.`
      };
    }

    // Policy check
    const policy = PolicyEngine.evaluateAction(toolName);
    if (!policy.isAllowed && !context.bypassApproval) {
      return {
        success: false,
        error: `Policy violation: ${policy.reason}`
      };
    }

    // Parameter validation
    const validation = tool.validate(rawParams);
    if (!validation.success) {
      const formattedErrors = validation.errors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        error: `Invalid parameters for tool '${toolName}': ${formattedErrors}`
      };
    }

    // Safe execution
    return await tool.execute(validation.data, context);
  }

  public static async execute(
    toolName: string, 
    rawParams: unknown, 
    context: ToolExecutionContext = { agentId: 'system' }
  ): Promise<ToolExecutionResult> {
    return this.executeTool(toolName, rawParams, context);
  }
}
