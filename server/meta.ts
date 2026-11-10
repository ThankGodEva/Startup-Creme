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
  ssrHtml?: string;
  updatedAt?: string;
}

const DEFAULT_TITLE = 'StartupCrème | Financial & Technology Intelligence';
const DEFAULT_DESCRIPTION = 'StartupCrème is the premier digital publication for Finance, Macro-economics, and Deep Technology.';
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630';

/**
 * Normalizes an image URL to an absolute URL beginning with https:// or http://
 */
export function ensureAbsoluteUrl(url: string | null | undefined, baseUrl: string, postIdentifier?: string): string {
  if (!url) return DEFAULT_IMAGE;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_IMAGE;

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    if (postIdentifier) {
      return `${baseUrl.replace(/\/+$/, '')}/api/posts/${encodeURIComponent(postIdentifier)}/cover.png`;
    }
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
 * Uploads a base64 data URL to Cloudflare R2 on demand and returns the public CDN URL.
 */
export async function uploadDataUrlToR2(dataUrl: string, slug: string): Promise<string | null> {
  try {
    const r2AccountId = (
      process.env.R2_ACCOUNT_ID ||
      process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
      process.env.CLOUDFLARE_ACCOUNT_ID ||
      process.env.CF_R2_ACCOUNT_ID ||
      process.env.VITE_R2_ACCOUNT_ID ||
      ''
    ).replace(/^https?:\/\//i, '').replace(/\.r2\.cloudflarestorage\.com.*$/i, '').trim();

    const r2AccessKey = (
      process.env.R2_ACCESS_KEY_ID ||
      process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
      process.env.CF_R2_ACCESS_KEY_ID ||
      process.env.R2_ACCESS_KEY ||
      process.env.VITE_R2_ACCESS_KEY_ID ||
      ''
    ).trim();

    const r2Secret = (
      process.env.R2_SECRET_ACCESS_KEY ||
      process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
      process.env.CF_R2_SECRET_ACCESS_KEY ||
      process.env.R2_SECRET_KEY ||
      process.env.VITE_R2_SECRET_ACCESS_KEY ||
      ''
    ).trim();

    const r2Bucket = (
      process.env.R2_BUCKET_NAME ||
      process.env.CLOUDFLARE_R2_BUCKET_NAME ||
      process.env.CF_R2_BUCKET_NAME ||
      process.env.VITE_R2_BUCKET_NAME ||
      'startupcreme'
    ).trim();

    const r2PublicDomain = (
      process.env.R2_PUBLIC_URL ||
      process.env.CLOUDFLARE_R2_PUBLIC_URL ||
      process.env.CF_R2_PUBLIC_URL ||
      process.env.VITE_R2_PUBLIC_URL ||
      'asset.startupcreme.com'
    ).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

    if (!r2AccountId || !r2AccessKey || !r2Secret) {
      return null;
    }

    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;

    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');

    let ext = 'jpg';
    let outputBuffer = buffer;
    let outputMime = 'image/jpeg';

    try {
      const sharp = (await import('sharp')).default;
      if (mimeType.includes('webp') || mimeType.includes('avif') || (!mimeType.includes('png') && !mimeType.includes('gif'))) {
        outputBuffer = await sharp(buffer)
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer();
        ext = 'jpg';
        outputMime = 'image/jpeg';
      } else if (mimeType.includes('png')) {
        ext = 'png';
        outputMime = 'image/png';
      }
    } catch (sharpErr) {
      console.warn('[Sharp] Image conversion fallback:', sharpErr);
    }

    const cleanSlug = (slug || 'article')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 50);
    const objectKey = `articles/${Date.now()}-${cleanSlug}.${ext}`;

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKey,
        secretAccessKey: r2Secret,
      },
    });

    await s3.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: objectKey,
      Body: outputBuffer,
      ContentType: outputMime,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    return `https://${r2PublicDomain}/${objectKey}`;
  } catch (err) {
    console.warn('[R2 Upload Helper] Failed to upload data URL to R2:', err);
    return null;
  }
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
 * Converts Tiptap JSON or Markdown/text into clean, semantic HTML markup
 * for server-side bot rendering, web crawlers, and AI agents.
 */
export function convertContentToSemanticHtml(content: any): string {
  if (!content) return '';

  if (typeof content === 'object' && Array.isArray(content.content)) {
    const renderInline = (node: any): string => {
      if (!node) return '';
      if (node.type === 'text') {
        let text = escapeHtml(node.text || '');
        if (node.marks && Array.isArray(node.marks)) {
          for (const mark of node.marks) {
            if (mark.type === 'bold') text = `<strong>${text}</strong>`;
            else if (mark.type === 'italic') text = `<em>${text}</em>`;
            else if (mark.type === 'code') text = `<code class="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono text-cyan-800">${text}</code>`;
            else if (mark.type === 'strike') text = `<del>${text}</del>`;
            else if (mark.type === 'link' && mark.attrs?.href) {
              const safeHref = escapeHtml(mark.attrs.href);
              text = `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="text-cyan-700 hover:underline">${text}</a>`;
            }
          }
        }
        return text;
      }
      return '';
    };

    const renderNode = (node: any): string => {
      if (!node) return '';

      const children = (node.content || []).map((c: any) => {
        if (c.type === 'text') return renderInline(c);
        return renderNode(c);
      }).join('');

      switch (node.type) {
        case 'heading': {
          const level = Math.min(Math.max(node.attrs?.level || 2, 1), 6);
          const sizeClasses = level === 1
            ? 'text-3xl font-extrabold mt-10 mb-4'
            : level === 2
            ? 'text-2xl font-bold mt-8 mb-3 pb-2 border-b border-slate-200'
            : 'text-xl font-bold mt-6 mb-2';
          return `<h${level} class="font-serif text-slate-900 ${sizeClasses}">${children}</h${level}>`;
        }
        case 'paragraph': {
          if (!children.trim()) return '';
          return `<p class="font-serif text-slate-800 text-lg leading-relaxed mb-5">${children}</p>`;
        }
        case 'blockquote':
          return `<blockquote class="border-l-4 border-cyan-600 pl-4 py-1 italic text-slate-700 my-6 font-serif text-lg bg-slate-50/50 rounded-r-lg">${children}</blockquote>`;
        case 'codeBlock': {
          const lang = escapeHtml(node.attrs?.language || '');
          return `<pre class="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto my-6 text-sm font-mono leading-normal"><code>${children}</code></pre>`;
        }
        case 'bulletList':
          return `<ul class="list-disc list-outside pl-6 my-4 space-y-2 text-slate-800 font-serif text-lg">${(node.content || []).map((li: any) => `<li class="leading-relaxed pl-1">${(li.content || []).map(renderNode).join('')}</li>`).join('')}</ul>`;
        case 'orderedList':
          return `<ol class="list-decimal list-outside pl-6 my-4 space-y-2 text-slate-800 font-serif text-lg">${(node.content || []).map((li: any) => `<li class="leading-relaxed pl-1">${(li.content || []).map(renderNode).join('')}</li>`).join('')}</ol>`;
        case 'horizontalRule':
          return '<hr class="my-8 border-slate-200" />';
        case 'image': {
          const src = escapeHtml(node.attrs?.src || '');
          const alt = escapeHtml(node.attrs?.alt || 'article illustration');
          return `<figure class="my-8 rounded-xl overflow-hidden aspect-[16/9] w-full bg-slate-100 border border-slate-200"><img src="${src}" alt="${alt}" loading="lazy" decoding="async" class="w-full h-full object-cover" /></figure>`;
        }
        case 'table': {
          const rows = (node.content || []).map((row: any) => {
            const cells = (row.content || []).map((cell: any) => {
              const isHeader = cell.type === 'tableHeader';
              const tag = isHeader ? 'th' : 'td';
              const cellContent = (cell.content || []).map(renderNode).join('');
              const cellClasses = isHeader
                ? 'p-3.5 text-left font-bold text-xs uppercase tracking-wider text-slate-900 bg-slate-100 border border-slate-200 font-sans'
                : 'p-3.5 text-sm sm:text-base text-slate-800 border border-slate-200 font-sans';
              return `<${tag} class="${cellClasses}">${cellContent}</${tag}>`;
            }).join('');
            return `<tr class="hover:bg-slate-50/50">${cells}</tr>`;
          }).join('');
          return `<div class="overflow-x-auto my-8 rounded-xl border border-slate-200 shadow-2xs"><table class="min-w-full divide-y divide-slate-200 border-collapse">${rows}</table></div>`;
        }
        default:
          return children;
      }
    };

    return content.content.map(renderNode).join('\n');
  }

  // Markdown fallback string parser
  if (typeof content === 'string') {
    const raw = content.trim();
    const lines = raw.split('\n');
    const htmlChunks: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' = 'ul';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (inList) {
          htmlChunks.push(`</${listType}>`);
          inList = false;
        }
        continue;
      }

      if (line.startsWith('# ')) {
        if (inList) { htmlChunks.push(`</${listType}>`); inList = false; }
        htmlChunks.push(`<h1 class="font-serif font-extrabold text-3xl text-slate-900 mt-10 mb-4">${escapeHtml(line.slice(2))}</h1>`);
      } else if (line.startsWith('## ')) {
        if (inList) { htmlChunks.push(`</${listType}>`); inList = false; }
        htmlChunks.push(`<h2 class="font-serif font-bold text-2xl text-slate-900 mt-8 mb-3 pb-2 border-b border-slate-200">${escapeHtml(line.slice(3))}</h2>`);
      } else if (line.startsWith('### ')) {
        if (inList) { htmlChunks.push(`</${listType}>`); inList = false; }
        htmlChunks.push(`<h3 class="font-serif font-bold text-xl text-slate-900 mt-6 mb-2">${escapeHtml(line.slice(4))}</h3>`);
      } else if (line.startsWith('> ')) {
        if (inList) { htmlChunks.push(`</${listType}>`); inList = false; }
        htmlChunks.push(`<blockquote class="border-l-4 border-cyan-600 pl-4 py-1 italic text-slate-700 my-6 font-serif text-lg bg-slate-50/50 rounded-r-lg">${escapeHtml(line.slice(2))}</blockquote>`);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList || listType !== 'ul') {
          if (inList) htmlChunks.push(`</${listType}>`);
          htmlChunks.push('<ul class="list-disc list-outside pl-6 my-4 space-y-2 text-slate-800 font-serif text-lg">');
          inList = true;
          listType = 'ul';
        }
        htmlChunks.push(`<li class="leading-relaxed pl-1">${escapeHtml(line.slice(2))}</li>`);
      } else if (/^\d+\.\s/.test(line)) {
        if (!inList || listType !== 'ol') {
          if (inList) htmlChunks.push(`</${listType}>`);
          htmlChunks.push('<ol class="list-decimal list-outside pl-6 my-4 space-y-2 text-slate-800 font-serif text-lg">');
          inList = true;
          listType = 'ol';
        }
        htmlChunks.push(`<li class="leading-relaxed pl-1">${escapeHtml(line.replace(/^\d+\.\s/, ''))}</li>`);
      } else {
        if (inList) { htmlChunks.push(`</${listType}>`); inList = false; }
        htmlChunks.push(`<p class="font-serif text-slate-800 text-lg leading-relaxed mb-5">${escapeHtml(line)}</p>`);
      }
    }
    if (inList) {
      htmlChunks.push(`</${listType}>`);
    }
    return htmlChunks.join('\n');
  }

  return `<p class="font-serif text-slate-800 text-lg leading-relaxed mb-5">${escapeHtml(String(content))}</p>`;
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
  let fullUrl = `${baseUrl}${cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath}`;

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
  let ssrHtml: string | undefined;

  const excluded = [
    'finance',
    'tech',
    'founders-mindset',
    'discussion',
    'discussions',
    'calculators',
    'directory',
    'markets',
    'rates',
    'careers',
    'events',
    'about',
    'about-us',
    'admin',
    'sitemap.xml',
    'robots.txt',
    'llms.txt',
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

    // 1. Static Silo Category Sections & Expansion Modules
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
    } else if (lowerSlug === 'founders-mindset') {
      title = 'Founders Mindset, Leadership & Psychology | StartupCrème';
      description = 'Strategic founder psychology, mental resilience, executive leadership frameworks, and high-performance decision-making for startup builders.';
      coverImage = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=1200&h=630';
      section = 'Founders Mindset';
    } else if (lowerSlug === 'calculators') {
      title = 'Interactive Financial & Tech Calculators | StartupCrème';
      description = 'Compound interest calculator, SaaS runway & burn rate calculator, cap table dilution simulator across Seed and Series A, and cloud infrastructure cost estimator.';
      section = 'Calculators';
    } else if (lowerSlug === 'directory') {
      title = 'The Startup & FinTech Directory | StartupCrème';
      description = 'Curated directory of early-stage and growth startups across FinTech, AI, Cloud Infrastructure, and EdTech.';
      section = 'Directory';
    } else if (
      (lowerSlug === 'rates' || lowerSlug === 'markets' || lowerSlug === 'inflation' || lowerSlug === 'inflation-rates' || cleanPath.includes('/markets/rates') || cleanPath.includes('/markets/inflation') || cleanPath.includes('/markets')) &&
      !['false', '0', 'no', 'off'].includes(
        String(process.env.ENABLE_MARKETS ?? process.env.VITE_ENABLE_MARKETS ?? 'true')
          .trim()
          .toLowerCase()
          .replace(/^["']|["']$/g, '')
      )
    ) {
      title = 'Macro Central Bank Interest Rates & 10-Year Inflation Rates Tracker | StartupCrème';
      description = 'Live institutional tracking of sovereign central bank policy rates and 10-year historical inflation rate trajectories (2017–2026), monetary easing cycles, and real yield curves across global economies.';
      section = 'Markets';
      coverImage = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200&h=630';

      const marketsJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'Dataset',
            '@id': `${baseUrl}/markets/rates#inflation-dataset`,
            name: '10-Year Sovereign Inflation Rate Trajectory (2017–2026)',
            description: 'Annual headline consumer price index (CPI YoY %) historical dataset covering 8 benchmark economies from 2017 to 2026.',
            url: `${baseUrl}/markets/rates#inflation-rates`,
            temporalCoverage: '2017/2026',
            spatialCoverage: [
              'United States',
              'Eurozone',
              'Nigeria',
              'United Kingdom',
              'Japan',
              'South Africa',
              'Kenya',
              'India',
            ],
            variableMeasured: 'Annual Headline Consumer Price Index Inflation (YoY %)',
            creator: {
              '@type': 'Organization',
              name: 'StartupCrème Financial & Technology Intelligence',
              url: baseUrl,
            },
          },
          {
            '@type': 'FinancialService',
            '@id': `${baseUrl}/markets/rates#interest-rates`,
            name: 'Global Central Bank Interest Rates Tracker',
            description: 'Real-time benchmark monetary policy rates and decision dates from US Fed, ECB, CBN, BoE, BoJ, SARB, CBK, and RBI.',
            url: `${baseUrl}/markets/rates#central-bank-rates`,
            provider: {
              '@type': 'Organization',
              name: 'StartupCrème',
              url: baseUrl,
            },
          },
        ],
      };
      jsonLdScript = `<script type="application/ld+json">${JSON.stringify(marketsJsonLd)}</script>`;
    } else if (lowerSlug === 'careers') {
      title = 'Remote Startup Job & Fractional Talent Board | StartupCrème';
      description = 'Curated remote software engineering, FinOps, financial modeling, and fractional CTO/CFO leadership roles.';
      section = 'Careers';
    } else if (lowerSlug === 'events' && segments.length === 1) {
      title = 'Grants, Accelerators & Startup Events | StartupCrème';
      description = 'Curated non-dilutive grants, institutional venture accelerators, founder fellowships, and tech competitions for software engineers, fintech builders, and tech entrepreneurs.';
      section = 'Events';
      coverImage = 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&q=80&w=1200&h=630';
    } else if (segments[0] === 'events' && segments.length >= 2) {
      // Unique shareable event & grant landing page (/events/:slug)
      const eventSlug = decodeURIComponent(segments[1]).trim().toLowerCase();
      title = 'Grants, Accelerators & Startup Events | StartupCrème';
      description = 'Verified startup opportunity and non-dilutive funding engine.';
      section = 'Events';
      coverImage = 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&q=80&w=1200&h=630';

      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        '';

      if (supabaseUrl && supabaseKey) {
        try {
          const client = createClient(supabaseUrl, supabaseKey, {
            db: { schema: 'startupcreme' },
            auth: { persistSession: false, autoRefreshToken: false }
          });
          const { data: eventData } = await client
            .from('events')
            .select('*, linked_post:posts(*)')
            .eq('slug', eventSlug)
            .maybeSingle();

          if (eventData) {
            title = `${eventData.title} | Grants & Events | StartupCrème`;
            description = (eventData.description || '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 180) || description;
            fullUrl = `${baseUrl}/events/${eventData.slug}`;

            // Banner resolution
            if (eventData.banner_image && typeof eventData.banner_image === 'string' && eventData.banner_image.trim()) {
              coverImage = eventData.banner_image.trim();
            } else if (eventData.linked_post?.cover_image) {
              coverImage = eventData.linked_post.cover_image;
            } else {
              const oppType = String(eventData.opportunity_type || '').toLowerCase();
              if (oppType === 'grant') {
                coverImage = 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&q=80&w=1200&h=630';
              } else if (oppType === 'accelerator' || oppType === 'incubator') {
                coverImage = 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&q=80&w=1200&h=630';
              } else if (oppType === 'fellowship') {
                coverImage = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=1200&h=630';
              } else if (oppType === 'pitch_competition' || oppType === 'hackathon') {
                coverImage = 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&q=80&w=1200&h=630';
              } else if (oppType === 'conference') {
                coverImage = 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=1200&h=630';
              }
            }

            const eventJsonLd = {
              '@context': 'https://schema.org',
              '@type': 'Event',
              name: eventData.title,
              description: eventData.description,
              image: [coverImage],
              url: fullUrl,
              eventAttendanceMode: eventData.location?.toLowerCase().includes('remote') || eventData.location?.toLowerCase().includes('global')
                ? 'https://schema.org/OnlineEventAttendanceMode'
                : 'https://schema.org/OfflineEventAttendanceMode',
              eventStatus: 'https://schema.org/EventScheduled',
              endDate: eventData.deadline_date,
              location: {
                '@type': 'Place',
                name: eventData.location || 'Global (Remote)',
              },
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                url: eventData.application_url,
                availability: 'https://schema.org/InStock',
              },
              organizer: {
                '@type': 'Organization',
                name: 'StartupCrème Opportunity Engine',
                url: baseUrl,
              },
            };
            jsonLdScript = `<script type="application/ld+json">${JSON.stringify(eventJsonLd)}</script>`;
          }
        } catch (evErr) {
          console.warn('[Meta] Error resolving event metadata:', evErr);
        }
      }
    } else if (lowerSlug === 'about' || lowerSlug === 'about-us') {
      title = 'About StartupCrème | Institutional Finance, Tech & AI Intelligence';
      description = 'StartupCrème is a global guide dedicated to helping founders, software architects, and finance professionals build, fund, and scale companies in the age of AI. Built and operated by Habinsoft Technologies Limited and led by Chibueze ThankGod.';
      section = 'About';
      const aboutJsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': ['NewsMediaOrganization', 'Organization'],
            '@id': `${baseUrl}/#organization`,
            name: 'StartupCrème',
            url: baseUrl,
            logo: {
              '@type': 'ImageObject',
              url: `${baseUrl}/logo.jpg`
            },
            description,
            founder: { '@id': `${baseUrl}/#founder` },
            parentOrganization: {
              '@type': 'Organization',
              '@id': 'https://habinsoft.com/#organization',
              name: 'Habinsoft Technologies Limited',
              url: 'https://habinsoft.com',
              founder: { '@id': `${baseUrl}/#founder` }
            }
          },
          {
            '@type': 'Person',
            '@id': `${baseUrl}/#founder`,
            name: 'Chibueze ThankGod',
            jobTitle: 'Founder & Chief Executive Officer',
            description: 'Software Engineer, Full-Stack Developer, and Tech Entrepreneur leading Habinsoft Technologies Limited and StartupCrème.',
            url: `${baseUrl}/about#leadership`,
            worksFor: [
              { '@id': 'https://habinsoft.com/#organization' },
              { '@id': `${baseUrl}/#organization` }
            ]
          }
        ]
      };
      jsonLdScript = `<script type="application/ld+json">${JSON.stringify(aboutJsonLd)}</script>`;
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
            client.from('posts').select('*').ilike('slug', decodedSlug).eq('status', 'published').limit(1)
          );
          if (resA?.data && resA.data.length > 0) {
            foundPost = resA.data[0];
          }

          // Strategy B: If UUID, check by id
          if (!foundPost && isUuid) {
            const resUuid = await executeQuery((client) =>
              client.from('posts').select('*').eq('id', decodedSlug).eq('status', 'published').limit(1)
            );
            if (resUuid?.data && resUuid.data.length > 0) {
              foundPost = resUuid.data[0];
            }
          }

          // Strategy C: Hyphen to space substitution (handles titles saved with spaces in slug)
          if (!foundPost && decodedSlug.includes('-')) {
            const withSpaces = decodedSlug.replace(/-/g, ' ');
            const resSpaces = await executeQuery((client) =>
              client.from('posts').select('*').ilike('slug', withSpaces).eq('status', 'published').limit(1)
            );
            if (resSpaces?.data && resSpaces.data.length > 0) {
              foundPost = resSpaces.data[0];
            }
          }

          // Strategy D: Space to hyphen substitution
          if (!foundPost && decodedSlug.includes(' ')) {
            const withHyphens = decodedSlug.replace(/\s+/g, '-');
            const resHyphens = await executeQuery((client) =>
              client.from('posts').select('*').ilike('slug', withHyphens).eq('status', 'published').limit(1)
            );
            if (resHyphens?.data && resHyphens.data.length > 0) {
              foundPost = resHyphens.data[0];
            }
          }

          // Strategy E: Resilient substring matching on longer slugs
          if (!foundPost && decodedSlug.length > 12) {
            const prefix = decodedSlug.slice(0, 30);
            const resPartial = await executeQuery((client) =>
              client.from('posts').select('*').ilike('slug', `%${prefix}%`).eq('status', 'published').limit(1)
            );
            if (resPartial?.data && resPartial.data.length > 0) {
              foundPost = resPartial.data[0];
            }
          }

          // Security: strictly prevent draft posts from being served or hydrated via public URLs
          if (foundPost && foundPost.status !== 'published') {
            foundPost = null;
          }

          if (foundPost) {
            title = `${foundPost.title} | StartupCrème`;
            description = resolveArticleDescription(foundPost);

            // Handle base64 data URLs: auto-migrate to Cloudflare R2 on demand
            if (foundPost.cover_image && typeof foundPost.cover_image === 'string' && foundPost.cover_image.startsWith('data:image/')) {
              try {
                const r2Url = await uploadDataUrlToR2(foundPost.cover_image, foundPost.slug || foundPost.id);
                if (r2Url) {
                  foundPost.cover_image = r2Url;
                  // Persist asynchronously in Supabase
                  Promise.resolve().then(async () => {
                    try {
                      await scClient.from('posts').update({ cover_image: r2Url }).eq('id', foundPost.id);
                    } catch (dbErr) {
                      console.warn('[DB Sync] Failed to sync R2 URL to Supabase:', dbErr);
                    }
                  });
                }
              } catch (migErr) {
                console.warn('[Cover Auto-Migrate] Error uploading data URL to R2:', migErr);
              }
            }

            coverImage = ensureAbsoluteUrl(foundPost.cover_image, baseUrl, foundPost.slug || foundPost.id);
            pageType = 'article';
            authorName = foundPost.author_name || 'Startup Crème Editorial';
            publishedTime = foundPost.created_at || new Date().toISOString();
            modifiedTime = foundPost.updated_at || foundPost.created_at || new Date().toISOString();
            section = foundPost.vertical === 'tech' ? 'Technology' : foundPost.vertical === 'founders-mindset' ? 'Founders Mindset' : 'Finance';
            tags = Array.isArray(foundPost.tags) ? foundPost.tags : [];

            const sanitizedPost = JSON.stringify(foundPost).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
            ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_POST__ = ${sanitizedPost};</script>`;

            // Pre-rendered Semantic HTML for Search Bots & AI Crawlers
            const bodyHtml = convertContentToSemanticHtml(foundPost.content);
            const articleCover = ensureAbsoluteUrl(coverImage, baseUrl, foundPost.id || foundPost.slug);

            ssrHtml = `
<div class="ssr-article-wrapper max-w-4xl mx-auto px-4 py-10 font-sans">
  <nav class="ssr-breadcrumbs mb-6 text-xs font-mono text-slate-500 flex items-center gap-2">
    <a href="${baseUrl}/" class="text-slate-600 hover:text-slate-900">Home</a>
    <span>/</span>
    <a href="${baseUrl}/${foundPost.locale || 'en-us'}/${foundPost.vertical || 'tech'}" class="text-slate-600 hover:text-slate-900 uppercase">${escapeHtml(foundPost.vertical || 'Tech')}</a>
    <span>/</span>
    <span class="text-slate-900 font-medium truncate max-w-xs">${escapeHtml(foundPost.title)}</span>
  </nav>

  <header class="ssr-header mb-8">
    <div class="flex items-center gap-2 mb-4">
      <span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase bg-slate-100 border border-slate-300 text-slate-800">
        ${escapeHtml(foundPost.vertical || 'Intelligence')}
      </span>
      ${foundPost.dual_silo ? '<span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase bg-purple-100 border border-purple-300 text-purple-900">Dual Silo</span>' : ''}
    </div>
    <h1 class="font-serif text-3xl sm:text-5xl font-extrabold text-slate-900 mb-4 leading-tight">
      ${escapeHtml(foundPost.title)}
    </h1>
    <p class="text-lg text-slate-600 leading-relaxed mb-6 font-sans">
      ${escapeHtml(foundPost.excerpt || '')}
    </p>
    <div class="flex flex-wrap items-center justify-between gap-4 border-t border-b border-slate-200 py-4 text-xs font-sans text-slate-600">
      <div class="flex items-center gap-3">
        <span class="font-bold text-slate-900">${escapeHtml(foundPost.author_name || 'Startup Crème Editorial')}</span>
        <span>•</span>
        <span>${escapeHtml(foundPost.author_role || 'Principal Editor')}</span>
      </div>
      <div class="flex items-center gap-3">
        <span>${foundPost.reading_time_minutes || 5} min read</span>
        <span>•</span>
        <time datetime="${foundPost.created_at}">${new Date(foundPost.created_at).toLocaleDateString()}</time>
      </div>
    </div>
  </header>

  ${foundPost.cover_image ? `
  <figure class="ssr-cover mb-10 rounded-2xl overflow-hidden aspect-[16/9] w-full bg-slate-100 border border-slate-200 shadow-sm">
    <img src="${escapeHtml(articleCover)}" alt="${escapeHtml(foundPost.title)}" width="1200" height="675" fetchpriority="high" loading="eager" decoding="async" class="w-full h-full object-cover" />
  </figure>` : ''}

  <section class="ssr-article-body text-slate-800 leading-relaxed font-serif text-lg space-y-6">
    ${bodyHtml}
  </section>
</div>
`;

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

              ssrHtml = `
<div class="ssr-topic-wrapper max-w-4xl mx-auto px-4 py-10 font-sans">
  <nav class="ssr-breadcrumbs mb-6 text-xs font-mono text-slate-500 flex items-center gap-2">
    <a href="${baseUrl}/" class="text-slate-600 hover:text-slate-900">Home</a>
    <span>/</span>
    <a href="${baseUrl}/discussion" class="text-slate-600 hover:text-slate-900">Discussion Forum</a>
    <span>/</span>
    <span class="text-slate-900 font-medium truncate max-w-xs">${escapeHtml(foundTopic.title)}</span>
  </nav>
  <header class="ssr-header mb-8">
    <span class="px-2.5 py-1 rounded-full text-xs font-mono font-bold uppercase bg-cyan-100 border border-cyan-300 text-cyan-900">
      ${escapeHtml(foundTopic.category || 'General')}
    </span>
    <h1 class="font-serif text-3xl font-extrabold text-slate-900 mt-4 mb-3">
      ${escapeHtml(foundTopic.title)}
    </h1>
    <div class="text-xs text-slate-500 mb-6 font-mono">
      By ${escapeHtml(foundTopic.author_name || 'Community Member')} • ${new Date(foundTopic.created_at).toLocaleDateString()}
    </div>
  </header>
  <div class="font-serif text-lg text-slate-800 leading-relaxed space-y-4">
    <p>${escapeHtml(foundTopic.content || '')}</p>
  </div>
</div>
`;

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
  if (!ssrPayloadScript && (segments.length <= 2)) {
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

  // Provide SSR HTML shells for primary hub routes & homepage
  if (!ssrHtml) {
    if (segments.length === 0 || (segments.length === 1 && (segments[0] === 'en-us' || segments[0] === 'en-gb' || segments[0] === 'de-de' || segments[0] === 'fr-fr' || segments[0] === 'es-es' || segments[0] === 'zh-cn' || segments[0] === 'ja-jp'))) {
      ssrHtml = `
<div class="ssr-home-wrapper font-sans bg-slate-50 text-slate-800">
  <div class="relative overflow-hidden bg-slate-50 border-b border-slate-200 text-slate-900 py-12 px-4">
    <div class="max-w-7xl mx-auto text-center max-w-3xl">
      <h1 class="font-serif text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4 leading-tight">
        Where High-Value Capital Meets <br class="hidden sm:inline" />
        <span class="text-teal-700 block sm:inline mt-1 sm:mt-0">Deep Technology Engineering</span>
      </h1>
      <p class="text-slate-600 text-base sm:text-lg leading-relaxed">
        StartupCrème provides rigorous, non-sponsored editorial intelligence and institutional analysis for founders, venture capital partners, and software architects.
      </p>
    </div>
  </div>
</div>
`;
    } else if (segments[0] === 'events') {
      ssrHtml = `
<div class="ssr-events-wrapper max-w-7xl mx-auto px-4 py-12 font-sans">
  <header class="mb-10 text-center max-w-3xl mx-auto">
    <span class="inline-block px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-mono font-bold mb-3">Global Opportunity Engine</span>
    <h1 class="font-serif text-3xl sm:text-5xl font-extrabold text-slate-900 mb-4">Non-Dilutive Grants, Accelerators & Fellowships</h1>
    <p class="text-slate-600 text-lg leading-relaxed">Verified institutional funding pipelines, pitch competitions, and developer hackathons for high-growth tech founders.</p>
  </header>
</div>
`;
    } else if (segments[0] === 'markets') {
      ssrHtml = `
<div class="ssr-markets-wrapper max-w-7xl mx-auto px-4 py-12 font-sans">
  <header class="mb-10 text-center max-w-3xl mx-auto">
    <span class="inline-block px-3 py-1 rounded-full bg-cyan-100 border border-cyan-300 text-cyan-900 text-xs font-mono font-bold mb-3">Macro Rates & Cloud Benchmark</span>
    <h1 class="font-serif text-3xl sm:text-5xl font-extrabold text-slate-900 mb-4">Central Bank Policy & Cloud Pricing Intelligence</h1>
    <p class="text-slate-600 text-lg leading-relaxed">Authoritative rate tracking for the US Federal Reserve, ECB, Bank of England, and Bank of Japan, alongside unit compute costs for AWS, GCP, Cloudflare, and Supabase.</p>
  </header>
</div>
`;
    } else if (segments[0] === 'directory') {
      ssrHtml = `
<div class="ssr-directory-wrapper max-w-7xl mx-auto px-4 py-12 font-sans">
  <header class="mb-10 text-center max-w-3xl mx-auto">
    <span class="inline-block px-3 py-1 rounded-full bg-purple-100 border border-purple-300 text-purple-900 text-xs font-mono font-bold mb-3">Scaleup Directory</span>
    <h1 class="font-serif text-3xl sm:text-5xl font-extrabold text-slate-900 mb-4">Verified Technology & Fintech Companies</h1>
    <p class="text-slate-600 text-lg leading-relaxed">Discover high-growth startups, funding histories, and active architectures across global ecosystems.</p>
  </header>
</div>
`;
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
    jsonLdScript,
    ssrHtml,
    updatedAt: modifiedTime || publishedTime
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

  let imageMime = 'image/jpeg';
  if (meta.coverImage.toLowerCase().endsWith('.png')) imageMime = 'image/png';
  else if (meta.coverImage.toLowerCase().endsWith('.webp')) imageMime = 'image/webp';
  else if (meta.coverImage.toLowerCase().endsWith('.gif')) imageMime = 'image/gif';

  const dynamicMetaBlock = `
    <!-- Primary SEO Metadata -->
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <link rel="canonical" href="${safeUrl}" />
    <link rel="image_src" href="${safeImage}" />

    <!-- Open Graph / Facebook / WhatsApp / LinkedIn / iMessage / Telegram -->
    <meta property="og:type" content="${meta.pageType}" />
    <meta property="og:site_name" content="${safeSite}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:secure_url" content="${safeImage}" />
    <meta property="og:image:type" content="${imageMime}" />
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
    updatedHtml = updatedHtml.replace('</head>', `${dynamicMetaBlock}\n  </head>`);
  } else {
    updatedHtml = `${dynamicMetaBlock}\n${updatedHtml}`;
  }

  // Inject Pre-rendered Semantic HTML directly into <div id="root">
  if (meta.ssrHtml) {
    updatedHtml = updatedHtml.replace(
      /<div id=["']root["']>\s*<\/div>/gis,
      `<div id="root">${meta.ssrHtml}</div>`
    );
  }

  return updatedHtml;
}
