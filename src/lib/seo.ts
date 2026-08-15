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
  const imgUrl = options.ogImage ? normalizeImageUrl(options.ogImage) : defaultImage;
  const currentUrl = options.canonicalUrl || window.location.href;

  setMetaTag('meta[name="description"]', 'name', 'description', desc);

  // OpenGraph
  setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', 'StartupCrème');
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', options.type || 'article');
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', fullTitle);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', desc);
  setMetaTag('meta[property="og:image"]', 'property', 'og:image', imgUrl);
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', currentUrl);

  // Twitter Card
  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMetaTag('meta[name="twitter:site"]', 'name', 'twitter:site', '@startupcreme');
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
  xml += `    <loc>${baseUrl}/privacy</loc>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.5</priority>\n`;
  xml += `  </url>\n`;

  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/terms</loc>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.5</priority>\n`;
  xml += `  </url>\n`;

  // Forum
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/discussion</loc>\n`;
  xml += `    <changefreq>hourly</changefreq>\n`;
  xml += `    <priority>0.8</priority>\n`;
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

export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /privacy
Allow: /terms
Allow: /discussion
Disallow: /admin
Disallow: /api/

Sitemap: https://startupcreme.com/sitemap.xml
`;
}
