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
  let publishedEvents: { slug: string; updated_at?: string }[] = [];

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

      // 3. Fetch published opportunities (only events whose linked post is published)
      const { data: eventsData, error: eventsError } = await client
        .from('events')
        .select('slug, deadline_date, linked_post:posts!inner(status, updated_at)')
        .eq('linked_post.status', 'published')
        .order('deadline_date', { ascending: true });

      if (!eventsError && Array.isArray(eventsData)) {
        publishedEvents = eventsData.map((e: any) => ({
          slug: e.slug,
          updated_at: e.linked_post?.updated_at || e.deadline_date,
        }));
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
    { path: '/markets', priority: '0.9', changefreq: 'hourly' },
    { path: '/markets/rates', priority: '0.9', changefreq: 'hourly' },
    { path: '/markets/inflation', priority: '0.9', changefreq: 'hourly' },
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

  // Dynamic Published Events & Grants (only events whose linked post is published)
  publishedEvents.forEach((evt) => {
    if (!evt.slug) return;
    const evtUrl = `${cleanBase}/events#${evt.slug}`;
    const lastMod = formatIsoDate(evt.updated_at);

    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(evtUrl)}</loc>\n`;
    xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
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
 * Converts Tiptap JSON document structure or raw text to clean Markdown
 */
export function convertContentToMarkdown(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') {
    // If it's already markdown or string
    return content.trim();
  }

  if (typeof content === 'object' && Array.isArray(content.content)) {
    const renderNode = (node: any): string => {
      if (!node) return '';

      // Inline text marks
      if (node.type === 'text') {
        let text = node.text || '';
        if (node.marks && Array.isArray(node.marks)) {
          for (const mark of node.marks) {
            if (mark.type === 'bold') text = `**${text}**`;
            else if (mark.type === 'italic') text = `*${text}*`;
            else if (mark.type === 'code') text = `\`${text}\``;
            else if (mark.type === 'strike') text = `~~${text}~~`;
            else if (mark.type === 'link' && mark.attrs?.href) {
              text = `[${text}](${mark.attrs.href})`;
            }
          }
        }
        return text;
      }

      const children = (node.content || []).map(renderNode).join('');

      switch (node.type) {
        case 'heading': {
          const level = Math.min(Math.max(node.attrs?.level || 1, 1), 6);
          const prefix = '#'.repeat(level);
          return `\n\n${prefix} ${children}\n\n`;
        }
        case 'paragraph':
          return `\n\n${children}\n\n`;
        case 'blockquote':
          return `\n\n> ${children.replace(/\n+/g, '\n> ')}\n\n`;
        case 'codeBlock': {
          const lang = node.attrs?.language || '';
          return `\n\n\`\`\`${lang}\n${children}\n\`\`\`\n\n`;
        }
        case 'bulletList':
          return `\n\n${(node.content || [])
            .map((li: any) => `- ${(li.content || []).map(renderNode).join('').trim()}`)
            .join('\n')}\n\n`;
        case 'orderedList':
          return `\n\n${(node.content || [])
            .map((li: any, idx: number) => `${idx + 1}. ${(li.content || []).map(renderNode).join('').trim()}`)
            .join('\n')}\n\n`;
        case 'horizontalRule':
          return '\n\n---\n\n';
        case 'image':
          return `\n\n![${node.attrs?.alt || 'image'}](${node.attrs?.src || ''})\n\n`;
        case 'table': {
          const rows = node.content || [];
          if (rows.length === 0) return '';
          const renderedRows = rows.map((r: any) => {
            const cells = (r.content || []).map((c: any) =>
              (c.content || []).map(renderNode).join('').trim().replace(/\|/g, '\\|')
            );
            return `| ${cells.join(' | ')} |`;
          });
          if (renderedRows.length > 0) {
            const colCount = (rows[0].content || []).length;
            const divider = `| ${Array(colCount).fill('---').join(' | ')} |`;
            renderedRows.splice(1, 0, divider);
          }
          return `\n\n${renderedRows.join('\n')}\n\n`;
        }
        default:
          return children;
      }
    };

    return content.content
      .map(renderNode)
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return String(content).trim();
}

/**
 * Standardized llms.txt (AI Agent Context Specification conforming to llmstxt.org)
 */
export async function generateLlmsTxt(baseUrl = 'https://www.startupcreme.com'): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  let topArticles: Array<{ title: string; slug: string; locale: string; vertical: string; excerpt?: string }> = [];
  let topOpportunities: Array<{ title: string; slug: string; opportunity_type: string; funding_amount?: string; deadline_date?: string; location?: string }> = [];

  if (supabaseUrl && supabaseKey) {
    try {
      const client = createClient(supabaseUrl, supabaseKey, {
        db: { schema: 'startupcreme' },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // 1. Fetch top published editorial playbooks
      const { data: postsData } = await client
        .from('posts')
        .select('title, slug, locale, vertical, excerpt, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20);

      if (postsData && Array.isArray(postsData)) {
        topArticles = postsData;
      }

      // 2. Fetch active approved opportunities
      const { data: eventsData } = await client
        .from('events')
        .select('title, slug, opportunity_type, funding_amount, deadline_date, location, linked_post:posts!inner(status)')
        .eq('is_approved', true)
        .eq('linked_post.status', 'published')
        .order('deadline_date', { ascending: true })
        .limit(10);

      if (eventsData && Array.isArray(eventsData)) {
        topOpportunities = eventsData;
      }
    } catch (err) {
      console.warn('[llms.txt] Could not fetch dynamic rows:', err);
    }
  }

  // Format articles section
  const articlesList = topArticles.length > 0
    ? topArticles
        .map(
          (a) =>
            `- [${a.title}](${cleanBase}/${a.locale || 'en-us'}/${a.vertical || 'tech'}/${a.slug}): ${
              a.excerpt ? a.excerpt.replace(/\s+/g, ' ').slice(0, 180) + '...' : 'In-depth institutional founder analysis.'
            }`
        )
        .join('\n')
    : `- [Understanding Credit: Why Cash Alone Can't Scale Your Ambitions](${cleanBase}/en-us/finance/understanding-credit-why-cash-alone-can-t-scale-your-ambitions): Strategic capital structure and venture debt.
- [How to Build a $1 Billion Company: The Unfiltered Playbook](${cleanBase}/en-us/tech/how-to-build-a-1-billion-company-the-unfiltered-playbook): Operational architecture and product velocity.
- [GEO: The SEO Shift That Decides Whether AI Mentions You or Erases You](${cleanBase}/en-us/tech/geo-the-seo-shift-that-decides-whether-ai-mentions-you-or-erases-you): Generative engine optimization playbook.`;

  // Format opportunities section
  const opportunitiesList = topOpportunities.length > 0
    ? topOpportunities
        .map((o) => {
          const deadlineText = o.deadline_date ? ` (Deadline: ${o.deadline_date.split('T')[0]})` : '';
          const fundingText = o.funding_amount ? ` - ${o.funding_amount}` : '';
          return `- [${o.title}](${cleanBase}/events): ${o.opportunity_type.replace('_', ' ').toUpperCase()}${fundingText}${deadlineText}${o.location ? ` | ${o.location}` : ''}`;
        })
        .join('\n')
    : `- [Global Non-Dilutive Grants & Accelerators Engine](${cleanBase}/events): Continuous pipeline of institutional funding, venture fellowships, and hackathons.`;

  return `# Startup Crème

> Startup Crème is a premier dual-silo intelligence platform providing actionable founder playbooks, macro technology news, non-dilutive grants, institutional accelerators, and peer discussions at the intersection of Finance and Technology.

## Core Intelligence Silos

- [Finance](${cleanBase}/en-us/finance): Venture capital dynamics, cap table structuring, central bank interest rates, currency volatility, fintech infrastructure, and equity-free funding instruments.
- [Tech](${cleanBase}/en-us/tech): Artificial intelligence, autonomous agent pipelines, frontier cloud architecture, developer tooling, and technical engineering leadership.
- [Founders Mindset](${cleanBase}/en-us/founders-mindset): Strategic leadership psychology, executive resilience, decision-making frameworks, and mental fortitude for venture-backed founders.

## Top Published Analyses & Playbooks

${articlesList}

## Verified Opportunities & Grants

${opportunitiesList}

## Platform Navigation & Modules

- [Global Opportunity Engine (Grants & Accelerators)](${cleanBase}/events): Verified non-dilutive grants, venture accelerators, founder fellowships, and hackathon deadlines.
- [Discussion Forum](${cleanBase}/discussion): Community debate and peer founder intelligence on valuations, tech stacks, and fundraising.
- [Startup Directory](${cleanBase}/directory): Index of high-growth technology and financial companies.
- [Founder Careers & Talent](${cleanBase}/careers): Executive leadership, founding engineer, and tech lead opportunities.
- [Macro Central Bank Interest Rates & 10-Year Inflation Rates Tracker](${cleanBase}/markets/rates): Real-time benchmarks for sovereign central bank policy rates (Fed, ECB, BoE, BoJ, CBN, SARB, CBK, RBI) and 10-year historical sovereign inflation rate trajectories (2017–2026).
- [10-Year Sovereign Inflation Rates Matrix](${cleanBase}/markets/rates#inflation-rates): Annual consumer price index inflation dataset, target tolerance bands, and disinflation cycle metrics across 8 global economies.

## Optional

- [Full Machine-Readable Intelligence Archive](${cleanBase}/llms-full.txt): Complete consolidated markdown text of top published articles and playbooks for offline AI training and deep agent reasoning.
- [Dynamic XML Sitemap](${cleanBase}/sitemap.xml): Complete machine-crawlable XML sitemap index.
- [Robots Directives](${cleanBase}/robots.txt): Machine crawler access rules and crawl-delay specifications.
`;
}

/**
 * Standardized /llms-full.txt (Consolidated Full-Text Markdown Archive for AI Agents)
 */
export async function generateLlmsFullTxt(baseUrl = 'https://www.startupcreme.com'): Promise<string> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  let fullArticlesMarkdown = '';
  let fullOpportunitiesMarkdown = '';

  if (supabaseUrl && supabaseKey) {
    try {
      const client = createClient(supabaseUrl, supabaseKey, {
        db: { schema: 'startupcreme' },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // 1. Fetch published posts with full content
      const { data: postsData } = await client
        .from('posts')
        .select('title, slug, locale, vertical, excerpt, content, author_name, author_role, reading_time_minutes, created_at, canonical_url')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(25);

      if (postsData && Array.isArray(postsData)) {
        fullArticlesMarkdown = postsData
          .map((p) => {
            const canonical = p.canonical_url || `${cleanBase}/${p.locale || 'en-us'}/${p.vertical || 'tech'}/${p.slug}`;
            const bodyMd = convertContentToMarkdown(p.content);
            return `---

# ${p.title}

- **Permalink**: ${canonical}
- **Vertical**: ${p.vertical}
- **Locale**: ${p.locale || 'en-us'}
- **Author**: ${p.author_name || 'Startup Crème Editorial'} (${p.author_role || 'Editor'})
- **Reading Time**: ${p.reading_time_minutes || 5} min read
- **Published**: ${p.created_at ? p.created_at.split('T')[0] : '2026'}

> **Executive Summary**: ${p.excerpt || 'Comprehensive editorial intelligence.'}

${bodyMd}
`;
          })
          .join('\n\n');
      }

      // 2. Fetch approved events
      const { data: eventsData } = await client
        .from('events')
        .select('title, slug, opportunity_type, funding_amount, deadline_date, location, application_url, description, linked_post:posts!inner(status)')
        .eq('is_approved', true)
        .eq('linked_post.status', 'published')
        .order('deadline_date', { ascending: true })
        .limit(15);

      if (eventsData && Array.isArray(eventsData)) {
        fullOpportunitiesMarkdown = eventsData
          .map((e) => {
            return `### ${e.title}
- **Type**: ${e.opportunity_type.replace('_', ' ').toUpperCase()}
- **Funding Amount**: ${e.funding_amount || 'Non-Dilutive'}
- **Deadline**: ${e.deadline_date ? e.deadline_date.split('T')[0] : 'Open / Rolling'}
- **Location**: ${e.location || 'Global / Remote'}
- **Application URL**: ${e.application_url || `${cleanBase}/events`}

${e.description || 'Verified founder opportunity.'}
`;
          })
          .join('\n\n');
      }
    } catch (err) {
      console.warn('[llms-full.txt] Warning generating full markdown archive:', err);
    }
  }

  return `# Startup Crème — Consolidated Full Intelligence Archive (llms-full.txt)

> Complete machine-readable repository of published founder playbooks, macro technology analyses, non-dilutive grant specifications, and venture research. Generated dynamically for LLM context ingestion and automated reasoning agents.

---

## Table of Contents
1. Editorial Playbooks & Deep Intelligence
2. Verified Non-Dilutive Opportunities & Grants
3. Platform Context & Operating Principles

---

## 1. Editorial Playbooks & Deep Intelligence

${fullArticlesMarkdown || '*(No published playbooks available)*'}

---

## 2. Verified Non-Dilutive Opportunities & Grants

${fullOpportunitiesMarkdown || '*(No current opportunities listed)*'}

---

## 3. Platform Context & Operating Principles

Startup Crème operates under a zero-sponsored-editorial standard. All macroeconomic analyses, financial engineering frameworks, and technology systems evaluations are developed independently.

- **Canonical Origin**: ${cleanBase}
- **Sitemap**: ${cleanBase}/sitemap.xml
- **Robots Directives**: ${cleanBase}/robots.txt
- **Specification Index**: ${cleanBase}/llms.txt
`;
}
