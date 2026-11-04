import { Post, DiscussionTopic } from '../types';
import { normalizeImageUrl } from './router';

function setMetaTag(selector: string, attrName: string, attrVal: string, content: string) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export function updatePageSEO(options: {
  title: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  type?: string;
}) {
  const fullTitle = options.title.includes('StartupCrème')
    ? options.title
    : `${options.title} | StartupCrème - Finance & Tech Intelligence`;

  document.title = fullTitle;

  const desc = options.description || 'StartupCrème is the premier digital publication for Finance, Macro-economics, and Deep Technology.';
  const defaultImage = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630';
  let imgUrl = options.ogImage ? normalizeImageUrl(options.ogImage) : defaultImage;
  if (imgUrl.startsWith('/') && typeof window !== 'undefined') {
    imgUrl = `${window.location.origin}${imgUrl}`;
  }
  const currentUrl = options.canonicalUrl || (typeof window !== 'undefined' ? window.location.href : 'https://www.startupcreme.com');

  setMetaTag('meta[name="description"]', 'name', 'description', desc);

  // Canonical tag
  if (typeof document !== 'undefined') {
    let canonEl = document.querySelector('link[rel="canonical"]');
    if (!canonEl) {
      canonEl = document.createElement('link');
      canonEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonEl);
    }
    canonEl.setAttribute('href', currentUrl);
  }

  // OpenGraph
  setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'StartupCrème');
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', options.type || 'article');
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', fullTitle);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', desc);
  setMetaTag('meta[property="og:image"]', 'property', 'og:image', imgUrl);
  setMetaTag('meta[property="og:image:secure_url"]', 'property', 'og:image:secure_url', imgUrl);
  setMetaTag('meta[property="og:image:width"]', 'property', 'og:image:width', '1200');
  setMetaTag('meta[property="og:image:height"]', 'property', 'og:image:height', '630');
  setMetaTag('meta[property="og:image:alt"]', 'property', 'og:image:alt', fullTitle);
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', currentUrl);

  // Twitter Card
  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMetaTag('meta[name="twitter:site"]', 'name', 'twitter:site', '@startupcreme');
  setMetaTag('meta[name="twitter:creator"]', 'name', 'twitter:creator', '@startupcreme');
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', desc);
  setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', imgUrl);
}

export function generateSitemapXML(posts: Post[], topics: DiscussionTopic[]): string {
  const baseUrl = 'https://startupcreme.com';
  const locales = ['en-us', 'en-gb', 'de-de', 'ja-jp', 'fr-fr'];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;

  // Root & Locales
  locales.forEach(loc => {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/${loc}</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/${loc}/finance</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.9</priority>\n`;
    xml += `  </url>\n`;

    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/${loc}/tech</loc>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.9</priority>\n`;
    xml += `  </url>\n`;

    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/${loc}/privacy</loc>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.5</priority>\n`;
    xml += `  </url>\n`;

    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/${loc}/terms</loc>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.5</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/about</loc>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.8</priority>\n`;
  xml += `  </url>\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/privacy</loc>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.5</priority>\n`;
  xml += `  </url>\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/terms</loc>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.5</priority>\n`;
  xml += `  </url>\n`;

  // Forum & Platform Modules
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/discussion</loc>\n`;
  xml += `    <changefreq>hourly</changefreq>\n`;
  xml += `    <priority>0.85</priority>\n`;
  xml += `  </url>\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/directory</loc>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>0.8</priority>\n`;
  xml += `  </url>\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/careers</loc>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>0.8</priority>\n`;
  xml += `  </url>\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/events</loc>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>0.9</priority>\n`;
  xml += `  </url>\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/markets</loc>\n`;
  xml += `    <changefreq>hourly</changefreq>\n`;
  xml += `    <priority>0.9</priority>\n`;
  xml += `  </url>\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/markets/rates</loc>\n`;
  xml += `    <changefreq>hourly</changefreq>\n`;
  xml += `    <priority>0.9</priority>\n`;
  xml += `  </url>\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/markets/inflation</loc>\n`;
  xml += `    <changefreq>hourly</changefreq>\n`;
  xml += `    <priority>0.9</priority>\n`;
  xml += `  </url>\n`;

  // Published Posts
  posts.filter(p => p.status === 'published').forEach(post => {
    const loc = post.locale || 'en-us';
    const postUrl = `${baseUrl}/${loc}/${post.vertical}/${post.slug}`;
    const lastMod = post.updated_at ? new Date(post.updated_at).toISOString() : new Date().toISOString();

    xml += `  <url>\n`;
    xml += `    <loc>${postUrl}</loc>\n`;
    xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.85</priority>\n`;
    xml += `  </url>\n`;
  });

  // Discussion Topics
  topics.forEach(t => {
    const topicUrl = `${baseUrl}/discussion/${t.slug}`;
    const lastMod = t.updated_at ? new Date(t.updated_at).toISOString() : new Date().toISOString();

    xml += `  <url>\n`;
    xml += `    <loc>${topicUrl}</loc>\n`;
    xml += `    <lastmod>${lastMod}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    xml += `  </url>\n`;
  });

  xml += `</urlset>`;
  return xml;
}

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
- [Global Opportunity Engine (Grants & Accelerators)](${cleanBase}/events): Verified non-dilutive grants, venture accelerators, founder fellowships, and hackathon deadlines.
- [Discussion Forum](${cleanBase}/discussion): Community debate and peer founder intelligence on valuations, tech stacks, and fundraising.
- [Startup Directory](${cleanBase}/directory): Index of high-growth technology and financial companies.
- [Macro Central Bank Interest Rates & 10-Year Inflation Rates Tracker](${cleanBase}/markets/rates): Real-time benchmarks for central bank interest rates (Fed, ECB, BoE, BoJ, CBN, SARB, CBK, RBI) and 10-year historical sovereign inflation rate trajectories (2017–2026).
- [10-Year Sovereign Inflation Rates Matrix](${cleanBase}/markets/rates#inflation-rates): Annual consumer price index inflation dataset, target tolerance bands, and disinflation cycle metrics across 8 global economies.

---

## Content Organization & URL Structure

- **Article & Playbook Permalinks**: \`${cleanBase}/{locale}/{vertical}/{slug}\`
- **Discussion Topic Permalinks**: \`${cleanBase}/discussion/{slug}\`
- **Localized Silo Feeds**: \`${cleanBase}/{locale}/{vertical}\`

---

## Machine-Readable Endpoints & Feeds

- **Dynamic XML Sitemap**: [${cleanBase}/sitemap.xml](${cleanBase}/sitemap.xml)
- **Robots Directives**: [${cleanBase}/robots.txt](${cleanBase}/robots.txt)
- **AI Agent Specification**: [${cleanBase}/llms.txt](${cleanBase}/llms.txt)
- **System Health**: [${cleanBase}/api/health](${cleanBase}/api/health)
`;
}
