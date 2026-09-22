import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app';
import { injectDynamicMetaTags } from './server/meta';

export { createApp } from './server/app';
export { injectDynamicMetaTags, resolvePageMetadata } from './server/meta';

async function startServer() {
  const PORT = 3000;
  const isDev = process.env.NODE_ENV !== 'production';

  // In development, delegate HTML handling to Vite middleware
  // In production, createApp handles static assets and dynamic HTML serving
  const app = createApp({ serveHtml: !isDev });

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    // Catch-all SPA route for dev server (serves transformed index.html with dynamic OpenGraph meta tags)
    app.get('*', async (req, res, next) => {
      const p = req.path.toLowerCase();
      if (
        req.originalUrl.startsWith('/api') ||
        p === '/sitemap.xml' ||
        p === '/sitemap' ||
        p === '/sitemap_index.xml' ||
        p === '/robots.txt' ||
        /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(p)
      ) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);

        let host = (req.headers['x-forwarded-host'] || req.headers['host'] || 'www.startupcreme.com') as string;
        if (Array.isArray(host)) host = host[0];
        let protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'https') as string;
        if (Array.isArray(protocol)) protocol = protocol[0];

        const targetUrl = req.originalUrl || req.url;
        template = await injectDynamicMetaTags(template, targetUrl, host, protocol);

        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StartupCrème Server running on http://0.0.0.0:${PORT} (${isDev ? 'development' : 'production'})`);
  });
}

startServer();
