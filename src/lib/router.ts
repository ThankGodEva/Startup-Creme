import { Post, DiscussionTopic } from '../types';

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

export function getTabUrl(tab: 'home' | 'finance' | 'tech' | 'discussion' | 'admin', locale = 'en-us'): string {
  if (tab === 'admin') return '/admin';
  if (tab === 'home') return `/${locale}`;
  if (tab === 'discussion') return `/${locale}/discussions`;
  return `/${locale}/${tab}`;
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
