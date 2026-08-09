import { Post, DiscussionTopic } from '../types';

export function updatePageSEO(options: {
  title: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  type?: string;
}) {
  const fullTitle = `${options.title} | StartupCrème - Finance & Tech Intelligence`;
  document.title = fullTitle;

  // Description
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement('meta');
    metaDesc.setAttribute('name', 'description');
    document.head.appendChild(metaDesc);
  }
  metaDesc.setAttribute('content', options.description || 'StartupCrème is the premier digital publication for Finance, Macro-economics, and Deep Technology.');

  // OpenGraph Title
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (!ogTitle) {
    ogTitle = document.createElement('meta');
    ogTitle.setAttribute('property', 'og:title');
    document.head.appendChild(ogTitle);
  }
  ogTitle.setAttribute('content', fullTitle);

  // OpenGraph Image
  if (options.ogImage) {
    let ogImg = document.querySelector('meta[property="og:image"]');
    if (!ogImg) {
      ogImg = document.createElement('meta');
      ogImg.setAttribute('property', 'og:image');
      document.head.appendChild(ogImg);
    }
    ogImg.setAttribute('content', options.ogImage);
  }
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
  });

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
Allow: /discussion
Disallow: /admin
Disallow: /api/

Sitemap: https://startupcreme.com/sitemap.xml
`;
}
