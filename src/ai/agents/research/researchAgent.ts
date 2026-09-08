import { z } from 'zod';
import { IAgent, AgentContext, AgentExecutionResult, AgentAuditMetadata } from '../../types/agent';
import { ResearchInput, ResearchInputSchema, ResearchOutput, ResearchOutputSchema } from './researchSchemas';
import { IResearchProvider, GeminiResearchProvider, ArchiveResearchProvider, FallbackResearchProvider } from './providers';
import { PolicyEngine } from '../../policies/policyEngine';

export class ResearchAgent implements IAgent<ResearchInput, ResearchOutput> {
  public readonly id = 'agent_research';
  public readonly name = 'StartupCrème Research Agent';
  public readonly description = 'Conducts deep, factual, verified research on technology, finance, startups, and market shifts.';
  public readonly version = '1.0.0';
  public readonly capabilities = [
    'deep_topic_investigation',
    'claim_fact_grounding',
    'source_credibility_scoring',
    'entity_extraction',
    'article_angle_generation'
  ];
  public readonly permissions = [
    'content:read',
    'analytics:read',
    'research:execute'
  ];
  public readonly defaultPolicyLevel = 'green';
  public readonly inputSchema = ResearchInputSchema;
  public readonly outputSchema = ResearchOutputSchema;

  private providers: IResearchProvider[];

  constructor(customProviders?: IResearchProvider[]) {
    this.providers = customProviders || [
      new GeminiResearchProvider(),
      new ArchiveResearchProvider(),
      new FallbackResearchProvider()
    ];
  }

  public validateInput(input: unknown) {
    const res = this.inputSchema.safeParse(input);
    if (!res.success) {
      return { success: false, errors: res.error.issues };
    }
    return { success: true, data: res.data };
  }

  public validateOutput(output: unknown) {
    const res = this.outputSchema.safeParse(output);
    if (!res.success) {
      return { success: false, errors: res.error.issues };
    }
    return { success: true, data: res.data };
  }

  public async execute(input: ResearchInput, context?: AgentContext): Promise<AgentExecutionResult<ResearchOutput>> {
    const startTime = new Date().toISOString();
    const t0 = Date.now();

    // 1. Validate Input
    const inputValidation = this.validateInput(input);
    if (!inputValidation.success) {
      const err = inputValidation.errors?.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return {
        success: false,
        error: `Input validation failed: ${err}`,
        confidence: 0,
        reasoningSummary: 'Execution aborted due to invalid input schema.',
        audit: {
          agentId: this.id,
          agentName: this.name,
          startTime,
          endTime: new Date().toISOString(),
          durationMs: Date.now() - t0,
          confidenceScore: 0
        }
      };
    }

    const validatedInput = inputValidation.data!;
    let selectedProviderName = 'none';
    let rawOutput: ResearchOutput | null = null;
    let executionError: string | null = null;

    // 2. Select first available provider and run
    for (const provider of this.providers) {
      if (provider.isAvailable()) {
        try {
          selectedProviderName = provider.name;
          rawOutput = await provider.conductResearch(validatedInput);
          if (rawOutput) break;
        } catch (err: any) {
          executionError = err?.message || 'Provider failure';
          console.warn(`[ResearchAgent] Provider '${provider.name}' failed, attempting fallback:`, err?.message);
        }
      }
    }

    if (!rawOutput) {
      return {
        success: false,
        error: `All research providers failed. Last error: ${executionError || 'No provider available'}`,
        confidence: 0,
        reasoningSummary: 'Research investigation could not be completed across all configured providers.',
        audit: {
          agentId: this.id,
          agentName: this.name,
          startTime,
          endTime: new Date().toISOString(),
          durationMs: Date.now() - t0,
          confidenceScore: 0
        }
      };
    }

    // 3. Validate Output Schema
    const outputValidation = this.validateOutput(rawOutput);
    if (!outputValidation.success) {
      const issues = outputValidation.errors?.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return {
        success: false,
        error: `Research output failed validation contract: ${issues}`,
        confidence: 0,
        reasoningSummary: 'Provider produced malformed research output violating Zod schema requirements.',
        audit: {
          agentId: this.id,
          agentName: this.name,
          startTime,
          endTime: new Date().toISOString(),
          durationMs: Date.now() - t0,
          modelUsed: selectedProviderName,
          confidenceScore: 0
        }
      };
    }

    const validatedOutput = outputValidation.data!;

    // 4. Validate Content Sanity against Constitution
    const sanity = PolicyEngine.validateContentSanity(
      validatedOutput.key_claims.length,
      validatedOutput.sources.length,
      validatedOutput.confidence
    );

    if (!sanity.valid) {
      return {
        success: false,
        error: `Editorial Constitution violation: ${sanity.reason}`,
        confidence: validatedOutput.confidence,
        reasoningSummary: 'Output failed editorial constitution factuality rules.',
        audit: {
          agentId: this.id,
          agentName: this.name,
          startTime,
          endTime: new Date().toISOString(),
          durationMs: Date.now() - t0,
          modelUsed: selectedProviderName,
          claimsVerified: validatedOutput.key_claims.length,
          sourcesExamined: validatedOutput.sources.length,
          confidenceScore: validatedOutput.confidence
        }
      };
    }

    // 5. Successful Execution
    const audit: AgentAuditMetadata = {
      agentId: this.id,
      agentName: this.name,
      startTime,
      endTime: new Date().toISOString(),
      durationMs: Date.now() - t0,
      modelUsed: selectedProviderName,
      claimsVerified: validatedOutput.key_claims.length,
      sourcesExamined: validatedOutput.sources.length,
      confidenceScore: validatedOutput.confidence
    };

    return {
      success: true,
      data: validatedOutput,
      confidence: validatedOutput.confidence,
      reasoningSummary: `Synthesized ${validatedOutput.key_claims.length} claims backed by ${validatedOutput.sources.length} sources. Proposed ${validatedOutput.potential_article_angles.length} article angles using provider '${selectedProviderName}'.`,
      audit
    };
  }
}
