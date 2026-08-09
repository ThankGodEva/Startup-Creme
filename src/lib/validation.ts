import { z } from 'zod';
import { normalizeImageUrl } from './router';

export const NewsletterSubscriptionSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  source: z.string().optional().default('footer'),
  vertical: z.enum(['all', 'finance', 'tech']).optional().default('all'),
  locale: z.string().optional().default('en-us'),
});

export const PostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters').max(500),
  content: z.string().min(20, 'Content must be at least 20 characters'),
  vertical: z.enum(['finance', 'tech']),
  locale: z.string().min(2).max(10),
  cover_image: z.string().transform(v => normalizeImageUrl(v)).optional().default(''),
  status: z.enum(['draft', 'published', 'archived']),
  dual_silo: z.boolean().optional().default(false),
});

export const TopicSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(150),
  body: z.string().min(10, 'Discussion body must be at least 10 characters'),
  category: z.enum(['Macro', 'Venture Capital', 'Fintech', 'AI Architecture', 'Hardware', 'Cloud Infrastructure']),
});

export const CommentSchema = z.object({
  topic_id: z.string().uuid().or(z.string().min(1)),
  content: z.string().min(2, 'Comment cannot be empty').max(2000),
  parent_id: z.string().uuid().optional().nullable(),
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
