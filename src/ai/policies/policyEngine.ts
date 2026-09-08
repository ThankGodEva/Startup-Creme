import { PolicyLevel } from '../../types';
import { STARTUPCREME_CONSTITUTION } from './constitution';

export interface PolicyEvaluation {
  action: string;
  level: PolicyLevel;
  requiresApproval: boolean;
  isAllowed: boolean;
  reason: string;
}

export class PolicyEngine {
  /**
   * Evaluates an intended action against the StartupCrème Editorial Constitution.
   */
  public static evaluateAction(action: string, isAutomatedAgent: boolean = true): PolicyEvaluation {
    const normalized = action.toLowerCase().trim();

    // Check RED (Strictly forbidden for autonomous agents)
    const isRedAction = 
      STARTUPCREME_CONSTITUTION.policyClassification.red.allowedActions.includes(normalized) ||
      normalized.includes('database_schema') ||
      normalized.includes('delete_database') ||
      normalized.includes('drop_table') ||
      normalized.includes('raw_sql') ||
      normalized.includes('modify_security');

    if (isRedAction) {
      return {
        action: normalized,
        level: 'red',
        requiresApproval: true,
        isAllowed: false,
        reason: `Forbidden autonomous action: '${normalized}' is classified as RED (strictly forbidden for autonomous AI agents; manual human administrative execution required).`
      };
    }

    // Check YELLOW (Requires human approval)
    if (STARTUPCREME_CONSTITUTION.policyClassification.yellow.allowedActions.includes(normalized)) {
      return {
        action: normalized,
        level: 'yellow',
        requiresApproval: true,
        isAllowed: true,
        reason: `Action '${normalized}' is classified as YELLOW (affects public content or distribution; requires human editorial approval).`
      };
    }

    // Check GREEN (Autonomous execution permitted)
    if (STARTUPCREME_CONSTITUTION.policyClassification.green.allowedActions.includes(normalized)) {
      return {
        action: normalized,
        level: 'green',
        requiresApproval: false,
        isAllowed: true,
        reason: `Action '${normalized}' is classified as GREEN (safe, non-destructive, or draft-only; autonomous execution permitted).`
      };
    }

    // Default unknown actions to YELLOW for safety
    return {
      action: normalized,
      level: 'yellow',
      requiresApproval: true,
      isAllowed: true,
      reason: `Action '${normalized}' is not explicitly classified in the constitution; defaulted to YELLOW for human safety oversight.`
    };
  }

  /**
   * Validates if a content draft violates forbidden claims or lack of sources.
   */
  public static validateContentSanity(claimsCount: number, sourcesCount: number, confidence: number): { valid: boolean; reason?: string } {
    if (claimsCount > 0 && sourcesCount === 0) {
      return {
        valid: false,
        reason: 'Zero sources provided for factual claims. Constitution mandates verified evidence basis.'
      };
    }

    if (confidence < 0.4) {
      return {
        valid: false,
        reason: `Confidence score (${confidence}) is below the acceptable threshold (0.40) for publication consideration.`
      };
    }

    return { valid: true };
  }
}
