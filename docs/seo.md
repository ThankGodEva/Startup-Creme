# SEO Implementation & Topical Siloing Guide

StartupCrème implements topical siloing architecture to build domain authority in Finance and Tech.

---

## 🏛️ Topical Silo Routing Structure

- **Finance Silo**: `/[locale]/finance` (Focus: Capital markets, macro economics, venture debt)
- **Tech Silo**: `/[locale]/tech` (Focus: Autonomous systems, semiconductors, cloud architecture)
- **Dual Siloing**: High-impact cross-over articles are flagged with `dual_silo = true` and rendered in both vertical channels.

---

## 🗺️ XML Sitemap Generation

The system dynamically builds XML sitemaps incorporating canonical URLs, hreflang regional tags, and topic URLs:

```typescript
// Located in /src/lib/seo.ts
export function generateSitemapXML(posts: Post[], topics: ForumTopic[]): string {
  // Generates valid XML sitemap with <loc>, <lastmod>, <changefreq>, and <priority>
}
```

---

## 🤖 Robots.txt Configuration

```text
User-agent: *
Allow: /
Disallow: /admin
Sitemap: https://startupcreme.com/sitemap.xml
```
