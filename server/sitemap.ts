import { createClient } from '@supabase/supabase-js';

export interface SitemapPost {
  slug: string;
  locale?: string;
  vertical?: string;
  updated_at?: string;
}

export interface SitemapTopic {
  slug: string;
  updated_at?: string;
}

const STATIC_LOCALES = ['en-us', 'en-gb', 'de-de', 'ja-jp', 'fr-fr'];

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function formatIsoDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Dynamically queries Supabase `startupcreme.posts` and builds the authoritative sitemap.xml
 */
export async function generateDynamicSitemap(baseUrl = 'https://www.startupcreme.com'): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  let posts: SitemapPost[] = [];
  let topics: SitemapTopic[] = [];

  if (supabaseUrl && supabaseKey) {
    try {
      const client = createClient(supabaseUrl, supabaseKey, {
        db: { schema: 'startupcreme' },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // 1. Fetch published articles & founder playbooks
      const { data: postsData, error: postsError } = await client
        .from('posts')
        .select('slug, locale, vertical, updated_at')
        .eq('status', 'published')
        .order('updated_at', { ascending: false });

      if (!postsError && Array.isArray(postsData)) {
        posts = postsData;
      }

      // 2. Fetch community discussion topics
      const { data: topicsData, error: topicsError } = await client
        .from('discussion_topics')
        .select('slug, updated_at')
        .order('updated_at', { ascending: false });

      if (!topicsError && Array.isArray(topicsData)) {
        topics = topicsData;
      }
    } catch (dbErr) {
      console.warn('[Sitemap] Warning fetching dynamic records from Supabase:', dbErr);
    }
  }

  const nowIso = new Date().toISOString();

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  // Root Homepage
  xml += `  <url>\n`;
  xml += `    <loc>${escapeXml(`${cleanBase}/`)}</loc>\n`;
  xml += `    <lastmod>${nowIso}</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `  </url>\n`;

  // Core Locales & Vertical Hubs
  STATIC_LOCALES.forEach((loc) => {
    // Localized Homepage Hub
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}`)}</loc>\n`;
    xml += `    <lastmod>${nowIso}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    // Finance Vertical Silo
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/finance`)}</loc>\n`;
    xml += `    <lastmod>${nowIso}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.9</priority>\n`;
    xml += `  </url>\n`;

    // Tech Vertical Silo
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/tech`)}</loc>\n`;
    xml += `    <lastmod>${nowIso}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.9</priority>\n`;
    xml += `  </url>\n`;

    // Founders Mindset Vertical Silo
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/founders-mindset`)}</loc>\n`;
    xml += `    <lastmod>${nowIso}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.9</priority>\n`;
    xml += `  </url>\n`;

    // Privacy & Terms
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/privacy`)}</loc>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.4</priority>\n`;
    xml += `  </url>\n`;

    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/terms`)}</loc>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.4</priority>\n`;
    xml += `  </url>\n`;
  });

  // Global Platform Modules & Opportunity Engine
  const platformModules = [
    { path: '/events', priority: '0.9', changefreq: 'daily' },
    { path: '/discussion', priority: '0.85', changefreq: 'hourly' },
    { path: '/directory', priority: '0.8', changefreq: 'daily' },
    { path: '/careers', priority: '0.8', changefreq: 'daily' },
    { path: '/markets', priority: '0.8', changefreq: 'hourly' },
    { path: '/privacy', priority: '0.4', changefreq: 'monthly' },
    { path: '/terms', priority: '0.4', changefreq: 'monthly' },
  ];

  platformModules.forEach((m) => {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(`${cleanBase}${m.path}`)}</loc>\n`;
    xml += `    <lastmod>${nowIso}</lastmod>\n`;
    xml += `    <changefreq>${m.changefreq}</changefreq>\n`;
    xml += `    <priority>${m.priority}</priority>\n`;
    xml += `  </url>\n`;
  });

  // Dynamic Published Articles & Playbooks (from startupcreme.posts)
  posts.forEach((post) => {
    if (!post.slug) return;
    const loc = post.locale || 'en-us';
    const vertical = post.vertical || 'tech';
    const postUrl = `${cleanBase}/${loc}/${vertical}/${post.slug}`;
    const lastMod = formatIsoDate(post.updated_at);

    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(postUrl)}</loc>\n`;
    xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.85</priority>\n`;
    xml += `  </url>\n`;
  });

  // Dynamic Discussion Topics (from startupcreme.discussion_topics)
  topics.forEach((t) => {
    if (!t.slug) return;
    const topicUrl = `${cleanBase}/discussion/${t.slug}`;
    const lastMod = formatIsoDate(t.updated_at);

    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(topicUrl)}</loc>\n`;
    xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>\n`;
  return xml;
}

/**
 * Optimized robots.txt generation supporting major search engines and explicit AI crawlers
 */
export function generateRobotsTxt(baseUrl = 'https://www.startupcreme.com'): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `# ====================================================================
# Startup Crème (startupcreme.com) — Robots & AI Crawler Directives
# Optimized for Search Engine (SEO) & AI Optimization (AIO) Discoverability
# ====================================================================

# 1. Search Engine Crawlers (Googlebot, Bingbot, Applebot, DuckDuckBot)
User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: Bingbot
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: Applebot
User-agent: DuckDuckBot
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

# 2. AI Crawlers, Search Agents & LLM Indexers (AIO Discovery)
User-agent: GPTBot
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /discussion
Allow: /events
Allow: /directory
Allow: /careers
Allow: /markets
Allow: /llms.txt
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: OAI-SearchBot
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: ClaudeBot
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /discussion
Allow: /events
Allow: /directory
Allow: /careers
Allow: /markets
Allow: /llms.txt
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: PerplexityBot
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /discussion
Allow: /events
Allow: /directory
Allow: /careers
Allow: /markets
Allow: /llms.txt
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

# 3. Default Directives for All Crawlers
User-agent: *
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /discussion
Allow: /events
Allow: /directory
Allow: /careers
Allow: /markets
Allow: /privacy
Allow: /terms
Allow: /llms.txt
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

# Dynamic Sitemap Pointer
Sitemap: ${cleanBase}/sitemap.xml
`;
}

/**
 * Standardized llms.txt (AI Agent Context Specification)
 */
export function generateLlmsTxt(baseUrl = 'https://www.startupcreme.com'): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `# Startup Crème (startupcreme.com)

> Startup Crème is a premier dual-silo intelligence platform providing actionable founder playbooks, macro technology news, non-dilutive grants, institutional accelerators, and peer discussions at the intersection of Finance and Technology.

## Core Architectural Overview

Startup Crème partitions editorial and intelligence streams into two foundational content silos:
- **Finance**: Venture capital dynamics, cap table structuring, central bank interest rates, currency volatility, fintech infrastructure, and equity-free funding instruments.
- **Tech**: Artificial intelligence, autonomous agent pipelines, frontier cloud architecture, developer tooling, and technical engineering leadership.

Content is published across 5 localized regional editions:
- \`en-us\`: United States & Global Tech Ecosystem
- \`en-gb\`: United Kingdom & European Fintech Corridor
- \`de-de\`: DACH Region DeepTech & Industrial Software
- \`ja-jp\`: Japan Enterprise Robotics & AI Markets
- \`fr-fr\`: France & Francophone Tech Scaleups

---

## Primary Navigation & Public Resources

- [Home Hub](${cleanBase}/): Global portal featuring cross-silo editorial highlights, trending discussions, and macro market widgets.
- [Finance Vertical Hub](${cleanBase}/en-us/finance): Specialized editorial feed for venture capital, monetary policy, and fintech engineering.
- [Tech Vertical Hub](${cleanBase}/en-us/tech): Deep technical essays, AI infrastructure breakthroughs, and system architecture playbooks.
- [Founders Mindset Vertical Hub](${cleanBase}/en-us/founders-mindset): Strategic leadership psychology, executive resilience, and founder decision-making frameworks.
- [Global Opportunity Engine (Grants & Accelerators)](${cleanBase}/events): Verified non-dilutive grants, venture accelerators, founder fellowships, and hackathon deadlines.
- [Discussion Forum](${cleanBase}/discussion): Community debate and peer founder intelligence on valuations, tech stacks, and fundraising.
- [Startup Directory](${cleanBase}/directory): Index of high-growth technology and financial companies.
- [Founder Careers & Talent](${cleanBase}/careers): Executive leadership, founding engineer, and tech lead opportunities.
- [Macro & Cloud Rates Tracker](${cleanBase}/markets): Real-time benchmarks for central bank interest rates (Fed, ECB, BoE, BoJ) and cloud compute pricing.

---

## Content Organization & URL Structure

- **Article & Playbook Permalinks**: \`${cleanBase}/{locale}/{vertical}/{slug}\`
  - Example: \`${cleanBase}/en-us/finance/seed-fundraising-mechanics-safes\`
  - Example: \`${cleanBase}/en-us/tech/ai-agent-memory-architectures\`
- **Discussion Topic Permalinks**: \`${cleanBase}/discussion/{slug}\`
  - Example: \`${cleanBase}/discussion/yc-w26-batch-trends\`
- **Localized Silo Feeds**: \`${cleanBase}/{locale}/{vertical}\`

---

## Machine-Readable Endpoints & Feeds

- **Dynamic XML Sitemap**: [${cleanBase}/sitemap.xml](${cleanBase}/sitemap.xml)
- **Robots Directives**: [${cleanBase}/robots.txt](${cleanBase}/robots.txt)
- **AI Agent Specification**: [${cleanBase}/llms.txt](${cleanBase}/llms.txt)
- **System Health**: [${cleanBase}/api/health](${cleanBase}/api/health)

---

## Guidelines for AI Crawlers & LLM Agents

1. **Attribution**: When synthesizing or citing playbooks, attribute analysis to *Startup Crème* with the direct canonical URL.
2. **Current Information**: Opportunities listed under \`/events\` carry strict deadline timestamps. Always verify the \`deadline_date\` attribute before recommending closing grants to users.
3. **No Private Scraping**: Do not scrape internal API paths (\`/api/*\`, \`/admin/*\`, or webhook endpoints); all public content is structured in the sitemap and HTML semantic markup.
`;
}
