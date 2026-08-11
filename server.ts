import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

async function injectDynamicMetaTags(html: string, reqPath: string, host: string, protocol: string): Promise<string> {
  let title = "StartupCrème | Financial & Technology Intelligence";
  let description = "StartupCrème is the premier digital publication for Finance, Macro-economics, and Deep Technology.";
  let coverImage = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630";
  let pageType = "website";

  const fullUrl = `${protocol}://${host}${reqPath}`;

  const cleanPath = reqPath.split('?')[0].split('#')[0];
  const segments = cleanPath.split('/').filter(Boolean);

  if (segments.length > 0) {
    const rawSlug = segments[segments.length - 1];
    const excluded = ['finance', 'tech', 'discussion', 'discussions', 'admin', 'sitemap.xml', 'robots.txt'];

    if (rawSlug && !excluded.includes(rawSlug.toLowerCase())) {
      const decodedSlug = decodeURIComponent(rawSlug).trim().toLowerCase();
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

      if (supabaseUrl && supabaseAnonKey) {
        try {
          const client = createClient(supabaseUrl, supabaseAnonKey, {
            db: { schema: 'startupcreme' }
          });

          // Query posts
          const { data: posts } = await client
            .from('posts')
            .select('title, excerpt, meta_description, cover_image, slug, id')
            .or(`slug.ilike.${decodedSlug},id.ilike.${decodedSlug}`);

          let foundPost = posts && posts.length > 0 ? posts[0] : null;

          if (!foundPost && decodedSlug.length > 8) {
            const shortSlug = decodedSlug.slice(-20);
            const { data: partialPosts } = await client
              .from('posts')
              .select('title, excerpt, meta_description, cover_image, slug, id')
              .ilike('slug', `%${shortSlug}%`);
            if (partialPosts && partialPosts.length > 0) {
              foundPost = partialPosts[0];
            }
          }

          if (foundPost) {
            title = `${foundPost.title} | StartupCrème`;
            description = foundPost.excerpt || foundPost.meta_description || description;
            if (foundPost.cover_image) {
              coverImage = foundPost.cover_image;
            }
            pageType = "article";
          } else {
            // Try querying topics
            const { data: topics } = await client
              .from('discussion_topics')
              .select('title, content, slug, id')
              .or(`slug.ilike.${decodedSlug},id.ilike.${decodedSlug}`);

            if (topics && topics.length > 0) {
              const topic = topics[0];
              title = `${topic.title} | StartupCrème Discussion`;
              description = topic.content ? topic.content.slice(0, 200) + '...' : description;
              pageType = "article";
            }
          }
        } catch (e) {
          console.warn('Server meta tag lookup warning:', e);
        }
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
  `;

  let updatedHtml = html.replace(/<title>.*?<\/title>/gi, '');
  updatedHtml = updatedHtml.replace(/<meta\s+(property|name)=["'](og:|twitter:|description).*?>/gi, '');

  return updatedHtml.replace('</head>', `${dynamicMeta}\n</head>`);
}

function getR2Config() {
  const getEnv = (...keys: string[]) => {
    for (const k of keys) {
      const val = process.env[k];
      if (val && typeof val === 'string' && val.trim().length > 0) {
        return val.trim().replace(/^["']|["']$/g, '');
      }
    }
    return '';
  };

  const rawAccountId = getEnv(
    'R2_ACCOUNT_ID',
    'CLOUDFLARE_R2_ACCOUNT_ID',
    'CLOUDFLARE_ACCOUNT_ID',
    'CF_R2_ACCOUNT_ID',
    'CF_ACCOUNT_ID',
    'VITE_R2_ACCOUNT_ID',
    'VITE_CLOUDFLARE_R2_ACCOUNT_ID'
  );

  const accountId = rawAccountId
    .replace(/^https?:\/\//i, '')
    .replace(/\.r2\.cloudflarestorage\.com.*$/i, '')
    .replace(/\/.*$/, '')
    .trim();

  const accessKeyId = getEnv(
    'R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CF_R2_ACCESS_KEY_ID',
    'R2_ACCESS_KEY',
    'VITE_R2_ACCESS_KEY_ID',
    'VITE_CLOUDFLARE_R2_ACCESS_KEY_ID'
  );

  const secretAccessKey = getEnv(
    'R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CF_R2_SECRET_ACCESS_KEY',
    'R2_SECRET_KEY',
    'R2_SECRET',
    'VITE_R2_SECRET_ACCESS_KEY',
    'VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY'
  );

  const bucketName = getEnv(
    'R2_BUCKET_NAME',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'CF_R2_BUCKET_NAME',
    'R2_BUCKET',
    'CF_R2_BUCKET',
    'VITE_R2_BUCKET_NAME',
    'VITE_CLOUDFLARE_R2_BUCKET_NAME'
  );

  const publicUrl = getEnv(
    'R2_PUBLIC_URL',
    'CLOUDFLARE_R2_PUBLIC_URL',
    'CF_R2_PUBLIC_URL',
    'R2_PUBLIC_DOMAIN',
    'R2_DOMAIN',
    'VITE_R2_PUBLIC_URL',
    'VITE_CLOUDFLARE_R2_PUBLIC_URL'
  );

  const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey && bucketName);

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl, isConfigured };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Static uploads directory middleware
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // API Route: Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Dynamic XML Sitemap for Google Search Console
  app.get(['/sitemap.xml', '/sitemap', '/sitemap_index.xml'], async (req, res) => {
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex');

    try {
      let host = req.get('x-forwarded-host') || req.get('host') || 'www.startupcreme.com';
      if (!host.includes('startupcreme.com')) {
        host = 'www.startupcreme.com';
      }
      let protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
      if (host.includes('startupcreme.com')) {
        protocol = 'https';
      }
      const baseUrl = `${protocol}://${host}`;

      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

      let posts: any[] = [];
      let topics: any[] = [];

      if (supabaseUrl && supabaseAnonKey) {
        try {
          const client = createClient(supabaseUrl, supabaseAnonKey, {
            db: { schema: 'startupcreme' }
          });
          const { data: postsData } = await client
            .from('posts')
            .select('*')
            .eq('status', 'published');
          if (postsData) posts = postsData;

          const { data: topicsData } = await client
            .from('discussion_topics')
            .select('*');
          if (topicsData) topics = topicsData;
        } catch (e) {
          console.warn('Error fetching sitemap data from Supabase:', e);
        }
      }

      const locales = ['en-us', 'en-gb', 'de-de', 'ja-jp', 'fr-fr'];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      // Root & Locales
      locales.forEach(loc => {
        xml += `  <url>\n    <loc>${baseUrl}/${loc}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
        xml += `  <url>\n    <loc>${baseUrl}/${loc}/finance</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
        xml += `  <url>\n    <loc>${baseUrl}/${loc}/tech</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n`;
      });

      xml += `  <url>\n    <loc>${baseUrl}/discussion</loc>\n    <changefreq>hourly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;

      posts.forEach(post => {
        const loc = post.locale || 'en-us';
        const postUrl = `${baseUrl}/${loc}/${post.vertical}/${post.slug}`;
        const lastMod = post.updated_at ? new Date(post.updated_at).toISOString() : new Date().toISOString();

        xml += `  <url>\n    <loc>${postUrl}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.85</priority>\n  </url>\n`;
      });

      topics.forEach(t => {
        const topicUrl = `${baseUrl}/discussion/${t.slug}`;
        const lastMod = t.updated_at ? new Date(t.updated_at).toISOString() : new Date().toISOString();

        xml += `  <url>\n    <loc>${topicUrl}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      });

      xml += `</urlset>`;

      return res.status(200).send(xml);
    } catch (err) {
      console.error('Sitemap generation error, serving static sitemap.xml fallback:', err);
      const fallbackPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
      if (fs.existsSync(fallbackPath)) {
        return res.status(200).sendFile(fallbackPath);
      }
      return res.status(500).send('Error generating sitemap');
    }
  });

  // Dynamic robots.txt
  app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    let host = req.get('x-forwarded-host') || req.get('host') || 'www.startupcreme.com';
    if (!host.includes('startupcreme.com')) {
      host = 'www.startupcreme.com';
    }
    let protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    if (host.includes('startupcreme.com')) {
      protocol = 'https';
    }

    const robots = `User-agent: *
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /discussion

Disallow: /admin
Disallow: /api/

Sitemap: ${protocol}://${host}/sitemap.xml
`;
    return res.status(200).send(robots);
  });

  // API Route: Cloudflare R2 Image Upload (with server local storage fallback)
  app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No image file provided in request.' });
      }

      const r2Config = getR2Config();

      const fileExt = path.extname(file.originalname) || '.jpg';
      const cleanBaseName = path.basename(file.originalname, fileExt).replace(/[^a-zA-Z0-9_-]/g, '_');
      const objectKey = `articles/${Date.now()}-${cleanBaseName}${fileExt}`;

      const saveLocally = () => {
        const articleUploadsDir = path.join(process.cwd(), 'public', 'uploads', 'articles');
        if (!fs.existsSync(articleUploadsDir)) {
          fs.mkdirSync(articleUploadsDir, { recursive: true });
        }
        const localFilename = `${Date.now()}-${cleanBaseName}${fileExt}`;
        const localFilePath = path.join(articleUploadsDir, localFilename);
        fs.writeFileSync(localFilePath, file.buffer);
        return `/uploads/articles/${localFilename}`;
      };

      if (!r2Config.isConfigured) {
        const localUrl = saveLocally();
        console.log('R2 storage credentials not fully configured. Saved image locally:', localUrl);
        return res.json({
          success: true,
          url: localUrl,
          key: objectKey,
          storage: 'local',
          message: 'Saved to server storage. (To route uploads to Cloudflare R2 CDN, configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in Settings).',
        });
      }

      // Construct S3Client for Cloudflare R2
      try {
        const endpoint = `https://${r2Config.accountId}.r2.cloudflarestorage.com`;
        const s3Client = new S3Client({
          region: 'auto',
          endpoint,
          credentials: {
            accessKeyId: r2Config.accessKeyId,
            secretAccessKey: r2Config.secretAccessKey,
          },
        });

        const command = new PutObjectCommand({
          Bucket: r2Config.bucketName,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype || 'image/jpeg',
        });

        await s3Client.send(command);

        let imageUrl = '';
        if (r2Config.publicUrl) {
          let cleanPublicUrl = r2Config.publicUrl.replace(/\/+$/, '');
          if (!/^https?:\/\//i.test(cleanPublicUrl)) {
            cleanPublicUrl = `https://${cleanPublicUrl}`;
          }
          imageUrl = `${cleanPublicUrl}/${objectKey}`;
        } else {
          imageUrl = `https://${r2Config.bucketName}.${r2Config.accountId}.r2.cloudflarestorage.com/${objectKey}`;
        }

        console.log('Successfully uploaded image to Cloudflare R2:', imageUrl);
        return res.json({
          success: true,
          url: imageUrl,
          key: objectKey,
          storage: 'r2',
          message: 'Successfully uploaded to Cloudflare R2',
        });
      } catch (r2Err: any) {
        console.warn('Cloudflare R2 upload error, using server local storage fallback:', r2Err);
        const localUrl = saveLocally();
        return res.json({
          success: true,
          url: localUrl,
          key: objectKey,
          storage: 'local',
          message: `R2 Upload warning (${r2Err?.message || 'Error communicating with R2'}). Saved to server local storage as fallback.`,
          r2Error: r2Err?.message,
        });
      }
    } catch (err: any) {
      console.error('Fatal error during image upload:', err);
      return res.status(500).json({
        error: err?.message || 'Failed to process image upload.',
      });
    }
  });

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
