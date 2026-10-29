import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  INITIAL_STARTUPS,
  INITIAL_CENTRAL_BANK_RATES,
  INITIAL_CLOUD_PRICING_INDEX,
  INITIAL_RATE_SNAPSHOT,
  INITIAL_JOBS,
  INITIAL_EVENTS,
} from '../lib/expansionData';
import {
  StartupEntry,
  JobListing,
  RateSnapshotPayload,
  EventOpportunity,
} from '../types';
import { EventWebhookIngestionSchema } from '../lib/validation';

export const expansionRouter = Router();

// Runtime cache synchronized with Supabase
let runtimeStartups: StartupEntry[] = [...INITIAL_STARTUPS];
let runtimeJobs: JobListing[] = [...INITIAL_JOBS];
let runtimeRateSnapshot: RateSnapshotPayload = { ...INITIAL_RATE_SNAPSHOT };
let runtimeEvents: EventOpportunity[] = [...INITIAL_EVENTS];
let hasPurgedLegacyMockRows = false;

const LEGACY_MOCK_STARTUP_SLUGS = [
  'paystack-treasury',
  'kora-quant',
  'vortex-inference',
  'moniepoint-ledger',
  'termii-omni',
  'lazer-edtech',
];

const LEGACY_MOCK_JOB_TITLES = [
  'Fractional CFO (Series A & B SaaS)',
  'Staff Distributed Systems Engineer (Rust / Go)',
  'Principal Cloud FinOps Architect',
  'Senior Quantitative Financial Modeler',
  'Fractional CTO & AI Infrastructure Advisor',
  'Lead Full-Stack Engineer (React Router 7 + Supabase)',
];

const LEGACY_MOCK_EVENT_SLUGS = [
  'manual-admin-opportunity-test-2026',
];

async function purgeLegacyMockRowsIfNeeded(client: any) {
  if (hasPurgedLegacyMockRows || !client) return;
  hasPurgedLegacyMockRows = true;
  try {
    await client.from('startups').delete().in('slug', LEGACY_MOCK_STARTUP_SLUGS);
  } catch {
    // ignore
  }
  try {
    await client.from('jobs').delete().in('title', LEGACY_MOCK_JOB_TITLES);
  } catch {
    // ignore
  }
  try {
    const { data: mockEvents } = await client
      .from('events')
      .select('id, linked_post_id')
      .in('slug', LEGACY_MOCK_EVENT_SLUGS);
    if (mockEvents && mockEvents.length > 0) {
      const linkedPostIds = mockEvents.map((e: any) => e.linked_post_id).filter(Boolean);
      await client.from('events').delete().in('slug', LEGACY_MOCK_EVENT_SLUGS);
      if (linkedPostIds.length > 0) {
        await client.from('posts').delete().in('id', linkedPostIds);
      }
    }
    await client.from('posts').delete().in('slug', LEGACY_MOCK_EVENT_SLUGS);
  } catch {
    // ignore
  }
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) return null;

  return createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'startupcreme' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolves the authenticated user and their verified role ('admin' | 'user').
 * STRICT SECURITY:
 * 1. Admin role is NEVER granted based on request body or headers.
 * 2. Identity is resolved ONLY from trusted server session ((req as any).user) or cryptographically verified Supabase JWT.
 * 3. Role is resolved EXCLUSIVELY from authoritative startupcreme.users database record.
 * 4. All unverified fallbacks (guest submissions) strictly receive role 'user'.
 */
async function resolveRequestUser(
  req: Request
): Promise<{ id: string; role: 'admin' | 'user'; email?: string } | null> {
  // 1. Check if trusted server-side authentication middleware already populated req.user
  if ((req as any).user?.id) {
    const serverUser = (req as any).user;
    const trustedRole: 'admin' | 'user' = serverUser.role === 'admin' ? 'admin' : 'user';
    return {
      id: String(serverUser.id),
      role: trustedRole,
      email: serverUser.email ? String(serverUser.email) : undefined,
    };
  }

  // 2. Cryptographically verify Supabase Auth Bearer token if provided
  const authHeader = req.headers.authorization;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (authHeader && authHeader.startsWith('Bearer ') && supabaseUrl && (anonKey || serviceRoleKey)) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const {
          data: { user },
          error,
        } = await authClient.auth.getUser(token);

        if (!error && user && user.id) {
          // Authoritative role lookup: MUST come exclusively from startupcreme.users database record.
          // user_metadata is user-editable in Supabase and MUST NEVER grant admin access.
          let role: 'admin' | 'user' = 'user';
          const adminClient = getSupabaseAdminClient();
          if (adminClient && serviceRoleKey) {
            try {
              const { data: dbUser, error: dbError } = await adminClient
                .from('users')
                .select('role')
                .eq('id', user.id)
                .maybeSingle();

              if (!dbError && dbUser?.role && String(dbUser.role).trim().toLowerCase() === 'admin') {
                role = 'admin';
              }
            } catch {
              // On lookup error, fail closed: role remains 'user'
              role = 'user';
            }
          }
          return { id: user.id, role, email: user.email };
        }
      } catch {
        // Token verification failed; fall through
      }
    }
  }

  // 3. Fallback for unauthenticated client submissions (e.g. guest startup or job posting)
  // NEVER grant admin role from request headers or body. All unauthenticated/unverified inputs are strictly 'user'.
  const fallbackUserId = req.body?.submitted_by || req.body?.userId || req.headers['x-user-id'];
  if (fallbackUserId && typeof fallbackUserId === 'string' && fallbackUserId.trim().length > 0) {
    const cleanId = fallbackUserId.trim();
    // Non-admin identity only; can never bypass authorization or obtain admin status
    return { id: cleanId, role: 'user' };
  }

  return null;
}

/**
 * Route-level admin authorization guard
 * Enforces admin authorization at the route level, rejecting any non-admin callers.
 */
async function requireRouteAdminAuth(
  req: Request,
  res: Response
): Promise<{ id: string; role: 'admin'; email?: string } | null> {
  const reqUser = await resolveRequestUser(req);
  if (!reqUser || reqUser.role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden: Admin privileges required for this action.',
      code: 'ADMIN_PRIVILEGES_REQUIRED',
    });
    return null;
  }
  return reqUser as { id: string; role: 'admin'; email?: string };
}

// --------------------------------------------------------------------
// MODULE 2: Startup & FinTech Directory Endpoints (/api/directory)
// --------------------------------------------------------------------
expansionRouter.get(['/directory', '/startups'], async (req: Request, res: Response) => {
  const stageFilter = (req.query.stage as string) || '';
  const verticalFilter = (req.query.vertical as string) || '';
  const includePending = req.query.includePending === 'true';

  const client = getSupabaseAdminClient();
  if (client) {
    await purgeLegacyMockRowsIfNeeded(client);
    try {
      let query = client
        .from('startups')
        .select('*')
        .order('created_at', { ascending: false });

      if (!includePending) {
        query = query.eq('is_approved', true);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        runtimeStartups = (data as StartupEntry[]).filter(
          (s) => !LEGACY_MOCK_STARTUP_SLUGS.includes(s.slug)
        );
      }
    } catch {
      // Fallback to runtimeStartups
    }
  }

  let results = runtimeStartups.filter(
    (s) => !LEGACY_MOCK_STARTUP_SLUGS.includes(s.slug) && (includePending || s.is_approved)
  );
  if (stageFilter && stageFilter !== 'all') {
    results = results.filter((s) => s.stage === stageFilter);
  }
  if (verticalFilter && verticalFilter !== 'all') {
    const normFilter = verticalFilter.toLowerCase().replace(/[^a-z0-9]/g, '');
    results = results.filter(
      (s) => s.vertical.toLowerCase().replace(/[^a-z0-9]/g, '') === normFilter
    );
  }

  return res.json({
    startups: results,
    total: results.length,
  });
});

expansionRouter.post(['/directory', '/startups'], async (req: Request, res: Response) => {
  const reqUser = await resolveRequestUser(req);
  if (!reqUser) {
    return res.status(401).json({
      error: 'Authentication required. Only signed-in users can submit a startup.',
    });
  }

  const {
    name,
    tagline,
    description,
    website_url,
    logo_url,
    stage = 'mvp',
    vertical = 'FinTech',
    tech_stack = [],
  } = req.body || {};

  if (!name || !tagline || !description || !website_url) {
    return res.status(400).json({
      error: 'Missing required fields: name, tagline, description, and website_url are required.',
    });
  }

  const cleanSlug =
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') +
    '-' +
    Math.random().toString(36).substring(2, 6);

  // Only admin submissions are auto-approved; regular user submissions require admin approval
  const isApproved = reqUser.role === 'admin';
  const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reqUser.id)
    ? reqUser.id
    : null;

  const newStartup: StartupEntry = {
    id: `st-${Date.now()}`,
    name: String(name).trim(),
    slug: cleanSlug,
    tagline: String(tagline).trim(),
    description: String(description).trim(),
    website_url: String(website_url).trim(),
    logo_url: logo_url ? String(logo_url).trim() : null,
    stage: ['idea', 'mvp', 'seed', 'series_a', 'bootstrapped'].includes(stage) ? stage : 'mvp',
    vertical: String(vertical).trim() || 'FinTech',
    tech_stack: Array.isArray(tech_stack)
      ? tech_stack.map((t: any) => String(t).trim()).filter(Boolean)
      : String(tech_stack)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
    submitted_by: validUuid,
    is_approved: isApproved,
    created_at: new Date().toISOString(),
  };

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('startups')
        .insert({
          name: newStartup.name,
          slug: newStartup.slug,
          tagline: newStartup.tagline,
          description: newStartup.description,
          website_url: newStartup.website_url,
          logo_url: newStartup.logo_url,
          stage: newStartup.stage,
          vertical: newStartup.vertical,
          tech_stack: newStartup.tech_stack,
          submitted_by: newStartup.submitted_by,
          is_approved: isApproved,
        })
        .select('*')
        .single();

      if (!error && data) {
        runtimeStartups = [data as StartupEntry, ...runtimeStartups];
        return res.status(201).json({ success: true, startup: data, persisted: 'supabase' });
      }
    } catch {
      // Fallback to runtime store
    }
  }

  runtimeStartups = [newStartup, ...runtimeStartups];
  return res.status(201).json({ success: true, startup: newStartup, persisted: 'memory' });
});

expansionRouter.patch(['/directory/:id/approve', '/startups/:id/approve'], async (req: Request, res: Response) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;

  const { id } = req.params;
  const { is_approved = true } = req.body || {};

  runtimeStartups = runtimeStartups.map((s) =>
    s.id === id || s.slug === id ? { ...s, is_approved: Boolean(is_approved) } : s
  );

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('startups')
        .update({ is_approved: Boolean(is_approved) })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        runtimeStartups = runtimeStartups.map((s) => (s.id === id ? (data as StartupEntry) : s));
        return res.json({ success: true, startup: data });
      }
    } catch {
      // ignore
    }
  }

  const updated = runtimeStartups.find((s) => s.id === id || s.slug === id);
  return res.json({ success: true, startup: updated });
});

expansionRouter.delete(['/directory/:id', '/startups/:id'], async (req: Request, res: Response) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;

  const { id } = req.params;
  runtimeStartups = runtimeStartups.filter((s) => s.id !== id && s.slug !== id);

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      await client.from('startups').delete().eq('id', id);
    } catch {
      // ignore
    }
  }

  return res.json({ success: true, deletedId: id });
});

// --------------------------------------------------------------------
// MODULE 3: Macro & Cloud Rate Trackers Endpoints (/api/markets/rates & n8n webhook)
// --------------------------------------------------------------------
function isMarketsFeatureEnabled(): boolean {
  const raw = String(process.env.ENABLE_MARKETS ?? process.env.VITE_ENABLE_MARKETS ?? 'true')
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, '');
  return !(raw === 'false' || raw === '0' || raw === 'no' || raw === 'off');
}

expansionRouter.get(['/markets/rates', '/rates', '/markets'], async (req: Request, res: Response) => {
  if (!isMarketsFeatureEnabled()) {
    return res.status(404).json({ error: 'Not found' });
  }
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('rate_snapshots')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        runtimeRateSnapshot = {
          id: data.id,
          source: data.source || 'supabase_cached_snapshot',
          recorded_at: data.recorded_at || data.created_at,
          central_bank_rates:
            Array.isArray(data.central_bank_rates) && data.central_bank_rates.length > 0
              ? data.central_bank_rates
              : INITIAL_CENTRAL_BANK_RATES,
          cloud_pricing_index:
            Array.isArray(data.cloud_pricing_index) && data.cloud_pricing_index.length > 0
              ? data.cloud_pricing_index
              : INITIAL_CLOUD_PRICING_INDEX,
        };
      }
    } catch {
      // fallback to runtimeRateSnapshot
    }
  }

  return res.json(runtimeRateSnapshot);
});

// Automated n8n Webhook Receiver for Rate Snapshots
// Security: Gated by feature flag AND requires Authorization: Bearer matching STARTUPCREME_AUTOMATION_SECRET
expansionRouter.post(
  ['/webhooks/n8n/rates', '/markets/rates/webhook', '/markets/rates/sync'],
  async (req: Request, res: Response) => {
    // 1. Feature Flag Gate: Return 404 if markets integration is disabled
    if (!isMarketsFeatureEnabled()) {
      return res.status(404).json({ error: 'Not found' });
    }

    // 2. Authentication Gate: Require Authorization Bearer token matching STARTUPCREME_AUTOMATION_SECRET
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or invalid Authorization Bearer header matching STARTUPCREME_AUTOMATION_SECRET.',
        code: 'UNAUTHORIZED_RATES_WEBHOOK',
      });
    }

    const providedToken = authHeader.slice(7).trim();
    if (!providedToken) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Empty Bearer token provided.',
        code: 'UNAUTHORIZED_RATES_WEBHOOK',
      });
    }

    const rawSecret = process.env.STARTUPCREME_AUTOMATION_SECRET?.trim();
    const configuredSecret = (rawSecret && rawSecret !== 'your_m2m_automation_secret_key') ? rawSecret : '';

    // Fail closed if STARTUPCREME_AUTOMATION_SECRET is unset or blank
    if (!configuredSecret) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Automation secret is not configured on the server. Access denied.',
        code: 'UNAUTHORIZED_RATES_WEBHOOK',
      });
    }

    if (!timingSafeCheck(providedToken, configuredSecret)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid automation secret token.',
        code: 'UNAUTHORIZED_RATES_WEBHOOK',
      });
    }

    const {
      source = 'n8n_webhook_job',
      central_bank_rates,
      cloud_pricing_index,
      metadata = {},
    } = req.body || {};

    const updatedCentralBanks =
      Array.isArray(central_bank_rates) && central_bank_rates.length > 0
        ? central_bank_rates
        : runtimeRateSnapshot.central_bank_rates;

    const updatedCloudPricing =
      Array.isArray(cloud_pricing_index) && cloud_pricing_index.length > 0
        ? cloud_pricing_index
        : runtimeRateSnapshot.cloud_pricing_index;

    const nowIso = new Date().toISOString();
    const nextSnapshot: RateSnapshotPayload = {
      id: `snap-${Date.now()}`,
      source: String(source),
      recorded_at: nowIso,
      central_bank_rates: updatedCentralBanks,
      cloud_pricing_index: updatedCloudPricing,
    };

    runtimeRateSnapshot = nextSnapshot;

    const client = getSupabaseAdminClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('rate_snapshots')
          .insert({
            snapshot_type: 'combined',
            source: nextSnapshot.source,
            central_bank_rates: nextSnapshot.central_bank_rates,
            cloud_pricing_index: nextSnapshot.cloud_pricing_index,
            metadata,
            recorded_at: nowIso,
          })
          .select('*')
          .single();

        if (!error && data) {
          runtimeRateSnapshot.id = data.id;
          return res.status(201).json({
            success: true,
            persisted: 'supabase',
            snapshot: runtimeRateSnapshot,
          });
        }
      } catch {
        // fallback to memory snapshot
      }
    }

    return res.status(200).json({
      success: true,
      persisted: 'memory',
      snapshot: runtimeRateSnapshot,
    });
  }
);

// --------------------------------------------------------------------
// MODULE 4: Niche Remote Startup Job & Fractional Talent Board (/api/careers)
// --------------------------------------------------------------------
expansionRouter.get(['/careers', '/jobs'], async (req: Request, res: Response) => {
  const categoryFilter = (req.query.category as string) || '';
  const jobTypeFilter = (req.query.job_type as string) || '';
  const includePending = req.query.includePending === 'true';

  const client = getSupabaseAdminClient();
  if (client) {
    await purgeLegacyMockRowsIfNeeded(client);
    try {
      let query = client
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!includePending) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        runtimeJobs = (data as JobListing[]).filter(
          (j) => !LEGACY_MOCK_JOB_TITLES.includes(j.title)
        );
      }
    } catch {
      // fallback to runtimeJobs
    }
  }

  let results = runtimeJobs.filter(
    (j) => !LEGACY_MOCK_JOB_TITLES.includes(j.title) && (includePending || j.is_active)
  );
  if (categoryFilter && categoryFilter !== 'all') {
    results = results.filter((j) => j.category.toLowerCase() === categoryFilter.toLowerCase());
  }
  if (jobTypeFilter && jobTypeFilter !== 'all') {
    results = results.filter((j) => j.job_type.toLowerCase() === jobTypeFilter.toLowerCase());
  }

  return res.json({
    jobs: results,
    total: results.length,
  });
});

expansionRouter.post(['/careers', '/jobs'], async (req: Request, res: Response) => {
  const reqUser = await resolveRequestUser(req);
  if (!reqUser) {
    return res.status(401).json({
      error: 'Authentication required. Only signed-in users can post a job.',
    });
  }

  const {
    title,
    company_name,
    company_logo,
    location = 'Remote (Global)',
    job_type = 'Full-time',
    category = 'Engineering',
    apply_url,
    salary_range,
  } = req.body || {};

  if (!title || !company_name || !apply_url) {
    return res.status(400).json({
      error: 'Missing required fields: title, company_name, and apply_url are required.',
    });
  }

  // Only admin submissions are immediately active; non-admin user submissions require admin approval
  const isActive = reqUser.role === 'admin';

  const newJob: JobListing = {
    id: `job-${Date.now()}`,
    title: String(title).trim(),
    company_name: String(company_name).trim(),
    company_logo: company_logo ? String(company_logo).trim() : null,
    location: String(location).trim() || 'Remote (Global)',
    job_type: String(job_type).trim() || 'Full-time',
    category: String(category).trim() || 'Engineering',
    apply_url: String(apply_url).trim(),
    salary_range: salary_range ? String(salary_range).trim() : null,
    is_active: isActive,
    created_at: new Date().toISOString(),
  };

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('jobs')
        .insert({
          title: newJob.title,
          company_name: newJob.company_name,
          company_logo: newJob.company_logo,
          location: newJob.location,
          job_type: newJob.job_type,
          category: newJob.category,
          apply_url: newJob.apply_url,
          salary_range: newJob.salary_range,
          is_active: isActive,
        })
        .select('*')
        .single();

      if (!error && data) {
        runtimeJobs = [data as JobListing, ...runtimeJobs];
        return res.status(201).json({ success: true, job: data, persisted: 'supabase' });
      }
    } catch {
      // fallback to runtime store
    }
  }

  runtimeJobs = [newJob, ...runtimeJobs];
  return res.status(201).json({ success: true, job: newJob, persisted: 'memory' });
});

expansionRouter.patch(['/careers/:id/approve', '/jobs/:id/approve'], async (req: Request, res: Response) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;

  const { id } = req.params;
  const { is_active = true } = req.body || {};

  runtimeJobs = runtimeJobs.map((j) =>
    j.id === id ? { ...j, is_active: Boolean(is_active) } : j
  );

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('jobs')
        .update({ is_active: Boolean(is_active) })
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        runtimeJobs = runtimeJobs.map((j) => (j.id === id ? (data as JobListing) : j));
        return res.json({ success: true, job: data });
      }
    } catch {
      // ignore
    }
  }

  const updated = runtimeJobs.find((j) => j.id === id);
  return res.json({ success: true, job: updated });
});

expansionRouter.delete(['/careers/:id', '/jobs/:id'], async (req: Request, res: Response) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;

  const { id } = req.params;
  runtimeJobs = runtimeJobs.filter((j) => j.id !== id);

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      await client.from('jobs').delete().eq('id', id);
    } catch {
      // ignore
    }
  }

  return res.json({ success: true, deletedId: id });
});

// ====================================================================
// MODULE 5: Events, Grants, Accelerators & External Ingestion
// Endpoint: /api/events/webhook
// ====================================================================

function timingSafeCheck(provided: string, secret: string): boolean {
  if (!provided || !secret) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isAuthorizedWebhookToken(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const rawSecret = process.env.STARTUPCREME_AUTOMATION_SECRET?.trim();
  if (!rawSecret || rawSecret === 'your_m2m_automation_secret_key') {
    // Fail closed: Webhook authorization is strictly rejected if secret is unset or blank
    return false;
  }

  return timingSafeCheck(token, rawSecret);
}

// Ingestion webhook for automation workflows, scrapers, and external data pipelines
expansionRouter.post('/events/webhook', async (req: Request, res: Response) => {
  // 1. Authentication / Security: Check for Webhook Bearer token OR verified Admin session
  const isWebhookAuthorized = isAuthorizedWebhookToken(req);
  let isAdminAuthorized = false;

  if (!isWebhookAuthorized) {
    const reqUser = await resolveRequestUser(req);
    if (reqUser && reqUser.role === 'admin') {
      isAdminAuthorized = true;
    }
  }

  if (!isWebhookAuthorized && !isAdminAuthorized) {
    return res.status(401).json({
      success: false,
      error:
        'Unauthorized: Missing or invalid Bearer token. Please provide a valid Authorization: Bearer <token> matching STARTUPCREME_AUTOMATION_SECRET, or authenticate with an admin session.',
    });
  }

  // 2. Pre-normalize input fields for Zod validation
  const rawBody = req.body || {};
  const rawTitle = String(rawBody.title || rawBody.event_title || '').trim();
  const rawEventTitle = String(rawBody.event_title || rawBody.title || '').trim();
  let candidateSlug = String(rawBody.slug || '').trim();
  if (!candidateSlug && (rawTitle || rawEventTitle)) {
    candidateSlug = (rawTitle || rawEventTitle)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const candidatePayload = {
    ...rawBody,
    title: rawTitle || undefined,
    event_title: rawEventTitle || undefined,
    slug: candidateSlug || undefined,
  };

  // 3. Zod Schema Validation
  const validationResult = EventWebhookIngestionSchema.safeParse(candidatePayload);
  if (!validationResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Payload validation failed',
      issues: validationResult.error.issues,
      message: validationResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    });
  }

  const validated = validationResult.data;
  const effectiveTitle = (validated.title || validated.event_title)!.trim();
  const effectiveEventTitle = (validated.event_title || validated.title)!.trim();
  const normSlug = validated.slug || candidateSlug;
  const normVertical = validated.vertical;
  const normLocale = validated.locale;
  const cleanAppUrl = validated.application_url;
  const rawContent = validated.content || validated.description || effectiveTitle;
  const description = (validated.description || validated.excerpt || effectiveTitle).trim();

  // 4. Status Resolution:
  // Default status must be "draft", not "published".
  // Only an explicit "published" from a Bearer-authenticated call or an admin session may publish.
  const resolvedStatus: 'draft' | 'published' = rawBody.status === 'published' ? 'published' : 'draft';

  // Format content as Tiptap JSONB for Postgres
  let jsonbContent: any;
  if (typeof rawContent === 'string') {
    try {
      jsonbContent = JSON.parse(rawContent);
    } catch {
      jsonbContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: rawContent }],
          },
        ],
      };
    }
  } else if (rawContent && typeof rawContent === 'object') {
    jsonbContent = rawContent;
  } else {
    jsonbContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: effectiveTitle }],
        },
      ],
    };
  }

  const client = getSupabaseAdminClient();
  let existingPost: any = null;
  let existingEvent: any = null;

  try {
    if (client) {
      const postsTable = client.schema ? client.schema('startupcreme').from('posts') : client.from('posts');
      const eventsTable = client.schema ? client.schema('startupcreme').from('events') : client.from('events');

      // Check existing post by (locale, vertical, slug)
      const { data: foundPost } = await postsTable
        .select('id, title, excerpt, content, status, locale, vertical, slug')
        .eq('locale', normLocale)
        .eq('vertical', normVertical)
        .eq('slug', normSlug)
        .maybeSingle();
      if (foundPost) existingPost = foundPost;

      // Check existing event by application_url or slug
      const { data: foundEvent } = await eventsTable
        .select('id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id')
        .or(`application_url.eq.${cleanAppUrl},slug.eq.${normSlug}`)
        .maybeSingle();
      if (foundEvent) existingEvent = foundEvent;

      if (!existingPost && existingEvent?.linked_post_id) {
        const { data: linkedP } = await postsTable
          .select('id, title, excerpt, content, status, locale, vertical, slug')
          .eq('id', existingEvent.linked_post_id)
          .maybeSingle();
        if (linkedP) existingPost = linkedP;
      }
    } else {
      // In-memory fallback
      existingEvent = runtimeEvents.find(
        (e) => e.application_url === cleanAppUrl || e.slug === normSlug
      );
      if (existingEvent?.linked_post) {
        existingPost = existingEvent.linked_post;
      }
    }

    // 5. Immutability & Deduplication Rules:
    // If the target post or event already exists and the post is published,
    // change nothing and return 200 {"success":true,"deduplicated":true}.
    if (existingPost && existingPost.status === 'published') {
      return res.status(200).json({
        success: true,
        deduplicated: true,
        message: 'Target post is already published. No mutations applied.',
        data: {
          post_id: existingPost.id,
          event_id: existingEvent?.id || null,
          status: existingPost.status,
        },
      });
    }

    if (existingEvent && existingEvent.linked_post?.status === 'published') {
      return res.status(200).json({
        success: true,
        deduplicated: true,
        message: 'Target event and linked post are already published. No mutations applied.',
        data: {
          post_id: existingEvent.linked_post_id || existingEvent.linked_post?.id,
          event_id: existingEvent.id,
          status: 'published',
        },
      });
    }

    let linkedPostId: string;

    if (existingPost) {
      // "Do not update title, content, excerpt or status of an existing post in any case via this route."
      // Keep existing post untouched!
      linkedPostId = existingPost.id;
    } else {
      // Create new post with resolved status (draft by default)
      const postRow = {
        locale: normLocale,
        vertical: normVertical,
        slug: normSlug,
        title: effectiveTitle,
        excerpt: validated.excerpt ? validated.excerpt.trim() : description.slice(0, 240),
        content: jsonbContent,
        status: resolvedStatus,
        meta_description: validated.meta_description
          ? validated.meta_description.trim()
          : (validated.excerpt || description).slice(0, 160),
        canonical_url: validated.canonical_url ? validated.canonical_url.trim() : null,
        cover_image: validated.cover_image ? validated.cover_image.trim() : null,
        source_url: validated.source_url ? validated.source_url.trim() : null,
        source_name: validated.source_name ? validated.source_name.trim() : null,
        ai_generated: Boolean(validated.ai_generated),
        hide_ai_disclosure: Boolean(validated.hide_ai_disclosure),
        author_name: validated.author_name || 'Startup Crème Editorial',
        author_role: validated.author_role || 'Principal Editor',
        author_avatar: validated.author_avatar || null,
        dual_silo: normVertical === 'founders-mindset' ? false : Boolean(validated.dual_silo),
        silo_badge: validated.silo_badge || null,
        tags: validated.tags || [],
        reading_time_minutes: validated.reading_time_minutes || 5,
        word_count: validated.word_count || 800,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (client) {
        const postsTable = client.schema ? client.schema('startupcreme').from('posts') : client.from('posts');
        let insertPostRes = await postsTable
          .insert(postRow)
          .select('id, status')
          .single();

        if (insertPostRes.error && (insertPostRes.error.code === 'PGRST204' || String(insertPostRes.error.message || '').includes('column'))) {
          // Schema migration not yet applied on remote Supabase; strip new columns for insert
          const { source_url, source_name, ai_generated, hide_ai_disclosure, ...legacyPostRow } = postRow;
          insertPostRes = await postsTable
            .insert(legacyPostRow)
            .select('id, status')
            .single();
        }

        if (insertPostRes.error && insertPostRes.error.code === '22P02' && String(insertPostRes.error.message || '').includes('vertical')) {
          // Enum value 'founders-mindset' not yet added on remote DB; fallback to 'tech'
          const { source_url, source_name, ai_generated, hide_ai_disclosure, ...legacyPostRow } = postRow;
          insertPostRes = await postsTable
            .insert({ ...legacyPostRow, vertical: 'tech' })
            .select('id, status')
            .single();
        }

        if (insertPostRes.error) throw insertPostRes.error;
        linkedPostId = insertPostRes.data.id;
      } else {
        linkedPostId = `post-${Date.now()}`;
      }
    }

    // Now process event row
    let eventId: string;
    const eventRow = {
      title: effectiveEventTitle,
      slug: normSlug,
      description,
      opportunity_type: validated.opportunity_type,
      funding_amount: validated.funding_amount ? validated.funding_amount.trim() : null,
      location: (validated.location || 'Global (Remote)').trim(),
      deadline_date: new Date(validated.deadline_date).toISOString(),
      application_url: cleanAppUrl,
      linked_post_id: linkedPostId,
    };

    if (client) {
      const eventsTable = client.schema ? client.schema('startupcreme').from('events') : client.from('events');

      if (existingEvent) {
        eventId = existingEvent.id;
        if (!existingEvent.linked_post_id) {
          await eventsTable.update({ linked_post_id: linkedPostId }).eq('id', existingEvent.id);
        }
      } else {
        let insertRes = await eventsTable
          .insert(eventRow)
          .select('id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at')
          .maybeSingle();

        // Fallback if remote database has not yet applied enum additions for fellowship/incubator
        if (insertRes.error && insertRes.error.code === '22P02' && String(insertRes.error.message || '').includes('opportunity_type')) {
          const fallbackOpp = validated.opportunity_type === 'fellowship' ? 'grant' : 'accelerator';
          insertRes = await eventsTable
            .insert({ ...eventRow, opportunity_type: fallbackOpp })
            .select('id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at')
            .maybeSingle();
        }

        if (insertRes.error && String(insertRes.error.message || '').includes('events_slug_key')) {
          const fallbackRow = { ...eventRow, slug: `${normSlug}-${Date.now().toString(36)}` };
          insertRes = await eventsTable
            .insert(fallbackRow)
            .select('id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at')
            .single();
        }

        if (insertRes.error) throw insertRes.error;
        eventId = insertRes.data?.id || `event-${Date.now()}`;
      }
    } else {
      eventId = existingEvent?.id || `event-${Date.now()}`;
    }

    const linkedPostSnapshot = {
      id: linkedPostId,
      locale: normLocale,
      vertical: normVertical,
      slug: normSlug,
      title: effectiveTitle,
      status: (existingPost?.status || resolvedStatus) as 'draft' | 'published',
      canonical_url: existingPost?.canonical_url || (validated.canonical_url ? validated.canonical_url.trim() : null),
      source_name: existingPost?.source_name || (validated.source_name ? validated.source_name.trim() : null),
      source_url: existingPost?.source_url || (validated.source_url ? validated.source_url.trim() : null),
      ai_generated: existingPost?.ai_generated !== undefined ? Boolean(existingPost.ai_generated) : Boolean(validated.ai_generated),
      hide_ai_disclosure: existingPost?.hide_ai_disclosure !== undefined ? Boolean(existingPost.hide_ai_disclosure) : Boolean(validated.hide_ai_disclosure),
    };

    const memoryEvent: EventOpportunity = {
      id: eventId,
      title: effectiveEventTitle,
      slug: normSlug,
      description,
      opportunity_type: validated.opportunity_type,
      funding_amount: validated.funding_amount || null,
      location: validated.location || 'Global (Remote)',
      deadline_date: new Date(validated.deadline_date).toISOString(),
      application_url: cleanAppUrl,
      linked_post_id: linkedPostId,
      linked_post: linkedPostSnapshot as any,
      created_at: new Date().toISOString(),
    };

    runtimeEvents = [
      memoryEvent,
      ...runtimeEvents.filter((e) => e.application_url !== cleanAppUrl && e.slug !== normSlug),
    ];

    return res.status(200).json({
      success: true,
      message: 'Event and post successfully processed',
      post: linkedPostSnapshot,
      data: {
        post_id: linkedPostId,
        event_id: eventId,
        status: linkedPostSnapshot.status,
        event_title: effectiveEventTitle,
        application_url: cleanAppUrl,
        opportunity_type: validated.opportunity_type,
        funding_amount: memoryEvent.funding_amount,
        deadline_date: memoryEvent.deadline_date,
        linked_post_id: linkedPostId,
        post: linkedPostSnapshot,
      },
    });
  } catch (err: any) {
    console.error('[Events Webhook Error]:', err);
    return res.status(500).json({
      success: false,
      error: 'Database operation failed during event ingestion',
      message: err.message || 'Unknown database error',
      details: err.details || err.hint || null,
    });
  }
});

// Public GET events listing: only returns rows whose linked post has status = 'published'
expansionRouter.get('/events', async (req: Request, res: Response) => {
  const typeFilter = (req.query.type as string) || '';
  const searchFilter = (req.query.search as string) || '';

  const mapOpportunityTypes = (raw: string): string[] => {
    const tokens = raw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    const result: string[] = [];
    for (const token of tokens) {
      if (token === 'accelerator') {
        result.push('accelerator', 'incubator');
      } else if (token === 'pitch_competition') {
        result.push('pitch_competition', 'hackathon');
      } else {
        result.push(token);
      }
    }
    return Array.from(new Set(result));
  };

  const client = getSupabaseAdminClient();
  const types = typeFilter && typeFilter !== 'all' ? mapOpportunityTypes(typeFilter) : [];

  if (client) {
    await purgeLegacyMockRowsIfNeeded(client);
    try {
      let query = client
        .from('events')
        .select('*, linked_post:posts!inner(*)')
        .eq('linked_post.status', 'published')
        .order('deadline_date', { ascending: true });

      if (types.length === 1) {
        query = query.eq('opportunity_type', types[0]);
      } else if (types.length > 1) {
        query = query.in('opportunity_type', types);
      }

      if (searchFilter) {
        query = query.or(
          `title.ilike.%${searchFilter}%,description.ilike.%${searchFilter}%,location.ilike.%${searchFilter}%`
        );
      }

      let { data, error } = await query;

      // Handle 22P02 enum mismatch if remote DB hasn't applied latest enum additions
      if (error && error.code === '22P02' && types.length > 0) {
        const baseline = types.filter((t) =>
          ['grant', 'accelerator', 'pitch_competition', 'conference'].includes(t)
        );
        if (baseline.length > 0) {
          let retryQ = client
            .from('events')
            .select('*, linked_post:posts!inner(*)')
            .eq('linked_post.status', 'published')
            .order('deadline_date', { ascending: true });
          if (baseline.length === 1) {
            retryQ = retryQ.eq('opportunity_type', baseline[0]);
          } else {
            retryQ = retryQ.in('opportunity_type', baseline);
          }
          const retryRes = await retryQ;
          if (!retryRes.error && Array.isArray(retryRes.data)) {
            data = retryRes.data;
            error = null;
          }
        }
      }

      if (!error && Array.isArray(data)) {
        const dbSlugs = new Set(data.map((d: any) => d.slug));
        const matchingMemory = runtimeEvents.filter((m) => {
          if (dbSlugs.has(m.slug)) return false;
          if (m.linked_post?.status !== 'published') return false;
          if (types.length > 0) {
            return types.includes(String(m.opportunity_type || '').toLowerCase());
          }
          return true;
        });
        const combined = [...data, ...matchingMemory];
        return res.json({ success: true, count: combined.length, events: combined });
      }
    } catch {
      // fallback to runtime cache
    }
  }

  // In-memory fallback: strictly enforce that only events with published linked posts are returned
  let filtered = runtimeEvents.filter((e) => e.linked_post?.status === 'published');
  if (types.length > 0) {
    filtered = filtered.filter((e) =>
      types.includes(String(e.opportunity_type || '').toLowerCase())
    );
  }
  if (searchFilter) {
    const q = searchFilter.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q)
    );
  }

  return res.json({ success: true, count: filtered.length, events: filtered });
});

// Single event by slug: strictly require linked post status = 'published'
expansionRouter.get('/events/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('events')
        .select('*, linked_post:posts!inner(*)')
        .eq('slug', slug)
        .eq('linked_post.status', 'published')
        .maybeSingle();

      if (!error && data) {
        return res.json({ success: true, event: data });
      }
    } catch {
      // fallback
    }
  }

  const found = runtimeEvents.find(
    (e) => e.slug === slug && e.linked_post?.status === 'published'
  );
  if (found) {
    return res.json({ success: true, event: found });
  }

  return res.status(404).json({ error: 'Event not found' });
});

// Admin delete event
expansionRouter.delete('/events/:id', async (req: Request, res: Response) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;

  const { id } = req.params;
  const existingMemory = runtimeEvents.find((e) => e.id === id);
  const memoryLinkedPostId = existingMemory?.linked_post_id;
  runtimeEvents = runtimeEvents.filter((e) => e.id !== id);

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data: dbEvent } = await client
        .from('events')
        .select('id, linked_post_id')
        .eq('id', id)
        .maybeSingle();

      const linkedPostId = dbEvent?.linked_post_id || memoryLinkedPostId;

      await client.from('events').delete().eq('id', id);

      if (linkedPostId) {
        await client.from('posts').delete().eq('id', linkedPostId);
      }
    } catch {
      // ignore
    }
  }

  return res.json({ success: true, deletedId: id });
});
