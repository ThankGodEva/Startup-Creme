import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { CorrelationMetadata } from './automationContract';

export interface AuthenticatedAutomationRequest extends Request {
  correlation?: CorrelationMetadata;
  callerIdentity?: string;
  isAutomationClient?: boolean;
}

/**
 * Timing-safe string comparison to mitigate side-channel timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extracts and standardizes request correlation headers across automation invocations.
 */
export function extractCorrelation(req: Request): CorrelationMetadata {
  const reqIdHeader = (req.headers['x-request-id'] || 
                       req.headers['request-id']) as string | undefined;
  
  const workflowIdHeader = (req.headers['x-workflow-id'] || 
                           req.headers['workflow-id']) as string | undefined;
  
  const executionIdHeader = (req.headers['x-execution-id'] || 
                            req.headers['execution-id']) as string | undefined;
  
  const idempotencyKeyHeader = (req.headers['idempotency-key'] || 
                               req.headers['x-idempotency-key']) as string | undefined;

  const bodyCorrelation = req.body?.correlation;
  const bodyIdempotency = req.body?.idempotency_key || req.body?.idempotencyKey;

  const requestId = reqIdHeader || bodyCorrelation?.requestId || crypto.randomUUID();
  const workflowId = workflowIdHeader || bodyCorrelation?.workflowId || undefined;
  const executionId = executionIdHeader || bodyCorrelation?.executionId || undefined;
  const idempotencyKey = idempotencyKeyHeader || bodyIdempotency || bodyCorrelation?.idempotencyKey || undefined;

  return {
    requestId,
    workflowId,
    executionId,
    idempotencyKey,
    source: bodyCorrelation?.source || (workflowId ? 'n8n_orchestration' : 'api_client')
  };
}

/**
 * Middleware: Enforces Automation / M2M and Admin authorization with correlation context.
 */
export function requireAutomationAuth(
  req: AuthenticatedAutomationRequest,
  res: Response,
  next: NextFunction
): void {
  // 1. Extract and attach correlation context
  const correlation = extractCorrelation(req);
  req.correlation = correlation;
  res.setHeader('X-Request-Id', correlation.requestId || '');

  // 2. Extract provided credentials
  const authHeader = req.headers.authorization;
  const customSecretHeader = (
    req.headers['x-automation-secret'] || 
    req.headers['x-startupcreme-automation-secret']
  ) as string | undefined;
  const adminRoleHeader = req.headers['x-admin-role'] as string | undefined;

  let providedToken = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedToken = authHeader.slice(7).trim();
  } else if (customSecretHeader) {
    providedToken = customSecretHeader.trim();
  }

  const configuredSecret = process.env.STARTUPCREME_AUTOMATION_SECRET;

  // 3. Check for configured M2M Automation Secret match
  if (configuredSecret && configuredSecret !== 'your_m2m_automation_secret_key') {
    if (providedToken && secureCompare(providedToken, configuredSecret)) {
      req.callerIdentity = 'm2m_automation';
      req.isAutomationClient = true;
      return next();
    }
  }

  // 4. Internal Admin Session / Role Header (allows admin UI access)
  if (adminRoleHeader === 'admin' || (req as any).user?.role === 'admin') {
    req.callerIdentity = 'admin_ui';
    req.isAutomationClient = false;
    return next();
  }

  // 5. Development Fallback: if secret is unconfigured, allow with a warning header in dev
  if (!configuredSecret || configuredSecret === 'your_m2m_automation_secret_key') {
    if (process.env.NODE_ENV !== 'production') {
      res.setHeader('X-StartupCreme-Auth-Warning', 'STARTUPCREME_AUTOMATION_SECRET not configured; dev permissive mode');
      req.callerIdentity = 'dev_local';
      req.isAutomationClient = true;
      return next();
    }
  }

  // 6. Reject unauthorized automation request
  res.status(401).json({
    error: 'Unauthorized: Missing or invalid automation credentials. Provide valid Bearer token or X-Automation-Secret header.',
    code: 'UNAUTHORIZED_AUTOMATION',
    retryable: false,
    correlation
  });
}
