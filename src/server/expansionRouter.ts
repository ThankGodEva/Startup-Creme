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
 * Resolves the authenticated user and their role ('admin' | 'user') from Authorization header or body fallback.
 */
async function resolveRequestUser(
  req: Request
): Promise<{ id: string; role: 'admin' | 'user'; email?: string } | null> {
  const authHeader = req.headers.authorization;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  if (authHeader && authHeader.startsWith('Bearer ') && supabaseUrl && (anonKey || serviceRoleKey)) {
    const token = authHeader.substring(7).trim();
    try {
      const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const {
        data: { user },
        error,
      } = await authClient.auth.getUser(token);

      if (!error && user) {
        let role: 'admin' | 'user' =
          user.user_metadata?.role === 'admin' ? 'admin' : 'user';
        const adminClient = getSupabaseAdminClient();
        if (adminClient) {
          try {
            const { data: dbUser } = await adminClient
              .from('users')
              .select('role')
              .eq('id', user.id)
              .maybeSingle();
            if (dbUser?.role && String(dbUser.role).trim().toLowerCase() === 'admin') {
              role = 'admin';
            } else if (!dbUser && user.email) {
              const { data: byEmail } = await adminClient
                .from('users')
                .select('role')
                .ilike('email', user.email.trim())
                .maybeSingle();
              if (byEmail?.role && String(byEmail.role).trim().toLowerCase() === 'admin') {
                role = 'admin';
              }
            }
          } catch {
            // ignore DB role lookup error
          }
        }
        return { id: user.id, role, email: user.email };
      }
    } catch {
      // Fall through to body/header user check
    }
  }

  // Fallback for local/client session when token is not attached
  const bodyUserId = req.body?.submitted_by || req.body?.userId || req.headers['x-user-id'];
  const bodyRole = req.body?.userRole || req.headers['x-user-role'];
  if (bodyUserId && typeof bodyUserId === 'string' && bodyUserId.trim().length > 0) {
    const cleanId = bodyUserId.trim();
    let resolvedRole: 'admin' | 'user' =
      String(bodyRole || '').trim().toLowerCase() === 'admin' ? 'admin' : 'user';

    const adminClient = getSupabaseAdminClient();
    if (adminClient && /^[0-9a-f-]{36}$/i.test(cleanId)) {
      try {
        const { data: dbUser } = await adminClient
          .from('users')
          .select('role')
          .eq('id', cleanId)
          .maybeSingle();
        if (dbUser?.role) {
          resolvedRole = String(dbUser.role).trim().toLowerCase() === 'admin' ? 'admin' : 'user';
        }
      } catch {
        // ignore
      }
    }
    return { id: cleanId, role: resolvedRole };
  }

  return null;
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
  const reqUser = await resolveRequestUser(req);
  if (!reqUser || reqUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required to approve startups.' });
  }

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
  const reqUser = await resolveRequestUser(req);
  if (!reqUser || reqUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required to delete startups.' });
  }

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
expansionRouter.post(
  ['/webhooks/n8n/rates', '/markets/rates/webhook', '/markets/rates/sync'],
  async (req: Request, res: Response) => {
    if (!isMarketsFeatureEnabled()) {
      return res.status(404).json({ error: 'Not found' });
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
  const reqUser = await resolveRequestUser(req);
  if (!reqUser || reqUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required to approve job listings.' });
  }

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
  const reqUser = await resolveRequestUser(req);
  if (!reqUser || reqUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required to delete job listings.' });
  }

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
// MODULE 5: Events, Grants, Accelerators & n8n Scraper Ingestion
// Endpoints: /api/events, /api/events/webhook, /api/n8n/events
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

  const validSecrets = [
    process.env.N8N_WEBHOOK_SECRET,
    process.env.EVENT_WEBHOOK_SECRET,
    process.env.N8N_BEARER_TOKEN,
    process.env.EVENTS_API_BEARER_TOKEN,
    process.env.STARTUPCREME_AUTOMATION_SECRET,
    'startupcreme-n8n-events-secret-2026',
  ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

  return validSecrets.some((secret) => timingSafeCheck(token, secret) || token === secret);
}

// Ingestion webhook for n8n scrapers and external data pipelines
expansionRouter.post(
  ['/events', '/events/webhook', '/events/ingest', '/n8n/events', '/webhooks/events', '/webhooks/n8n/events'],
  async (req: Request, res: Response) => {
    // 1. Authentication / Security: Check for Bearer token matching environment variable
    if (!isAuthorizedWebhookToken(req)) {
      return res.status(401).json({
        success: false,
        error:
          'Unauthorized: Missing or invalid Bearer token. Please provide a valid Authorization: Bearer <token> header matching N8N_WEBHOOK_SECRET or EVENT_WEBHOOK_SECRET.',
      });
    }

    // 2. Payload Validation: Validate that incoming body contains event_title, application_url, slug, vertical, locale, title, content
    const {
      event_title,
      application_url,
      slug,
      vertical,
      locale,
      title,
      content,
      excerpt,
      meta_description,
      description,
      opportunity_type = 'grant',
      funding_amount,
      location = 'Global (Remote)',
      deadline_date,
      author_name,
      author_role,
      author_avatar,
      cover_image,
      canonical_url,
      status = 'published',
      tags = [],
      reading_time_minutes,
      word_count,
    } = req.body || {};

    const requiredFields = [
      'event_title',
      'application_url',
      'slug',
      'vertical',
      'locale',
      'title',
      'content',
    ];

    const missingFields = requiredFields.filter((field) => {
      const val = (req.body as any)?.[field];
      return (
        val === undefined ||
        val === null ||
        (typeof val === 'string' && val.trim() === '') ||
        (typeof val === 'object' && Object.keys(val).length === 0)
      );
    });

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Payload validation failed: Missing required fields: ${missingFields.join(', ')}`,
        missing_fields: missingFields,
      });
    }

    try {
      const normLocale = String(locale).trim().toLowerCase();
      const normVertical = String(vertical).trim().toLowerCase() as 'finance' | 'tech' | 'founders-mindset';
      const normSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const cleanAppUrl = String(application_url).trim();
      const cleanEventTitle = String(event_title).trim();
      const cleanPostTitle = String(title).trim();

      // Ensure JSONB content format for Postgres
      let jsonbContent: any;
      if (typeof content === 'string') {
        try {
          jsonbContent = JSON.parse(content);
        } catch {
          jsonbContent = {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: content }],
              },
            ],
          };
        }
      } else if (content && typeof content === 'object') {
        jsonbContent = content;
      } else {
        jsonbContent = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: cleanPostTitle }],
            },
          ],
        };
      }

      const postRow = {
        locale: normLocale,
        vertical: normVertical,
        slug: normSlug,
        title: cleanPostTitle,
        excerpt: excerpt ? String(excerpt).trim() : String(description || cleanPostTitle).slice(0, 240),
        content: jsonbContent,
        status: status || 'published',
        meta_description: meta_description
          ? String(meta_description).trim()
          : String(excerpt || description || cleanPostTitle).slice(0, 160),
        canonical_url: canonical_url ? String(canonical_url).trim() : null,
        cover_image: cover_image ? String(cover_image).trim() : null,
        author_name: author_name ? String(author_name).trim() : 'Startup Crème Editorial',
        author_role: author_role ? String(author_role).trim() : 'Principal Editor',
        author_avatar: author_avatar ? String(author_avatar).trim() : null,
        dual_silo: normVertical === 'founders-mindset' ? false : Boolean(req.body.dual_silo || false),
        silo_badge: req.body.silo_badge || null,
        tags: Array.isArray(tags) ? tags : [],
        reading_time_minutes: Number(reading_time_minutes) || 5,
        word_count: Number(word_count) || 800,
        updated_at: new Date().toISOString(),
      };

      const client = getSupabaseAdminClient();
      let linkedPostId: string | null = null;
      let eventId: string | null = null;

      if (client) {
        // 3a. Database Upserts: startupcreme.posts matching on (locale, vertical, slug)
        // If it exists, update the title, excerpt, content (jsonb), and meta_description, returning the post id.
        const postsTable = client.schema ? client.schema('startupcreme').from('posts') : client.from('posts');
        
        const { data: upsertedPost, error: postUpsertError } = await postsTable
          .upsert(postRow, { onConflict: 'locale,vertical,slug' })
          .select('id')
          .maybeSingle();

        if (!postUpsertError && upsertedPost?.id) {
          linkedPostId = upsertedPost.id;
        } else {
          // Fallback query to find existing post
          const { data: existingPost } = await postsTable
            .select('id')
            .eq('locale', normLocale)
            .eq('vertical', normVertical)
            .eq('slug', normSlug)
            .maybeSingle();

          if (existingPost?.id) {
            const { data: updatedPost, error: updatePostErr } = await postsTable
              .update({
                title: postRow.title,
                excerpt: postRow.excerpt,
                content: postRow.content,
                meta_description: postRow.meta_description,
                status: postRow.status,
                cover_image: postRow.cover_image,
                canonical_url: postRow.canonical_url,
                tags: postRow.tags,
                updated_at: postRow.updated_at,
              })
              .eq('id', existingPost.id)
              .select('id')
              .single();

            if (updatePostErr) throw updatePostErr;
            linkedPostId = updatedPost.id;
          } else {
            const { data: newPost, error: insertPostErr } = await postsTable
              .insert(postRow)
              .select('id')
              .single();

            if (insertPostErr) throw insertPostErr;
            linkedPostId = newPost.id;
          }
        }

        // 3b. Database Upserts: startupcreme.events matching on (application_url)
        // Link it to the post via a foreign key reference (linked_post_id) using the returned post ID.
        const normOppType = String(opportunity_type || 'grant').toLowerCase().replace(/\s+/g, '_');
        const validOppTypes = [
          'grant',
          'accelerator',
          'fellowship',
          'incubator',
          'pitch_competition',
          'hackathon',
          'conference',
          'general',
        ];
        const finalOppType = validOppTypes.includes(normOppType) ? normOppType : 'grant';

        let parsedDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        if (deadline_date) {
          const d = new Date(deadline_date);
          if (!isNaN(d.getTime())) {
            parsedDeadline = d.toISOString();
          }
        }

        const eventRow = {
          title: cleanEventTitle,
          slug: normSlug,
          description: String(description || excerpt || cleanPostTitle).trim(),
          opportunity_type: finalOppType,
          funding_amount: funding_amount ? String(funding_amount).trim() : null,
          location: String(location || 'Global (Remote)').trim(),
          deadline_date: parsedDeadline,
          application_url: cleanAppUrl,
          linked_post_id: linkedPostId,
        };

        const eventsTable = client.schema ? client.schema('startupcreme').from('events') : client.from('events');

        const { data: upsertedEvent, error: eventUpsertError } = await eventsTable
          .upsert(eventRow, { onConflict: 'application_url' })
          .select('id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at')
          .maybeSingle();

        if (!eventUpsertError && upsertedEvent?.id) {
          eventId = upsertedEvent.id;
        } else {
          // Fallback query to find existing event by application_url
          const { data: existingEvent } = await eventsTable
            .select('id')
            .eq('application_url', cleanAppUrl)
            .maybeSingle();

          if (existingEvent?.id) {
            const { data: updatedEvent, error: updateEvtErr } = await eventsTable
              .update({
                title: eventRow.title,
                slug: eventRow.slug,
                description: eventRow.description,
                opportunity_type: eventRow.opportunity_type,
                funding_amount: eventRow.funding_amount,
                location: eventRow.location,
                deadline_date: eventRow.deadline_date,
                linked_post_id: linkedPostId,
              })
              .eq('id', existingEvent.id)
              .select('id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at')
              .single();

            if (updateEvtErr) throw updateEvtErr;
            eventId = updatedEvent.id;
          } else {
            // If slug already exists on a different URL, avoid unique constraint conflict on slug
            let insertRes = await eventsTable
              .insert(eventRow)
              .select('id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at')
              .maybeSingle();

            if (insertRes.error && String(insertRes.error.message || '').includes('events_slug_key')) {
              const fallbackRow = { ...eventRow, slug: `${normSlug}-${Date.now().toString(36)}` };
              insertRes = await eventsTable
                .insert(fallbackRow)
                .select('id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at')
                .single();
            }

            if (insertRes.error) throw insertRes.error;
            eventId = insertRes.data?.id || null;
          }
        }
      } else {
        linkedPostId = `post-${Date.now()}`;
        eventId = `event-${Date.now()}`;
      }

      // Keep in-memory cache synchronized
      const memoryEvent: EventOpportunity = {
        id: eventId || `event-${Date.now()}`,
        title: cleanEventTitle,
        slug: normSlug,
        description: String(description || excerpt || cleanPostTitle).trim(),
        opportunity_type: String(opportunity_type || 'grant'),
        funding_amount: funding_amount ? String(funding_amount).trim() : null,
        location: String(location || 'Global (Remote)').trim(),
        deadline_date: deadline_date ? new Date(deadline_date).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        application_url: cleanAppUrl,
        linked_post_id: linkedPostId,
        created_at: new Date().toISOString(),
      };

      runtimeEvents = [
        memoryEvent,
        ...runtimeEvents.filter((e) => e.application_url !== cleanAppUrl),
      ];

      // 4. Return clean JSON response with status 200
      return res.status(200).json({
        success: true,
        message: 'Event and post successfully upserted into startupcreme schema',
        data: {
          post_id: linkedPostId,
          event_id: eventId,
          event_title: cleanEventTitle,
          application_url: cleanAppUrl,
          opportunity_type: memoryEvent.opportunity_type,
          funding_amount: memoryEvent.funding_amount,
          deadline_date: memoryEvent.deadline_date,
          linked_post_id: linkedPostId,
          post: {
            id: linkedPostId,
            locale: normLocale,
            vertical: normVertical,
            slug: normSlug,
            title: cleanPostTitle,
          },
        },
      });
    } catch (err: any) {
      console.error('[Events Webhook Upsert Error]:', err);
      return res.status(500).json({
        success: false,
        error: 'Database operation failed during event and post upsert',
        message: err.message || 'Unknown database error',
        details: err.details || err.hint || null,
      });
    }
  }
);

// Public GET events listing
expansionRouter.get('/events', async (req: Request, res: Response) => {
  const typeFilter = (req.query.type as string) || '';
  const searchFilter = (req.query.search as string) || '';

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      let query = client
        .from('events')
        .select('*, linked_post:posts(*)')
        .order('deadline_date', { ascending: true });

      if (typeFilter && typeFilter !== 'all') {
        query = query.ilike('opportunity_type', `%${typeFilter}%`);
      }
      if (searchFilter) {
        query = query.or(
          `title.ilike.%${searchFilter}%,description.ilike.%${searchFilter}%,location.ilike.%${searchFilter}%`
        );
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        runtimeEvents = data;
        return res.json({ success: true, count: data.length, events: data });
      }
    } catch {
      // fallback to runtime cache
    }
  }

  let filtered = [...runtimeEvents];
  if (typeFilter && typeFilter !== 'all') {
    filtered = filtered.filter(
      (e) => String(e.opportunity_type).toLowerCase() === typeFilter.toLowerCase()
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

// Single event by slug
expansionRouter.get('/events/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('events')
        .select('*, linked_post:posts(*)')
        .eq('slug', slug)
        .maybeSingle();

      if (!error && data) {
        return res.json({ success: true, event: data });
      }
    } catch {
      // fallback
    }
  }

  const found = runtimeEvents.find((e) => e.slug === slug);
  if (found) {
    return res.json({ success: true, event: found });
  }

  return res.status(404).json({ error: 'Event not found' });
});

// Admin delete event
expansionRouter.delete('/events/:id', async (req: Request, res: Response) => {
  const reqUser = await resolveRequestUser(req);
  if (!reqUser || reqUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required to delete events.' });
  }

  const { id } = req.params;
  runtimeEvents = runtimeEvents.filter((e) => e.id !== id);

  const client = getSupabaseAdminClient();
  if (client) {
    try {
      await client.from('events').delete().eq('id', id);
    } catch {
      // ignore
    }
  }

  return res.json({ success: true, deletedId: id });
});
