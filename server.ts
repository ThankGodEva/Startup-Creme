import http from 'http';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer, ViteDevServer } from 'vite';
import { createApp } from './server/app';
import { injectDynamicMetaTags } from './server/meta';

export { createApp } from './server/app';
export { injectDynamicMetaTags, resolvePageMetadata } from './server/meta';

function parseCliPortAndHost(): { port: number; host: string } {
  const args = process.argv.slice(2);
  let port = Number(process.env.PORT) || 3000;
  let host = process.env.HOST || '0.0.0.0';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--port' && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) port = parsed;
      i++;
    } else if (arg.startsWith('--port=')) {
      const parsed = Number(arg.split('=')[1]);
      if (Number.isFinite(parsed) && parsed > 0) port = parsed;
    } else if (arg === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    } else if (arg.startsWith('--host=')) {
      host = arg.split('=')[1] || host;
    }
  }

  return { port, host };
}

async function startServer() {
  const { port: PORT, host: HOST } = parseCliPortAndHost();
  const isDev = process.env.NODE_ENV !== 'production';

  // In development, delegate HTML handling to Vite middleware
  // In production, createApp handles static assets and dynamic HTML serving
  const app = createApp({ serveHtml: !isDev });
  const httpServer = http.createServer(app);
  let viteServer: ViteDevServer | null = null;

  if (isDev) {
    const vitePromise = createViteServer({
      server: {
        middlewareMode: true,
        // Share httpServer when HMR is enabled so Vite never attempts to bind a standalone port (24678)
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'custom',
    })
      .then((instance) => {
        viteServer = instance;
        return instance;
      })
      .catch((err) => {
        console.error('[Dev Server] Failed to initialize Vite middleware:', err);
        process.exit(1);
      });

    // Attach Vite middleware lazily so Express binds port 3000 immediately
    app.use(async (req, res, next) => {
      try {
        const vite = viteServer || (await vitePromise);
        return vite.middlewares(req, res, next);
      } catch (err) {
        return next(err);
      }
    });

    // Catch-all SPA route for dev server (serves transformed index.html with dynamic OpenGraph meta tags)
    app.get('*', async (req, res, next) => {
      const p = req.path.toLowerCase();
      if (
        req.originalUrl.startsWith('/api') ||
        p.startsWith('/@') ||
        p === '/sitemap.xml' ||
        p === '/sitemap' ||
        p === '/sitemap_index.xml' ||
        p === '/robots.txt' ||
        p === '/llms.txt' ||
        /\.(js|jsx|ts|tsx|mjs|cjs|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|json|map|wasm)$/i.test(p)
      ) {
        return next();
      }
      try {
        const vite = viteServer || (await vitePromise);
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);

        let host = (req.headers['x-forwarded-host'] || req.headers['host'] || 'www.startupcreme.com') as string;
        if (Array.isArray(host)) host = host[0];
        let protocol = (req.headers['x-forwarded-proto'] || req.protocol || 'https') as string;
        if (Array.isArray(protocol)) protocol = protocol[0];

        const targetUrl = req.originalUrl || req.url;
        template = await injectDynamicMetaTags(template, targetUrl, host, protocol);

        res.status(200).set({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }).end(template);
      } catch (e) {
        if (viteServer) {
          viteServer.ssrFixStacktrace(e as Error);
        }
        next(e);
      }
    });
  }

  httpServer.on('error', (err: any) => {
    console.error(`[Server Error] Failed to bind ${HOST}:${PORT}:`, err?.message || err);
    process.exit(1);
  });

  const shutdown = async () => {
    try {
      if (viteServer) await viteServer.close();
    } catch {
      // ignore
    }
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  httpServer.listen(PORT, HOST, () => {
    console.log(`StartupCrème Server running on http://${HOST}:${PORT} (${isDev ? 'development' : 'production'})`);
  });
}

startServer().catch((err) => {
  console.error('[Fatal Server Startup Error]:', err);
  process.exit(1);
});
