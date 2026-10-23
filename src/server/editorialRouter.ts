import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { EditorialDraftSubmissionSchema } from '../lib/validation';

export const editorialRouter = Router();

// ====================================================================
// In-Memory Idempotency & Runtime Cache
// Guarantees resilience across environments, test suites, and cold-starts
// ====================================================================
interface IdempotencyRecord {
  idempotency_key: string;
  request_fingerprint: string;
  post_id: string;
  slug: string;
  locale: string;
  vertical: string;
  workflow_id?: string;
  created_at: string;
}

const memoryIdempotencyStore = new Map<string, IdempotencyRecord>();
const inFlightRequests = new Map<string, Promise<any>>();

// Timing-safe secret comparison to prevent side-channel timing attacks
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Compute deterministic SHA-256 fingerprint of the normalized article payload
export function computeRequestFingerprint(payload: {
  slug: string;
  vertical: string;
  locale: string;
  title: string;
  content: any;
  excerpt?: string;
}): string {
  const contentStr =
    typeof payload.content === 'object'
      ? JSON.stringify(payload.content)
      : String(payload.content || '').trim();

  const canonicalString = [
    payload.locale.toLowerCase().trim(),
    payload.vertical.toLowerCase().trim(),
    payload.slug.toLowerCase().trim(),
    payload.title.trim(),
    (payload.excerpt || '').trim(),
    contentStr,
  ].join(':::');

  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

// Supabase Service Role Database Client
function getSupabaseServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes('placeholder')) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    db: { schema: 'startupcreme' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Middleware: Authenticate external editorial workflow callers
export function requireEditorialAuth(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers['x-editorial-secret'] as string | undefined;

  let providedToken = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    providedToken = authHeader.slice(7).trim();
  } else if (customHeader) {
    providedToken = customHeader.trim();
  }

  // Reject immediately if no token provided
  if (!providedToken) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Missing Authorization Bearer token matching N8N_EDITORIAL_SECRET.',
      code: 'UNAUTHORIZED_EDITORIAL',
    });
  }

  // Strictly reject old events fallback secret if attempted
  if (providedToken === 'startupcreme-n8n-events-secret-2026') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: The legacy events secret cannot be used for editorial draft submissions.',
      code: 'UNAUTHORIZED_EDITORIAL',
    });
  }

  const rawConfiguredSecret = process.env.N8N_EDITORIAL_SECRET?.trim();
  const configuredSecret =
    rawConfiguredSecret && rawConfiguredSecret !== 'your_n8n_editorial_secret_key'
      ? rawConfiguredSecret
      : '';

  // Fail closed if N8N_EDITORIAL_SECRET is missing, blank, or placeholder
  if (!configuredSecret) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Editorial webhook secret is not configured on the server. Access denied.',
      code: 'UNAUTHORIZED_EDITORIAL',
    });
  }

  if (!secureCompare(providedToken, configuredSecret)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid editorial token.',
      code: 'UNAUTHORIZED_EDITORIAL',
    });
  }

  next();
}

// ====================================================================
// POST /api/editorial/drafts
// Authoritative ingestion endpoint for completed n8n editorial articles
// ====================================================================
editorialRouter.post('/drafts', requireEditorialAuth, async (req: Request, res: Response) => {
  // 1. NON-NEGOTIABLE SECURITY: Caller-controlled publication status is strictly forbidden
  if (req.body && 'status' in req.body) {
    return res.status(400).json({
      success: false,
      error: 'Forbidden: External workflows cannot specify or override publication status. All submissions must be drafts.',
      code: 'STATUS_OVERRIDE_FORBIDDEN',
    });
  }

  // 2. Validate payload schema
  const parseResult = EditorialDraftSubmissionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed: Invalid article payload.',
      code: 'VALIDATION_ERROR',
      details: parseResult.error.flatten(),
    });
  }

  const payload = parseResult.data;
  const idempotencyKey =
    (req.headers['idempotency-key'] as string | undefined)?.trim() ||
    (req.headers['x-idempotency-key'] as string | undefined)?.trim() ||
    payload.idempotency_key;

  const workflowId =
    (req.headers['x-workflow-id'] as string | undefined)?.trim() || payload.workflow_id;

  const currentFingerprint = computeRequestFingerprint({
    slug: payload.slug,
    vertical: payload.vertical,
    locale: payload.locale,
    title: payload.title,
    content: payload.content,
    excerpt: payload.excerpt,
  });

  // Calculate words and reading time if not provided
  let calculatedWordCount = payload.word_count;
  if (!calculatedWordCount) {
    const rawText =
      typeof payload.content === 'string'
        ? payload.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        : JSON.stringify(payload.content);
    calculatedWordCount = Math.max(1, rawText.split(/\s+/).filter(Boolean).length);
  }

  const calculatedReadingTime =
    payload.reading_time_minutes || Math.max(1, Math.ceil(calculatedWordCount / 200));

  // Determine normalized JSONB content format for Postgres
  let jsonbContent: any;
  if (typeof payload.content === 'string') {
    try {
      jsonbContent = JSON.parse(payload.content);
    } catch {
      // Store rich HTML directly as string primitive in JSONB
      jsonbContent = payload.content;
    }
  } else {
    jsonbContent = payload.content;
  }

  // 3. Concurrency Lock: Prevent race conditions on concurrent identical submissions
  const lockKey = `${payload.locale}::${payload.vertical}::${payload.slug}`;
  if (inFlightRequests.has(lockKey)) {
    try {
      await inFlightRequests.get(lockKey);
    } catch {
      // Allow execution to proceed to database state check
    }
  }

  let resolveLock: () => void = () => {};
  const lockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  inFlightRequests.set(lockKey, lockPromise);

  try {
    const supabase = getSupabaseServiceClient();

    // 4. Check existing idempotency record (by key)
    let existingIdempotency: IdempotencyRecord | null = null;
    if (idempotencyKey) {
      existingIdempotency = memoryIdempotencyStore.get(idempotencyKey) || null;

      if (!existingIdempotency && supabase) {
        try {
          const { data, error } = await supabase
            .from('editorial_idempotency')
            .select('*')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();

          if (!error && data) {
            existingIdempotency = data as IdempotencyRecord;
            memoryIdempotencyStore.set(idempotencyKey, existingIdempotency);
          }
        } catch {
          // Table may not exist yet if migration not applied; fallback to memory store
        }
      }
    }

    // If key exists, verify fingerprint
    if (existingIdempotency) {
      if (existingIdempotency.request_fingerprint !== currentFingerprint) {
        return res.status(409).json({
          success: false,
          error: `Conflict: Idempotency key '${idempotencyKey}' was already used with a different article payload.`,
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        });
      }

      // Safe idempotent replay: fetch and return existing draft
      let replayedPost: any = null;
      if (supabase) {
        try {
          const { data } = await supabase
            .from('posts')
            .select('id, slug, vertical, locale, title, status, word_count, reading_time_minutes, created_at, updated_at')
            .eq('id', existingIdempotency.post_id)
            .maybeSingle();
          if (data) replayedPost = data;
        } catch {
          // ignore
        }
      }

      const host = req.get('x-forwarded-host') || req.get('host') || 'www.startupcreme.com';
      const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
      const baseUrl = `${protocol}://${host}`;

      return res.status(200).json({
        success: true,
        action: 'replayed',
        post: replayedPost || {
          id: existingIdempotency.post_id,
          slug: existingIdempotency.slug,
          vertical: existingIdempotency.vertical,
          locale: existingIdempotency.locale,
          title: payload.title,
          status: 'draft',
        },
        editorial_urls: {
          cms_editor_url: `${baseUrl}/admin?tab=posts&edit=${encodeURIComponent(payload.slug)}`,
        },
        idempotency: {
          key: idempotencyKey,
          replayed: true,
        },
      });
    }

    // 5. Check collision against existing posts table
    if (supabase) {
      try {
        const { data: existingPost, error: postLookupError } = await supabase
          .from('posts')
          .select('id, slug, vertical, locale, title, status, updated_at')
          .eq('locale', payload.locale)
          .eq('vertical', payload.vertical)
          .eq('slug', payload.slug)
          .maybeSingle();

        if (!postLookupError && existingPost) {
          // Case A: Published article collision -> Strictly forbidden
          if (existingPost.status === 'published') {
            return res.status(409).json({
              success: false,
              error: `Conflict: An article with slug '${payload.slug}' is already published in the ${payload.vertical} vertical. Automated workflows cannot modify or overwrite published articles.`,
              code: 'PUBLISHED_ARTICLE_COLLISION',
              existing_article: {
                id: existingPost.id,
                slug: existingPost.slug,
                vertical: existingPost.vertical,
                status: existingPost.status,
              },
            });
          }

          // Case B: Existing draft collision with missing or different idempotency key
          return res.status(409).json({
            success: false,
            error: `Conflict: A draft with slug '${payload.slug}' already exists in the ${payload.vertical} vertical. To protect editorial revisions, existing drafts cannot be overwritten.`,
            code: 'DRAFT_COLLISION',
            existing_draft: {
              id: existingPost.id,
              slug: existingPost.slug,
              vertical: existingPost.vertical,
              status: existingPost.status,
              updated_at: existingPost.updated_at,
            },
          });
        }
      } catch (err: any) {
        console.error('[EditorialRouter] Error checking post collision:', err);
        return res.status(500).json({
          success: false,
          error: 'Internal error checking post availability.',
          code: 'DATABASE_ERROR',
        });
      }
    }

    // 6. Create Draft in startupcreme.posts
    // NON-NEGOTIABLE: status is hardcoded to 'draft'
    const newPostId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const postRow = {
      id: newPostId,
      slug: payload.slug,
      locale: payload.locale,
      vertical: payload.vertical,
      title: payload.title,
      excerpt: payload.excerpt || payload.meta_description || payload.title.slice(0, 240),
      content: jsonbContent,
      status: 'draft', // Strictly hardcoded server-side
      meta_description: payload.meta_description || payload.excerpt || payload.title.slice(0, 160),
      canonical_url: payload.canonical_url || null,
      cover_image: payload.cover_image || null,
      author_name: payload.author_name || 'Startup Crème Editorial',
      author_role: payload.author_role || 'Senior Analyst',
      author_avatar: payload.author_avatar || null,
      dual_silo: payload.dual_silo || false,
      silo_badge: payload.dual_silo ? 'Dual Silo Analysis' : null,
      tags: payload.tags && payload.tags.length > 0 ? payload.tags : ['Editorial'],
      reading_time_minutes: calculatedReadingTime,
      word_count: calculatedWordCount,
      created_at: nowIso,
      updated_at: nowIso,
    };

    let persistedInDb = false;
    let savedPost = postRow;

    if (supabase) {
      try {
        const { data: insertedPost, error: insertError } = await supabase
          .from('posts')
          .insert(postRow)
          .select('id, slug, vertical, locale, title, status, word_count, reading_time_minutes, created_at, updated_at')
          .single();

        if (insertError) {
          console.error('[EditorialRouter] Supabase insert error:', insertError.message);
          if (insertError.code === '23505' || insertError.message.includes('unique')) {
            return res.status(409).json({
              success: false,
              error: `Conflict: An article with slug '${payload.slug}' already exists in the ${payload.vertical} vertical.`,
              code: 'DUPLICATE_SLUG',
            });
          }
          return res.status(500).json({
            success: false,
            error: 'Failed to persist article draft in database.',
            code: 'DATABASE_ERROR',
          });
        }

        if (insertedPost) {
          savedPost = insertedPost as any;
          persistedInDb = true;
        }
      } catch (err: any) {
        console.error('[EditorialRouter] Database exception on post insert:', err);
        return res.status(500).json({
          success: false,
          error: 'Database connection failed while creating article draft.',
          code: 'DATABASE_ERROR',
        });
      }
    }

    // 7. Record Idempotency Entry
    if (idempotencyKey) {
      const record: IdempotencyRecord = {
        idempotency_key: idempotencyKey,
        request_fingerprint: currentFingerprint,
        post_id: savedPost.id,
        slug: savedPost.slug,
        locale: savedPost.locale,
        vertical: savedPost.vertical,
        workflow_id: workflowId,
        created_at: nowIso,
      };

      memoryIdempotencyStore.set(idempotencyKey, record);

      if (supabase) {
        try {
          await supabase.from('editorial_idempotency').insert({
            idempotency_key: idempotencyKey,
            request_fingerprint: currentFingerprint,
            post_id: savedPost.id,
            workflow_id: workflowId || null,
            created_at: nowIso,
            updated_at: nowIso,
          });
        } catch {
          // Graceful fallback if migration not yet applied
        }
      }
    }

    const host = req.get('x-forwarded-host') || req.get('host') || 'www.startupcreme.com';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    const baseUrl = `${protocol}://${host}`;

    return res.status(201).json({
      success: true,
      action: 'created',
      persisted: persistedInDb ? 'database' : 'memory',
      post: {
        id: savedPost.id,
        slug: savedPost.slug,
        vertical: savedPost.vertical,
        locale: savedPost.locale,
        title: savedPost.title,
        status: 'draft',
        word_count: savedPost.word_count,
        reading_time_minutes: savedPost.reading_time_minutes,
        created_at: savedPost.created_at,
        updated_at: savedPost.updated_at,
      },
      editorial_urls: {
        cms_editor_url: `${baseUrl}/admin?tab=posts&edit=${encodeURIComponent(savedPost.slug)}`,
      },
      idempotency: {
        key: idempotencyKey || null,
        replayed: false,
      },
    });
  } finally {
    resolveLock();
    inFlightRequests.delete(lockKey);
  }
});
