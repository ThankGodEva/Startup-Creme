import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server/app';
import vercelEntrypointApp from '../api/index';

describe('Vercel Deployment & Express API Routing Regression Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    // Start an ephemeral HTTP server using the Express application instance
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('Vercel entrypoint in api/index.ts exports a valid Express application', () => {
    assert.ok(vercelEntrypointApp, 'api/index.ts must export default app');
    assert.equal(typeof vercelEntrypointApp, 'function', 'Exported app must be an Express request handler');
  });

  test('GET /api/health returns JSON status: ok and never index.html', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200, 'Health check should return HTTP 200');

    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'), `Expected application/json header, received: ${contentType}`);

    const text = await res.text();
    assert.ok(!text.includes('<!doctype html>'), 'Must NOT return HTML doctype');
    assert.ok(!text.includes('<div id="root">'), 'Must NOT return React root div');

    const body = JSON.parse(text);
    assert.equal(body.status, 'ok', 'Body must contain status: "ok"');
  });

  test('GET /health (root-relative alias) also returns JSON status: ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'));

    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  test('GET /api/ai/health returns JSON response and never index.html', async () => {
    // Set a known test automation secret
    const testSecret = 'test_secret_automation_key_12345';
    process.env.STARTUPCREME_AUTOMATION_SECRET = testSecret;

    const res = await fetch(`${baseUrl}/api/ai/health`, {
      headers: {
        'x-automation-secret': testSecret,
      },
    });

    assert.equal(res.status, 200, 'AI health check with credentials should return HTTP 200');

    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'), `Expected application/json header, received: ${contentType}`);

    const text = await res.text();
    assert.ok(!text.includes('<!doctype html>'), 'Must NOT return HTML doctype');
    assert.ok(!text.includes('<div id="root">'), 'Must NOT return React root div');

    const body = JSON.parse(text);
    assert.equal(body.status, 'healthy', 'AI health body must contain status: "healthy"');
    assert.ok(body.system, 'Must include system telemetry payload');
    assert.equal(body.system.platform, 'StartupCrème AI Operating System');
    assert.ok(body.constitution, 'Must include constitution details');
    assert.ok(Array.isArray(body.registeredTools), 'Must include registered tools');
  });

  test('GET /api/ai/health without valid credentials rejects with 401 JSON and never HTML', async () => {
    process.env.NODE_ENV = 'production';
    process.env.STARTUPCREME_AUTOMATION_SECRET = 'production_super_secret_key_45678';

    const res = await fetch(`${baseUrl}/api/ai/health`, {
      headers: {
        'x-automation-secret': 'invalid_secret',
      },
    });

    assert.equal(res.status, 401, 'Unauthorized request must return 401');

    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('application/json'), `Expected application/json header, received: ${contentType}`);

    const text = await res.text();
    assert.ok(!text.includes('<!doctype html>'), 'Must NOT return HTML doctype');
    assert.ok(!text.includes('<div id="root">'), 'Must NOT return React root div');

    const body = JSON.parse(text);
    assert.equal(body.code, 'UNAUTHORIZED_AUTOMATION', 'Must return standard UNAUTHORIZED_AUTOMATION error');

    // Reset NODE_ENV
    process.env.NODE_ENV = 'test';
  });

  test('Protected AI endpoints enforce automation authentication', async () => {
    process.env.NODE_ENV = 'production';
    process.env.STARTUPCREME_AUTOMATION_SECRET = 'production_super_secret_key_45678';

    const res = await fetch(`${baseUrl}/api/ai/tasks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ type: 'research_topic', title: 'Test Task' }),
    });

    assert.equal(res.status, 401, 'Unauthenticated task creation must return 401');
    const body = await res.json();
    assert.equal(body.code, 'UNAUTHORIZED_AUTOMATION');

    process.env.NODE_ENV = 'test';
  });
});
