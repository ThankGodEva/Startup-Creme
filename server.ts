import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { createApp } from './server/app';

export { createApp } from './server/app';

async function injectDynamicMetaTags(html: string, reqPath: string, host: string, protocol: string): Promise<string> {
  let title = "StartupCrème | Financial & Technology Intelligence";
  let description = "StartupCrème is the premier digital publication for Finance, Macro-economics, and Deep Technology.";
  let coverImage = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630";
  let pageType = "website";
  let ssrPayloadScript = "";

  const fullUrl = `${protocol}://${host}${reqPath}`;

  const cleanPath = reqPath.split('?')[0].split('#')[0];
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length > 0) {
    const rawSlug = segments[segments.length - 1];
    const lowerSlug = rawSlug.toLowerCase();
    const excluded = ['finance', 'tech', 'discussion', 'discussions', 'admin', 'sitemap.xml', 'robots.txt', 'privacy', 'privacy-policy', 'terms', 'terms-of-service', 'terms-of-editorial-service'];

    if (lowerSlug === 'privacy' || lowerSlug === 'privacy-policy') {
      title = "Privacy Policy | StartupCrème";
      description = "StartupCrème Privacy Policy: Learn how we protect personal data, handle cookies, manage newsletter subscriptions, and ensure GDPR/CCPA compliance.";
      pageType = "article";
    } else if (lowerSlug === 'terms' || lowerSlug === 'terms-of-service' || lowerSlug === 'terms-of-editorial-service') {
      title = "Terms of Editorial Service | StartupCrème";
      description = "StartupCrème Terms of Service: Institutional intelligence disclaimers, intellectual property rules, forum community standards, and YMYL non-financial advice notices.";
      pageType = "article";
    } else if (rawSlug && !excluded.includes(lowerSlug)) {
      const decodedSlug = decodeURIComponent(rawSlug).trim().toLowerCase();
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

      if (supabaseUrl && supabaseAnonKey) {
        try {
          const scClient = createClient(supabaseUrl, supabaseAnonKey, {
            db: { schema: 'startupcreme' }
          });
          const defaultClient = createClient(supabaseUrl, supabaseAnonKey);

          const executeQuery = async (queryFn: (client: any) => PromiseLike<any>) => {
            try {
              const res = await queryFn(scClient);
              if (!res.error && res.data) return res;
            } catch (e) {
              // ignore
            }
            return await queryFn(defaultClient);
          };

          // Query posts
          const postsRes = await executeQuery((client) =>
            client.from('posts').select('*').or(`slug.ilike.${decodedSlug},id.ilike.${decodedSlug}`)
          );

          let foundPost = postsRes?.data && postsRes.data.length > 0 ? postsRes.data[0] : null;

          if (!foundPost && decodedSlug.length > 8) {
            const shortSlug = decodedSlug.slice(-20);
            const partialRes = await executeQuery((client) =>
              client.from('posts').select('*').ilike('slug', `%${shortSlug}%`)
            );
            if (partialRes?.data && partialRes.data.length > 0) {
              foundPost = partialRes.data[0];
            }
          }

          if (foundPost) {
            title = `${foundPost.title} | StartupCrème`;
            description = foundPost.excerpt || foundPost.meta_description || description;
            if (foundPost.cover_image) {
              coverImage = foundPost.cover_image;
            }
            pageType = "article";
            const sanitizedPost = JSON.stringify(foundPost).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
            ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_POST__ = ${sanitizedPost};</script>`;
          } else {
            // Try querying topics
            const topicRes = await executeQuery((client) =>
              client.from('discussion_topics').select('*').or(`slug.ilike.${decodedSlug},id.ilike.${decodedSlug}`)
            );

            if (topicRes?.data && topicRes.data.length > 0) {
              const topic = topicRes.data[0];
              title = `${topic.title} | StartupCrème Discussion`;
              description = topic.content ? topic.content.slice(0, 200) + '...' : description;
              pageType = "article";
              const sanitizedTopic = JSON.stringify(topic).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
              ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_TOPIC__ = ${sanitizedTopic};</script>`;
            }
          }
        } catch (e) {
          console.warn('Server meta tag lookup warning:', e);
        }
      }
    }
  }

  // Pre-fetch top posts if not an individual article to speed up initial view
  if (!ssrPayloadScript) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const scClient = createClient(supabaseUrl, supabaseAnonKey, {
          db: { schema: 'startupcreme' }
        });
        const defaultClient = createClient(supabaseUrl, supabaseAnonKey);

        const executeQuery = async (queryFn: (client: any) => PromiseLike<any>) => {
          try {
            const res = await queryFn(scClient);
            if (!res.error && res.data) return res;
          } catch (e) {}
          return await queryFn(defaultClient);
        };

        const res = await executeQuery((client) =>
          client.from('posts').select('*').order('created_at', { ascending: false }).limit(20)
        );
        if (res?.data && res.data.length > 0) {
          const sanitizedPosts = JSON.stringify(res.data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
          ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_POSTS__ = ${sanitizedPosts};</script>`;
        }
      } catch (e) {
        // ignore
      }
    }
  }

  const escapeHtml = (str: string) => str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeImage = escapeHtml(coverImage);
  const safeUrl = escapeHtml(fullUrl);

  const dynamicMeta = `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />

    <!-- Open Graph / Facebook / WhatsApp / LinkedIn / iMessage -->
    <meta property="og:type" content="${pageType}" />
    <meta property="og:site_name" content="StartupCrème" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:url" content="${safeUrl}" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@startupcreme" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImage}" />
    ${ssrPayloadScript}
  `;

  let updatedHtml = html.replace(/<title>.*?<\/title>/gi, '');
  updatedHtml = updatedHtml.replace(/<meta\s+(property|name)=["'](og:|twitter:|description).*?>/gi, '');

  return updatedHtml.replace('</head>', `${dynamicMeta}\n</head>`);
}

async function startServer() {
  const app = createApp();
  const PORT = 3000;

  // Vite middleware for development or static server for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Catch-all SPA route for dev server (serves index.html for non-API GET requests)
    app.get('*', async (req, res, next) => {
      const p = req.path.toLowerCase();
      if (req.originalUrl.startsWith('/api') || p === '/sitemap.xml' || p === '/sitemap' || p === '/sitemap_index.xml' || p === '/robots.txt') {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);

        const host = req.get('host') || 'www.startupcreme.com';
        const protocol = req.protocol || 'https';
        template = await injectDynamicMetaTags(template, req.originalUrl, host, protocol);

        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res, next) => {
      const p = req.path.toLowerCase();
      if (req.originalUrl.startsWith('/api') || p === '/sitemap.xml' || p === '/sitemap' || p === '/sitemap_index.xml' || p === '/robots.txt') {
        return next();
      }
      try {
        const indexPath = path.join(distPath, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');

        const host = req.get('host') || 'www.startupcreme.com';
        const protocol = req.protocol || 'https';
        template = await injectDynamicMetaTags(template, req.originalUrl, host, protocol);

        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
