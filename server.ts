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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route: Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // API Route: Cloudflare R2 Image Upload
  app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No image file provided in request.' });
      }

      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const bucketName = process.env.R2_BUCKET_NAME;
      const publicUrl = process.env.R2_PUBLIC_URL;

      if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
        return res.status(400).json({
          error: 'Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are not configured in environment variables.',
          missingKeys: {
            R2_ACCOUNT_ID: !accountId,
            R2_ACCESS_KEY_ID: !accessKeyId,
            R2_SECRET_ACCESS_KEY: !secretAccessKey,
            R2_BUCKET_NAME: !bucketName,
          },
        });
      }

      // Construct S3Client for Cloudflare R2
      const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
      const s3Client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      // Generate unique file path in bucket
      const fileExt = path.extname(file.originalname) || '.jpg';
      const cleanBaseName = path.basename(file.originalname, fileExt).replace(/[^a-zA-Z0-9_-]/g, '_');
      const objectKey = `articles/${Date.now()}-${cleanBaseName}${fileExt}`;

      // Upload to R2 Bucket
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype || 'image/jpeg',
      });

      await s3Client.send(command);

      // Determine Public URL
      let imageUrl = '';
      if (publicUrl) {
        let cleanPublicUrl = publicUrl.replace(/\/+$/, '');
        if (!/^https?:\/\//i.test(cleanPublicUrl)) {
          cleanPublicUrl = `https://${cleanPublicUrl}`;
        }
        imageUrl = `${cleanPublicUrl}/${objectKey}`;
      } else {
        imageUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${objectKey}`;
      }

      console.log('Successfully uploaded image to Cloudflare R2:', imageUrl);
      return res.json({
        success: true,
        url: imageUrl,
        key: objectKey,
      });
    } catch (err: any) {
      console.error('Error uploading image to Cloudflare R2:', err);
      return res.status(500).json({
        error: err?.message || 'Failed to upload image to Cloudflare R2 storage',
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
      if (req.originalUrl.startsWith('/api')) {
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
      if (req.originalUrl.startsWith('/api')) {
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
