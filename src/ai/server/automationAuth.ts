import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
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
 * FAILS CLOSED: Requires either a verified M2M secret or an authenticated admin session.
 * Header 'x-admin-role' alone NEVER grants admin privileges.
 */
export async function requireAutomationAuth(
  req: AuthenticatedAutomationRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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

  let providedToken = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedToken = authHeader.slice(7).trim();
  } else if (customSecretHeader) {
    providedToken = customSecretHeader.trim();
  }

  const rawConfiguredSecret = process.env.STARTUPCREME_AUTOMATION_SECRET?.trim();
  const configuredSecret = (rawConfiguredSecret && rawConfiguredSecret !== 'your_m2m_automation_secret_key')
    ? rawConfiguredSecret
    : '';

  // 3. Check for configured M2M Automation Secret match using timing-safe comparison
  if (configuredSecret && providedToken && secureCompare(providedToken, configuredSecret)) {
    req.callerIdentity = 'm2m_automation';
    req.isAutomationClient = true;
    return next();
  }

  // 4. Pre-authenticated Admin User (established by trusted upstream session middleware)
  if ((req as any).user?.role === 'admin') {
    req.callerIdentity = 'admin_ui';
    req.isAutomationClient = false;
    return next();
  }

  // 5. Authenticated Admin Session via Supabase JWT
  if (providedToken) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    // Must have serviceRoleKey to query the authoritative startupcreme.users table.
    // If serviceRoleKey is missing, we cannot verify authoritative role, so fail closed.
    if (supabaseUrl && serviceRoleKey && !supabaseUrl.includes('placeholder')) {
      try {
        const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const {
          data: { user },
          error: authError,
        } = await authClient.auth.getUser(providedToken);

        if (!authError && user && user.id) {
          // Authoritative role lookup: MUST come exclusively from startupcreme.users database record.
          // user_metadata is user-editable in Supabase and MUST NEVER grant admin access.
          const adminClient = createClient(supabaseUrl, serviceRoleKey, {
            db: { schema: 'startupcreme' },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: dbUser, error: dbError } = await adminClient
            .from('users')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          if (!dbError && dbUser?.role && String(dbUser.role).trim().toLowerCase() === 'admin') {
            req.callerIdentity = 'admin_session';
            req.isAutomationClient = false;
            return next();
          }
        }
      } catch {
        // Fall through to unauthorized
      }
    }
  }

  // 6. Fail closed: Reject unauthorized automation or admin request
  res.status(401).json({
    error: 'Unauthorized: Missing or invalid automation credentials. Provide valid Bearer token or X-Automation-Secret header.',
    code: 'UNAUTHORIZED_AUTOMATION',
    retryable: false,
    correlation
  });
}

