import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { aiRouter } from '../src/server/aiRouter';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

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

/**
 * Express Application Factory
 * Creates and configures the authoritative Express API runtime for StartupCrème.
 * Can be imported by local standalone server (server.ts), test suites, or Vercel serverless adapter (api/index.ts).
 */
export function createApp(): express.Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Vercel rewrite normalization middleware:
  // When Vercel rewrites /api/(.*) to /api, Vercel sets req.url to /api while placing
  // the requested path in x-matched-path or x-forwarded-uri.
  // We normalize req.url so Express router always sees the original intended route.
  app.use((req, res, next) => {
    const rawMatched = (req.headers['x-matched-path'] || req.headers['x-forwarded-uri']) as string | undefined;
    if (rawMatched && typeof rawMatched === 'string') {
      const cleanMatched = rawMatched.split('?')[0];
      if (cleanMatched.startsWith('/api') && req.url !== cleanMatched) {
        const queryPart = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        req.url = cleanMatched + queryPart;
      }
    }
    next();
  });

  // Static uploads directory middleware (safe creation for serverless / read-only filesystems)
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch {
      // Ignored if filesystem is read-only (e.g. serverless environments)
    }
  }
  app.use('/uploads', express.static(uploadsDir));

  // --------------------------------------------------------------------
  // Core API Routes (registered with both /api/* and root-relative paths
  // to ensure robust handling across Vercel rewrites and direct calls)
  // --------------------------------------------------------------------

  // 0. Base API index
  app.get(['/api', '/api/'], (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      status: 'ok',
      service: 'StartupCrème Operational Platform',
      version: '1.0.0',
      routes: [
        '/api/health',
        '/api/ai/health',
        '/api/auth/profile',
        '/api/upload-image'
      ]
    });
  });

  // 1. System Health check
  app.get(['/api/health', '/health'], (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({ status: 'ok' });
  });

  // 2. User Profile & Role Synchronization API (authoritatively resolves user/admin role via service_role)
  app.get(['/api/auth/profile', '/auth/profile'], async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.substring(7).trim();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || (!serviceRoleKey && !anonKey)) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    try {
      // 1. Verify user JWT token with Supabase Auth
      const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);

      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid or expired auth token', details: authError?.message });
      }

      const email = (user.email || '').trim().toLowerCase();
      const userId = user.id;

      // 2. Query startupcreme.users using service_role to bypass RLS
      const adminClient = createClient(supabaseUrl, serviceRoleKey || anonKey, {
        db: { schema: 'startupcreme' },
        auth: { persistSession: false, autoRefreshToken: false }
      });

      let dbUser: any = null;
      // Check by user ID first
      const { data: byId } = await adminClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (byId) {
        dbUser = byId;
      } else if (email) {
        // Fallback check by email (handles pre-seeded admin accounts or ID updates)
        const { data: byEmail } = await adminClient
          .from('users')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

        if (byEmail) {
          dbUser = byEmail;
          // If seeded user had a placeholder ID, update it to the real Supabase Auth UUID
          if (serviceRoleKey && byEmail.id !== userId) {
            await adminClient
              .from('users')
              .update({ id: userId, updated_at: new Date().toISOString() })
              .eq('email', byEmail.email);
            dbUser.id = userId;
          }
        }
      }

      // If user still not in DB, provision them
      if (!dbUser) {
        const metadataRole = (user.user_metadata?.role as 'admin' | 'user') || 'user';
        const fullName = user.user_metadata?.full_name || email.split('@')[0] || 'User';
        const avatarUrl = user.user_metadata?.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(email)}/100/100`;

        const { data: insertedUser } = await adminClient
          .from('users')
          .insert({
            id: userId,
            email: email,
            full_name: fullName,
            avatar_url: avatarUrl,
            role: metadataRole
          })
          .select('*')
          .single();

        dbUser = insertedUser || {
          id: userId,
          email,
          full_name: fullName,
          avatar_url: avatarUrl,
          role: metadataRole
        };
      }

      const role = (dbUser.role || 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user';

      // Keep user_metadata in sync in Supabase Auth if service_role is present
      if (serviceRoleKey && user.user_metadata?.role !== role) {
        const masterClient = createClient(supabaseUrl, serviceRoleKey);
        masterClient.auth.admin.updateUserById(userId, {
          user_metadata: { ...user.user_metadata, role }
        }).catch(() => {});
      }

      return res.json({
        id: dbUser.id || userId,
        email: dbUser.email || email,
        full_name: dbUser.full_name || user.user_metadata?.full_name || email.split('@')[0],
        avatar_url: dbUser.avatar_url || user.user_metadata?.avatar_url,
        role: role,
        reputation: dbUser.reputation || 100,
        badge: dbUser.badge || (role === 'admin' ? 'Founder' : 'Contributor'),
        created_at: dbUser.created_at || user.created_at
      });
    } catch (err: any) {
      console.error('[AuthProfile API] Error resolving profile:', err);
      return res.status(500).json({ error: 'Internal error resolving user profile' });
    }
  });

  // 3. AI Subsystem: Autonomous M2M, n8n Orchestration, and Admin Control Plane
  app.use(['/api/ai', '/ai'], aiRouter);

  // 4. Dynamic XML Sitemap for Google Search Console
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
        xml += `  <url>\n    <loc>${baseUrl}/${loc}/privacy</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
        xml += `  <url>\n    <loc>${baseUrl}/${loc}/terms</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
      });

      xml += `  <url>\n    <loc>${baseUrl}/privacy</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
      xml += `  <url>\n    <loc>${baseUrl}/terms</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.5</priority>\n  </url>\n`;
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

  // 5. Dynamic robots.txt
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
Allow: /privacy
Allow: /terms
Allow: /discussion

Disallow: /admin
Disallow: /api/

Sitemap: ${protocol}://${host}/sitemap.xml
`;
    return res.status(200).send(robots);
  });

  // 6. Cloudflare R2 Image Upload (with server local storage fallback)
  app.post(['/api/upload-image', '/upload-image'], upload.single('image'), async (req, res) => {
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
          CacheControl: 'public, max-age=31536000, immutable',
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

  return app;
}

export const app = createApp();
export default app;
