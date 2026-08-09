import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createServer as createViteServer } from 'vite';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

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
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
