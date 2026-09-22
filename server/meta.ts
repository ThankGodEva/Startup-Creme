import { createClient } from '@supabase/supabase-js';

export interface PageMetadata {
  title: string;
  description: string;
  coverImage: string;
  canonicalUrl: string;
  pageType: 'article' | 'website';
  authorName?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  ssrPayloadScript?: string;
  jsonLdScript?: string;
}

const DEFAULT_TITLE = 'StartupCrème | Financial & Technology Intelligence';
const DEFAULT_DESCRIPTION = 'StartupCrème is the premier digital publication for Finance, Macro-economics, and Deep Technology.';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630';

/**
 * Normalizes an image URL to an absolute URL beginning with https:// or http://
 */
export function ensureAbsoluteUrl(url: string | null | undefined, baseUrl: string): string {
  if (!url) return DEFAULT_IMAGE;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_IMAGE;

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return DEFAULT_IMAGE;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return `${baseUrl.replace(/\/+$/, '')}${trimmed}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Escapes characters for safe inclusion in HTML attribute values.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Extracts a clean plain-text description snippet from post excerpt, meta_description, or rich content.
 */
export function resolveArticleDescription(post: any): string {
  if (post.excerpt && typeof post.excerpt === 'string' && post.excerpt.trim().length > 10) {
    return post.excerpt.trim();
  }
  if (post.meta_description && typeof post.meta_description === 'string' && post.meta_description.trim().length > 10) {
    return post.meta_description.trim();
  }
  if (post.excerpt && typeof post.excerpt === 'string' && post.excerpt.trim().length > 0) {
    return post.excerpt.trim();
  }
  if (post.meta_description && typeof post.meta_description === 'string' && post.meta_description.trim().length > 0) {
    return post.meta_description.trim();
  }

  // Attempt to extract text from Tiptap JSON content structure if present
  try {
    if (post.content && typeof post.content === 'object' && Array.isArray(post.content.content)) {
      const texts: string[] = [];
      for (const node of post.content.content) {
        if (node.type === 'paragraph' && Array.isArray(node.content)) {
          for (const child of node.content) {
            if (child.text && typeof child.text === 'string') {
              texts.push(child.text.trim());
            }
          }
        }
        if (texts.join(' ').length >= 140) break;
      }
      const combined = texts.join(' ').trim();
      if (combined.length > 20) {
        return combined.length > 200 ? `${combined.substring(0, 197)}...` : combined;
      }
    }
  } catch {
    // ignore
  }

  return DEFAULT_DESCRIPTION;
}

/**
 * Resolves metadata for any StartupCrème URL route, querying Supabase when applicable.
 */
export async function resolvePageMetadata(
  reqPath: string,
  host: string,
  protocol: string
): Promise<PageMetadata> {
  // Normalize host & protocol
  let normalizedHost = host || 'www.startupcreme.com';
  if (!normalizedHost.includes('startupcreme.com') && !normalizedHost.includes('localhost') && !normalizedHost.includes('127.0.0.1')) {
    // If running in container or proxy behind unknown host, prefer startupcreme.com
    if (normalizedHost.includes('run.app')) {
      // Allow Cloud Run URL for testing
    } else {
      normalizedHost = 'www.startupcreme.com';
    }
  }

  let normalizedProtocol = protocol || 'https';
  if (normalizedHost.includes('startupcreme.com')) {
    normalizedProtocol = 'https';
  }

  const baseUrl = `${normalizedProtocol}://${normalizedHost}`;
  const cleanPath = reqPath.split('?')[0].split('#')[0];
  const fullUrl = `${baseUrl}${cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath}`;

  const segments = cleanPath.split('/').filter(Boolean);

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let coverImage = DEFAULT_IMAGE;
  let pageType: 'article' | 'website' = 'website';
  let authorName: string | undefined;
  let publishedTime: string | undefined;
  let modifiedTime: string | undefined;
  let section: string | undefined;
  let tags: string[] | undefined;
  let ssrPayloadScript = '';
  let jsonLdScript = '';

  const excluded = [
    'finance',
    'tech',
    'discussion',
    'discussions',
    'admin',
    'sitemap.xml',
    'robots.txt',
    'privacy',
    'privacy-policy',
    'terms',
    'terms-of-service',
    'terms-of-editorial-service',
    'api',
    'uploads',
    'assets',
  ];

  if (segments.length > 0) {
    const rawSlug = segments[segments.length - 1];
    const lowerSlug = rawSlug.toLowerCase();

    // 1. Static Silo Category Sections
    if (lowerSlug === 'finance') {
      title = 'Finance, Markets & Venture Intelligence | StartupCrème';
      description = 'Authoritative reporting on African and global fintech, capital markets, venture capital, macroeconomics, and institutional investments.';
      coverImage = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200&h=630';
      section = 'Finance';
    } else if (lowerSlug === 'tech') {
      title = 'Deep Technology & Frontier AI Intelligence | StartupCrème';
      description = 'Frontier artificial intelligence architectures, developer tooling, cloud infrastructure, and emerging startup technology ecosystems.';
      coverImage = 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1200&h=630';
      section = 'Technology';
    } else if (lowerSlug === 'discussions' || lowerSlug === 'discussion') {
      title = 'Editorial Community & Technical Discussions | StartupCrème';
      description = 'Engage with institutional analysts, technical founders, and verified engineering leaders on market strategy and AI infrastructure.';
      section = 'Discussions';
    } else if (lowerSlug === 'privacy' || lowerSlug === 'privacy-policy') {
      title = 'Privacy Policy | StartupCrème Editorial Platform';
      description = 'StartupCrème privacy policy and user data governance standards.';
    } else if (lowerSlug === 'terms' || lowerSlug === 'terms-of-service' || lowerSlug === 'terms-of-editorial-service') {
      title = 'Terms of Editorial Service | StartupCrème';
      description = 'Terms of service and reader agreement for StartupCrème publications.';
    } else if (rawSlug && !excluded.includes(lowerSlug)) {
      // 2. Dynamic Article or Discussion Topic Resolution
      const decodedSlug = decodeURIComponent(rawSlug).trim();
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      // Prefer service role key for reliable SSR reads without RLS friction, falling back to anon key
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        '';

      if (supabaseUrl && supabaseKey) {
        try {
          const scClient = createClient(supabaseUrl, supabaseKey, {
            db: { schema: 'startupcreme' },
            auth: { persistSession: false, autoRefreshToken: false }
          });
          const defaultClient = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false }
          });

          const executeQuery = async (queryFn: (client: any) => PromiseLike<any>) => {
            try {
              const res = await queryFn(scClient);
              if (!res.error && res.data && (!Array.isArray(res.data) || res.data.length > 0)) {
                return res;
              }
            } catch {
              // fallback to default schema
            }
            return await queryFn(defaultClient);
          };

          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedSlug);

          // Find post with resilient multi-strategy lookup
          let foundPost: any = null;

          // Strategy A: Exact or case-insensitive slug match
          const resA = await executeQuery((client) =>
            client.from('posts').select('*').ilike('slug', decodedSlug).limit(1)
          );
          if (resA?.data && resA.data.length > 0) {
            foundPost = resA.data[0];
          }

          // Strategy B: If UUID, check by id
          if (!foundPost && isUuid) {
            const resUuid = await executeQuery((client) =>
              client.from('posts').select('*').eq('id', decodedSlug).limit(1)
            );
            if (resUuid?.data && resUuid.data.length > 0) {
              foundPost = resUuid.data[0];
            }
          }

          // Strategy C: Hyphen to space substitution (handles titles saved with spaces in slug)
          if (!foundPost && decodedSlug.includes('-')) {
            const withSpaces = decodedSlug.replace(/-/g, ' ');
            const resSpaces = await executeQuery((client) =>
              client.from('posts').select('*').ilike('slug', withSpaces).limit(1)
            );
            if (resSpaces?.data && resSpaces.data.length > 0) {
              foundPost = resSpaces.data[0];
            }
          }

          // Strategy D: Space to hyphen substitution
          if (!foundPost && decodedSlug.includes(' ')) {
            const withHyphens = decodedSlug.replace(/\s+/g, '-');
            const resHyphens = await executeQuery((client) =>
              client.from('posts').select('*').ilike('slug', withHyphens).limit(1)
            );
            if (resHyphens?.data && resHyphens.data.length > 0) {
              foundPost = resHyphens.data[0];
            }
          }

          // Strategy E: Resilient substring matching on longer slugs
          if (!foundPost && decodedSlug.length > 12) {
            const prefix = decodedSlug.slice(0, 30);
            const resPartial = await executeQuery((client) =>
              client.from('posts').select('*').ilike('slug', `%${prefix}%`).limit(1)
            );
            if (resPartial?.data && resPartial.data.length > 0) {
              foundPost = resPartial.data[0];
            }
          }

          if (foundPost) {
            title = `${foundPost.title} | StartupCrème`;
            description = resolveArticleDescription(foundPost);
            coverImage = ensureAbsoluteUrl(foundPost.cover_image, baseUrl);
            pageType = 'article';
            authorName = foundPost.author_name || 'Startup Crème Editorial';
            publishedTime = foundPost.created_at || new Date().toISOString();
            modifiedTime = foundPost.updated_at || foundPost.created_at || new Date().toISOString();
            section = foundPost.vertical === 'tech' ? 'Technology' : 'Finance';
            tags = Array.isArray(foundPost.tags) ? foundPost.tags : [];

            const sanitizedPost = JSON.stringify(foundPost).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
            ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_POST__ = ${sanitizedPost};</script>`;

            // Rich Schema.org NewsArticle JSON-LD
            const articleJsonLd = {
              '@context': 'https://schema.org',
              '@type': 'NewsArticle',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': fullUrl
              },
              headline: foundPost.title,
              description: description,
              image: [coverImage],
              datePublished: publishedTime,
              dateModified: modifiedTime,
              author: {
                '@type': 'Person',
                name: authorName
              },
              publisher: {
                '@type': 'Organization',
                name: 'StartupCrème',
                logo: {
                  '@type': 'ImageObject',
                  url: `${baseUrl}/logo.jpg`
                }
              },
              articleSection: section,
              keywords: tags.join(', ')
            };
            jsonLdScript = `<script type="application/ld+json">${JSON.stringify(articleJsonLd)}</script>`;
          } else {
            // Check discussion topics if no post matched
            let foundTopic: any = null;
            const topicResA = await executeQuery((client) =>
              client.from('discussion_topics').select('*').ilike('slug', decodedSlug).limit(1)
            );
            if (topicResA?.data && topicResA.data.length > 0) {
              foundTopic = topicResA.data[0];
            } else if (decodedSlug.includes('-')) {
              const topicResB = await executeQuery((client) =>
                client.from('discussion_topics').select('*').ilike('slug', decodedSlug.replace(/-/g, ' ')).limit(1)
              );
              if (topicResB?.data && topicResB.data.length > 0) {
                foundTopic = topicResB.data[0];
              }
            }

            if (foundTopic) {
              title = `${foundTopic.title} | StartupCrème Discussion`;
              description = foundTopic.content
                ? foundTopic.content.slice(0, 160) + (foundTopic.content.length > 160 ? '...' : '')
                : 'Join the community discussion on StartupCrème.';
              pageType = 'article';
              authorName = foundTopic.author_name || 'Community Member';
              publishedTime = foundTopic.created_at;
              modifiedTime = foundTopic.updated_at || foundTopic.created_at;
              section = 'Discussions';

              const sanitizedTopic = JSON.stringify(foundTopic).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
              ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_TOPIC__ = ${sanitizedTopic};</script>`;

              const topicJsonLd = {
                '@context': 'https://schema.org',
                '@type': 'DiscussionForumPosting',
                mainEntityOfPage: {
                  '@type': 'WebPage',
                  '@id': fullUrl
                },
                headline: foundTopic.title,
                articleBody: foundTopic.content,
                author: {
                  '@type': 'Person',
                  name: authorName
                },
                datePublished: publishedTime,
                publisher: {
                  '@type': 'Organization',
                  name: 'StartupCrème',
                  logo: {
                    '@type': 'ImageObject',
                    url: `${baseUrl}/logo.jpg`
                  }
                }
              };
              jsonLdScript = `<script type="application/ld+json">${JSON.stringify(topicJsonLd)}</script>`;
            }
          }
        } catch (dbErr) {
          console.warn('[SEO] Supabase query error for slug:', decodedSlug, dbErr);
        }
      }
    }
  }

  // Pre-fetch top posts if homepage / silo to speed up client-side render
  if (!ssrPayloadScript && (segments.length === 0 || segments.length === 1)) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      '';

    if (supabaseUrl && supabaseKey) {
      try {
        const scClient = createClient(supabaseUrl, supabaseKey, {
          db: { schema: 'startupcreme' },
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: posts } = await scClient
          .from('posts')
          .select('*')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(20);

        if (posts && posts.length > 0) {
          const sanitizedPosts = JSON.stringify(posts).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
          ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_POSTS__ = ${sanitizedPosts};</script>`;
        }
      } catch {
        // ignore
      }
    }
  }

  // Fallback organization schema for website pages
  if (!jsonLdScript) {
    const websiteJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'StartupCrème',
      url: baseUrl,
      description: DEFAULT_DESCRIPTION,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}/search?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    };
    jsonLdScript = `<script type="application/ld+json">${JSON.stringify(websiteJsonLd)}</script>`;
  }

  return {
    title,
    description,
    coverImage: ensureAbsoluteUrl(coverImage, baseUrl),
    canonicalUrl: fullUrl,
    pageType,
    authorName,
    publishedTime,
    modifiedTime,
    section,
    tags,
    ssrPayloadScript,
    jsonLdScript
  };
}

/**
 * Injects dynamic Open Graph, Twitter Cards, Schema.org, and SSR payload into raw HTML.
 */
export async function injectDynamicMetaTags(
  html: string,
  reqPath: string,
  host: string,
  protocol: string
): Promise<string> {
  const meta = await resolvePageMetadata(reqPath, host, protocol);

  const safeTitle = escapeHtml(meta.title);
  const safeDesc = escapeHtml(meta.description);
  const safeImage = escapeHtml(meta.coverImage);
  const safeUrl = escapeHtml(meta.canonicalUrl);
  const safeSite = 'StartupCrème';

  let articleMetaTags = '';
  if (meta.pageType === 'article') {
    if (meta.publishedTime) {
      articleMetaTags += `\n    <meta property="article:published_time" content="${escapeHtml(meta.publishedTime)}" />`;
    }
    if (meta.modifiedTime) {
      articleMetaTags += `\n    <meta property="article:modified_time" content="${escapeHtml(meta.modifiedTime)}" />`;
    }
    if (meta.section) {
      articleMetaTags += `\n    <meta property="article:section" content="${escapeHtml(meta.section)}" />`;
    }
    if (meta.authorName) {
      articleMetaTags += `\n    <meta property="article:author" content="${escapeHtml(meta.authorName)}" />`;
    }
    if (meta.tags && meta.tags.length > 0) {
      meta.tags.forEach(t => {
        articleMetaTags += `\n    <meta property="article:tag" content="${escapeHtml(t)}" />`;
      });
    }
  }

  const dynamicMetaBlock = `
    <!-- Primary SEO Metadata -->
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <link rel="canonical" href="${safeUrl}" />

    <!-- Open Graph / Facebook / WhatsApp / LinkedIn / iMessage / Telegram -->
    <meta property="og:type" content="${meta.pageType}" />
    <meta property="og:site_name" content="${safeSite}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:secure_url" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${safeUrl}" />${articleMetaTags}

    <!-- Twitter / X Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@startupcreme" />
    <meta name="twitter:creator" content="@startupcreme" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImage}" />

    <!-- Structured Data (JSON-LD) -->
    ${meta.jsonLdScript || ''}

    <!-- Pre-rendered Hydration Payload -->
    ${meta.ssrPayloadScript || ''}
  `;

  // Strip existing static title, canonical, and social meta tags to avoid duplication
  let updatedHtml = html.replace(/<title>.*?<\/title>/gis, '');
  updatedHtml = updatedHtml.replace(/<meta\s+[^>]*(?:og:|twitter:|description|article:)[^>]*>/gis, '');
  updatedHtml = updatedHtml.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gis, '');
  updatedHtml = updatedHtml.replace(/<script\s+id=["']__STARTUPCREME_SSR_DATA__["'].*?<\/script>/gis, '');

  if (updatedHtml.includes('</head>')) {
    return updatedHtml.replace('</head>', `${dynamicMetaBlock}\n  </head>`);
  }

  return `${dynamicMetaBlock}\n${updatedHtml}`;
}
