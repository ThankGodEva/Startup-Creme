import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  INITIAL_STARTUPS,
  INITIAL_CENTRAL_BANK_RATES,
  INITIAL_CLOUD_PRICING_INDEX,
  INITIAL_RATE_SNAPSHOT,
  INITIAL_JOBS,
} from '../lib/expansionData';
import {
  StartupEntry,
  JobListing,
  RateSnapshotPayload,
} from '../types';

export const expansionRouter = Router();

// Runtime cache synchronized with Supabase
let runtimeStartups: StartupEntry[] = [...INITIAL_STARTUPS];
let runtimeJobs: JobListing[] = [...INITIAL_JOBS];
let runtimeRateSnapshot: RateSnapshotPayload = { ...INITIAL_RATE_SNAPSHOT };
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
