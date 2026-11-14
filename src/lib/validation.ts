import { z } from 'zod';
import { normalizeImageUrl } from './router';

export const NewsletterSubscriptionSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  source: z.string().optional().default('footer'),
  vertical: z.enum(['all', 'finance', 'tech', 'founders-mindset']).optional().default('all'),
  locale: z.string().optional().default('en-us'),
});

export const PostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters').max(500),
  content: z.string().min(20, 'Content must be at least 20 characters'),
  vertical: z.enum(['finance', 'tech', 'founders-mindset']),
  locale: z.string().min(2).max(10),
  cover_image: z.string().transform(v => normalizeImageUrl(v)).optional().default(''),
  status: z.enum(['draft', 'published', 'archived']),
  dual_silo: z.boolean().optional().default(false),
  source_url: z
    .string()
    .trim()
    .regex(/^https:\/\/.+/i, 'Source URL must be a valid HTTPS URL')
    .optional()
    .nullable(),
  source_name: z.string().trim().max(120).optional().nullable(),
  ai_generated: z.boolean().optional().default(false),
  hide_ai_disclosure: z.boolean().optional().default(false),
});

export const EditorialDraftSubmissionSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(200, 'Title cannot exceed 200 characters'),
  slug: z
    .string()
    .trim()
    .min(3, 'Slug must be at least 3 characters')
    .max(100, 'Slug cannot exceed 100 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens (e.g., "fintech-infrastructure-2026")'),
  vertical: z.enum(['finance', 'tech', 'founders-mindset']),
  content: z.union([
    z.string().trim().min(20, 'Content must be at least 20 characters'),
    z.record(z.string(), z.any()),
  ]),
  locale: z.string().trim().toLowerCase().min(2).max(10).optional().default('en-us'),
  excerpt: z.string().trim().max(500).optional(),
  meta_description: z.string().trim().max(200).optional(),
  canonical_url: z.string().trim().url('Canonical URL must be a valid URL').optional().nullable(),
  cover_image: z
    .string()
    .trim()
    .regex(/^https:\/\/.+/i, 'Cover image must be a valid HTTPS URL')
    .optional()
    .nullable(),
  source_url: z
    .string()
    .trim()
    .regex(/^https:\/\/.+/i, 'Source URL must be a valid HTTPS URL')
    .optional()
    .nullable(),
  source_name: z.string().trim().max(120).optional().nullable(),
  ai_generated: z.boolean().optional().default(false),
  hide_ai_disclosure: z.boolean().optional().default(false),
  author_name: z.string().trim().max(80).optional().default('Startup Crème Editorial'),
  author_role: z.string().trim().max(80).optional().default('Senior Analyst'),
  author_avatar: z
    .string()
    .trim()
    .regex(/^(https:\/\/.+|\/.+)/i, 'Author avatar must be a valid HTTPS URL or local path')
    .optional()
    .nullable(),
  dual_silo: z.boolean().optional().default(false),
  tags: z.array(z.string().trim().min(1).max(50)).max(15).optional().default([]),
  reading_time_minutes: z.number().int().positive().max(120).optional(),
  word_count: z.number().int().nonnegative().optional(),
  idempotency_key: z.string().trim().min(4).max(256).optional(),
  workflow_id: z.string().trim().max(128).optional(),
});

export const TopicSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(150),
  body: z.string().min(10, 'Discussion body must be at least 10 characters'),
  category: z.enum([
    'Macro',
    'Venture Capital',
    'Fintech',
    'AI Architecture',
    'Hardware',
    'Cloud Infrastructure',
    'Sales',
    'Marketing',
    'sales',
    'marketing',
    'finance',
    'tech',
    'startup',
    'general',
  ]),
});

export const CommentSchema = z.object({
  topic_id: z.string().uuid().or(z.string().min(1)),
  content: z.string().min(2, 'Comment cannot be empty').max(2000),
  parent_id: z.string().uuid().optional().nullable(),
});

export const GuestCommentSchema = z.object({
  author_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name cannot exceed 60 characters'),
  author_email: z.string().trim().email('Please enter a valid email address').toLowerCase(),
  content: z.string().trim().min(2, 'Comment must be at least 2 characters').max(2000, 'Comment cannot exceed 2000 characters'),
});

export const WEBHOOK_OPPORTUNITY_TYPES = [
  'grant',
  'accelerator',
  'incubator',
  'fellowship',
  'pitch_competition',
  'hackathon',
  'conference',
] as const;

export const EventWebhookIngestionSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters').optional(),
    event_title: z.string().trim().min(3, 'Event title must be at least 3 characters').max(200, 'Event title cannot exceed 200 characters').optional(),
    slug: z
      .string()
      .trim()
      .min(3, 'Slug must be at least 3 characters')
      .max(100, 'Slug cannot exceed 100 characters')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens (e.g., "frontier-grant-2026")')
      .optional(),
    opportunity_type: z
      .string()
      .trim()
      .refine(
        (val: any) => (WEBHOOK_OPPORTUNITY_TYPES as readonly string[]).includes(val),
        {
          message:
            "opportunity_type must be one of: grant, accelerator, incubator, fellowship, pitch_competition, hackathon, conference. 'general' is rejected on this route.",
        }
      ) as unknown as z.ZodType<(typeof WEBHOOK_OPPORTUNITY_TYPES)[number]>,
    application_url: z
      .string()
      .trim()
      .regex(/^https:\/\/.+/i, 'Application URL must be a valid HTTPS URL'),
    deadline_date: z
      .string()
      .trim()
      .min(1, 'deadline_date is required')
      .refine(
        (val) => {
          const ms = Date.parse(val);
          return !isNaN(ms) && ms > Date.now();
        },
        { message: 'deadline_date must be a valid future timestamp' }
      ),
    vertical: z.enum(['finance', 'tech', 'founders-mindset']).optional().default('tech'),
    locale: z.string().trim().toLowerCase().min(2).max(10).optional().default('en-us'),
    content: z
      .union([
        z.string().trim().min(20, 'Content must be at least 20 characters'),
        z.record(z.string(), z.any()),
      ])
      .optional(),
    description: z.string().trim().max(2000).optional(),
    excerpt: z.string().trim().max(500).optional(),
    location: z.string().trim().min(2, 'Location is required').max(100).optional().default('Global (Remote)'),
    funding_amount: z.string().trim().max(100).optional().nullable(),
    status: z.enum(['draft', 'published']).optional().default('draft'),
    tags: z.array(z.string().trim().min(1).max(50)).max(15, 'Maximum 15 tags allowed').optional().default([]),
    cover_image: z
      .string()
      .trim()
      .regex(/^https:\/\/.+/i, 'Cover image must be a valid HTTPS URL')
      .optional()
      .nullable(),
    author_name: z.string().trim().max(80).optional().default('Startup Crème Editorial'),
    author_role: z.string().trim().max(80).optional().default('Principal Editor'),
    author_avatar: z
      .string()
      .trim()
      .regex(/^(https:\/\/.+|\/.+)/i, 'Author avatar must be a valid HTTPS URL or local path')
      .optional()
      .nullable(),
    canonical_url: z.string().trim().url('Canonical URL must be a valid URL').optional().nullable(),
    meta_description: z.string().trim().max(200).optional(),
    reading_time_minutes: z.number().int().positive().max(120).optional(),
    word_count: z.number().int().nonnegative().optional(),
    dual_silo: z.boolean().optional().default(false),
    silo_badge: z.string().optional().nullable(),
    source_url: z
      .string()
      .trim()
      .regex(/^https:\/\/.+/i, 'Source URL must be a valid HTTPS URL')
      .optional()
      .nullable(),
    source_name: z.string().trim().max(120).optional().nullable(),
    ai_generated: z.boolean().optional().default(false),
    hide_ai_disclosure: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const effectiveTitle = (data.event_title || data.title || '').trim();
    if (!effectiveTitle || effectiveTitle.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either title or event_title is required (min 3 characters)',
        path: ['title'],
      });
    }

    const effectiveContent = data.content || data.description;
    if (!effectiveContent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either content (min 20 characters or Tiptap object) or description is required',
        path: ['content'],
      });
    } else if (typeof effectiveContent === 'string' && effectiveContent.trim().length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Content or description must be at least 20 characters',
        path: ['content'],
      });
    }
  });

export const EventSubmissionSchema = z.object({
  title: z.string().trim().min(3, 'Event title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
  opportunity_type: z.enum([
    'grant',
    'accelerator',
    'fellowship',
    'incubator',
    'pitch_competition',
    'hackathon',
    'conference',
    'general',
  ]),
  application_url: z.string().trim().url('Please enter a valid URL (starting with http:// or https://)'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  location: z.string().trim().min(2, 'Location is required').max(100).default('Global (Remote)'),
  deadline_date: z.string().trim().min(4, 'Valid deadline date required'),
  funding_amount: z.string().trim().max(100).optional().nullable(),
  banner_image: z.string().trim().optional().nullable(),
  create_post: z.boolean().optional().default(false),
  vertical: z.enum(['finance', 'tech', 'founders-mindset']).optional().default('tech'),
  locale: z.string().trim().optional().default('en-us'),
  slug: z.string().trim().optional(),
  content: z.string().trim().optional(),
});

export function sanitizeHtmlText(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
