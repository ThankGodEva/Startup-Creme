import { Post, DiscussionTopic } from '../types';

export type NavigationTab =
  | 'home'
  | 'finance'
  | 'tech'
  | 'discussion'
  | 'calculators'
  | 'directory'
  | 'rates'
  | 'careers'
  | 'admin'
  | 'privacy'
  | 'terms';

export function getPostUrl(post: Post): string {
  const loc = post.locale || 'en-us';
  const vert = post.vertical || 'finance';
  const slug = post.slug || 'article';
  return `/${loc}/${vert}/${slug}`;
}

export function getTopicUrl(topic: DiscussionTopic, locale = 'en-us'): string {
  const slug = topic.slug || 'topic';
  return `/${locale}/discussions/${slug}`;
}

export function getTabUrl(tab: NavigationTab, locale = 'en-us'): string {
  if (tab === 'admin') return '/admin';
  if (tab === 'home') return `/${locale}`;
  if (tab === 'discussion') return `/${locale}/discussions`;
  if (tab === 'calculators') return '/calculators';
  if (tab === 'directory') return '/directory';
  if (tab === 'rates') return '/markets/rates';
  if (tab === 'careers') return '/careers';
  if (tab === 'privacy') return `/${locale}/privacy`;
  if (tab === 'terms') return `/${locale}/terms`;
  return `/${locale}/${tab}`;
}

/**
 * Returns false when ENABLE_MARKETS or VITE_ENABLE_MARKETS is set to "false".
 * Defaults to true when unset.
 */
export function isMarketsEnabled(): boolean {
  let raw = '';
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      raw =
        (import.meta as any).env.VITE_ENABLE_MARKETS ??
        (import.meta as any).env.ENABLE_MARKETS ??
        '';
    }
  } catch {
    // ignore
  }
  if (!raw && typeof process !== 'undefined' && process.env) {
    raw = process.env.VITE_ENABLE_MARKETS ?? process.env.ENABLE_MARKETS ?? '';
  }
  const normalized = String(raw).trim().toLowerCase().replace(/^["']|["']$/g, '');
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return true;
}

export const VALID_LOCALES = ['en-us', 'en-gb', 'de-de', 'ja-jp', 'fr-fr', 'es-es', 'pt-br'];

export function normalizeImageUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}
