import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createApp } from '../server/app';

describe('Editorial Draft Ingestion API Suite (POST /api/editorial/drafts)', () => {
  let server: http.Server;
  let baseUrl: string;

  const TEST_EDITORIAL_SECRET = 'test_editorial_secret_key_8899aabbcc';

  const originalEnv = {
    N8N_EDITORIAL_SECRET: process.env.N8N_EDITORIAL_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  };

  before(async () => {
    process.env.N8N_EDITORIAL_SECRET = TEST_EDITORIAL_SECRET;

    const app = createApp({ serveHtml: false });

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
    Object.assign(process.env, originalEnv);
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // ====================================================================
  // 1. Authentication Tests
  // ====================================================================
  describe('Authentication & Machine-to-Machine Secret Verification', () => {
    test('Missing Authorization header is strictly rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Article' }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, 'UNAUTHORIZED_EDITORIAL');
    });

    test('Invalid Bearer token is strictly rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer wrong_invalid_secret_token',
        },
        body: JSON.stringify({ title: 'Test Article' }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, 'UNAUTHORIZED_EDITORIAL');
    });

    test('Legacy events fallback secret is strictly rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer startupcreme-n8n-events-secret-2026',
        },
        body: JSON.stringify({ title: 'Test Article' }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, 'UNAUTHORIZED_EDITORIAL');
      assert.match(data.error, /legacy events secret cannot be used/i);
    });

    test('Missing N8N_EDITORIAL_SECRET environment variable fails closed with 401', async () => {
      delete process.env.N8N_EDITORIAL_SECRET;

      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({ title: 'Test Article' }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, 'UNAUTHORIZED_EDITORIAL');

      process.env.N8N_EDITORIAL_SECRET = TEST_EDITORIAL_SECRET;
    });

    test('Placeholder N8N_EDITORIAL_SECRET environment variable fails closed with 401', async () => {
      process.env.N8N_EDITORIAL_SECRET = 'your_n8n_editorial_secret_key';

      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer your_n8n_editorial_secret_key',
        },
        body: JSON.stringify({ title: 'Test Article' }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, 'UNAUTHORIZED_EDITORIAL');

      process.env.N8N_EDITORIAL_SECRET = TEST_EDITORIAL_SECRET;
    });

    test('Valid N8N_EDITORIAL_SECRET token in Authorization Bearer succeeds', async () => {
      process.env.N8N_EDITORIAL_SECRET = TEST_EDITORIAL_SECRET;

      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({}), // empty body to trigger payload validation (proves auth passed)
      });

      assert.equal(res.status, 400); // 400 proves auth succeeded and reached payload validation
      const data = await res.json();
      assert.equal(data.code, 'VALIDATION_ERROR');
    });
  });

  // ====================================================================
  // 2. Publication Immunity & Status Invariant Tests
  // ====================================================================
  describe('Publication Status Invariant & Immunity', () => {
    test('Submitting status: "published" is strictly rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({
          title: 'Autonomous System Infrastructure',
          slug: 'autonomous-system-infra',
          vertical: 'tech',
          content: '<p>Complete article content with sufficient length for validation.</p>',
          status: 'published',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'STATUS_OVERRIDE_FORBIDDEN');
      assert.match(data.error, /cannot specify or override publication status/i);
    });

    test('Submitting status: "draft" in request body is also rejected with HTTP 400', async () => {
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({
          title: 'Autonomous System Infrastructure',
          slug: 'autonomous-system-infra-draft-field',
          vertical: 'tech',
          content: '<p>Complete article content with sufficient length for validation.</p>',
          status: 'draft',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'STATUS_OVERRIDE_FORBIDDEN');
    });

    test('Valid draft submission is stored with status: "draft" hardcoded server-side', async () => {
      const uniqueSlug = `fintech-ledger-settlement-${Date.now()}`;
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({
          title: 'Distributed Clearing & Real-Time Gross Settlement Architecture',
          slug: uniqueSlug,
          vertical: 'finance',
          locale: 'en-us',
          excerpt: 'Analysis of sub-second ledger reconciliation across cross-border banking nodes.',
          content: '<h2>Introduction</h2><p>Modern fintech platforms require deterministic clearing protocols to mitigate foreign exchange float risk.</p>',
          cover_image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200',
          tags: ['Fintech', 'Treasury', 'Banking'],
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.action, 'created');
      assert.equal(data.post.status, 'draft');
      assert.equal(data.post.slug, uniqueSlug);
      assert.equal(data.post.vertical, 'finance');
      assert.match(data.editorial_urls.cms_editor_url, /\/admin\?tab=posts&edit=/);
    });
  });

  // ====================================================================
  // 3. Schema & Field Validation Tests
  // ====================================================================
  describe('Schema & Field Validation', () => {
    test('Missing required fields (title, slug, vertical, content) are rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({
          title: 'Short',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'VALIDATION_ERROR');
    });

    test('Invalid vertical (e.g., "crypto", "marketing") is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({
          title: 'Crypto Arbitrage Strategies in Decentralized Pools',
          slug: 'crypto-arbitrage-strategies',
          vertical: 'crypto', // Invalid: only 'finance' | 'tech' allowed
          content: '<p>Content with at least twenty characters of text.</p>',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'VALIDATION_ERROR');
      assert.match(JSON.stringify(data.details), /finance.*tech/i);
    });

    test('Invalid slug format (spaces, uppercase, symbols) is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({
          title: 'Invalid Slug Format Test Article Title',
          slug: 'Invalid Slug With Spaces & Special!',
          vertical: 'tech',
          content: '<p>Content with at least twenty characters of text.</p>',
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'VALIDATION_ERROR');
    });

    test('Insecure non-HTTPS cover image URL is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({
          title: 'Insecure Image Protocol Test Article Title',
          slug: 'insecure-image-protocol-test',
          vertical: 'tech',
          content: '<p>Content with at least twenty characters of text.</p>',
          cover_image: 'http://insecure-cdn.com/banner.jpg', // HTTP rejected
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'VALIDATION_ERROR');
      assert.match(JSON.stringify(data.details), /HTTPS/);
    });
  });

  // ====================================================================
  // 4. Idempotency & Conflict Tests
  // ====================================================================
  describe('Idempotency & Collision Protection', () => {
    test('First valid submission creates a draft and returns 201', async () => {
      const key = `idem-key-${Date.now()}-1`;
      const slug = `idempotent-article-${Date.now()}`;

      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          title: 'High-Throughput Order Matching Engine Architecture',
          slug,
          vertical: 'tech',
          content: '<h2>Matching Core</h2><p>LMAX disruptor pattern utilizing zero-allocation ring buffers in memory.</p>',
        }),
      });

      assert.equal(res.status, 201);
      const data = await res.json();
      assert.equal(data.action, 'created');
      assert.equal(data.idempotency.replayed, false);
      assert.equal(data.idempotency.key, key);
    });

    test('Identical retry with same idempotency key returns 200 OK without duplicating write', async () => {
      const key = `idem-key-${Date.now()}-2`;
      const slug = `idempotent-replay-${Date.now()}`;

      const payload = {
        title: 'High-Throughput Order Matching Engine Architecture',
        slug,
        vertical: 'tech',
        content: '<h2>Matching Core</h2><p>LMAX disruptor pattern utilizing zero-allocation ring buffers in memory.</p>',
      };

      // 1. Initial Submission
      const firstRes = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
          'Idempotency-Key': key,
        },
        body: JSON.stringify(payload),
      });
      assert.equal(firstRes.status, 201);
      const firstData = await firstRes.json();

      // 2. Exact Identical Retry
      const retryRes = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
          'Idempotency-Key': key,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(retryRes.status, 200);
      const retryData = await retryRes.json();
      assert.equal(retryData.action, 'replayed');
      assert.equal(retryData.idempotency.replayed, true);
      assert.equal(retryData.idempotency.key, key);
      assert.equal(retryData.post.slug, slug);
      assert.equal(retryData.post.id, firstData.post.id);
    });

    test('Reusing an idempotency key with different payload returns 409 Conflict', async () => {
      const key = `idem-key-${Date.now()}-3`;
      const slug = `idempotent-diff-${Date.now()}`;

      // 1. First submission
      const firstRes = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          title: 'Initial Article Title for Key Re-use',
          slug,
          vertical: 'tech',
          content: '<p>Initial content for this idempotency key test.</p>',
        }),
      });
      assert.equal(firstRes.status, 201);

      // 2. Re-using same key with altered title and content
      const conflictRes = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          title: 'Completely Altered Title with Re-used Key',
          slug,
          vertical: 'tech',
          content: '<p>Different content attempting to overwrite using the same key.</p>',
        }),
      });

      assert.equal(conflictRes.status, 409);
      const conflictData = await conflictRes.json();
      assert.equal(conflictData.code, 'IDEMPOTENCY_PAYLOAD_MISMATCH');
    });

    test('Duplicate slug with different idempotency key returns 409 Conflict', async () => {
      const slug = `shared-slug-${Date.now()}`;

      // 1. First draft
      const firstRes = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
          'Idempotency-Key': `key-a-${Date.now()}`,
        },
        body: JSON.stringify({
          title: 'Original Draft on Shared Slug',
          slug,
          vertical: 'finance',
          content: '<p>Content for the original draft in the database.</p>',
        }),
      });
      assert.equal(firstRes.status, 201);

      // 2. Second submission with same slug but different key
      const secondRes = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
          'Idempotency-Key': `key-b-${Date.now()}`,
        },
        body: JSON.stringify({
          title: 'Colliding Draft with Same Slug',
          slug,
          vertical: 'finance',
          content: '<p>Content attempting to collide with original slug.</p>',
        }),
      });

      assert.equal(secondRes.status, 409);
      const secondData = await secondRes.json();
      assert.match(secondData.code, /(DRAFT_COLLISION|DUPLICATE_SLUG)/);
    });

    test('Concurrent duplicate requests execute safely without duplicate drafts', async () => {
      const key = `concurrent-key-${Date.now()}`;
      const slug = `concurrent-slug-${Date.now()}`;

      const payload = {
        title: 'Concurrent Execution Thread Safety Test',
        slug,
        vertical: 'finance',
        content: '<p>Concurrent payload testing race condition prevention.</p>',
      };

      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/api/editorial/drafts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
            'Idempotency-Key': key,
          },
          body: JSON.stringify(payload),
        }),
        fetch(`${baseUrl}/api/editorial/drafts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
            'Idempotency-Key': key,
          },
          body: JSON.stringify(payload),
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // One request should create (201) and the concurrent one should replay (200)
      assert.deepEqual(statuses, [200, 201]);
    });
  });

  // ====================================================================
  // 5. Database Interaction & Published Post Collision (Mocked Supabase)
  // ====================================================================
  describe('Database Resilience & Published Post Immunity', () => {
    let mockDbServer: http.Server;
    let mockDbUrl: string;
    let mockExistingPostStatus: 'published' | 'draft' | null = 'published';
    let mockDbFail = false;

    before(async () => {
      await new Promise<void>((resolve) => {
        mockDbServer = http.createServer((req, res) => {
          const url = req.url || '';

          if (mockDbFail) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: 'Internal database connection failure' }));
          }

          if (url.startsWith('/rest/v1/posts')) {
            if (mockExistingPostStatus) {
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Content-Range': '0-0/1',
              });
              return res.end(
                JSON.stringify({
                  id: 'published-uuid-9999-8888-7777',
                  slug: 'already-published-fintech-article',
                  vertical: 'finance',
                  locale: 'en-us',
                  title: 'Verified Published Article on Stripe',
                  status: mockExistingPostStatus,
                  updated_at: '2026-10-10T12:00:00.000Z',
                })
              );
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end('[]');
          }

          if (url.startsWith('/rest/v1/editorial_idempotency')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end('[]');
          }

          res.writeHead(404);
          res.end();
        });

        mockDbServer.listen(0, '127.0.0.1', () => {
          const address = mockDbServer.address();
          if (address && typeof address === 'object') {
            mockDbUrl = `http://127.0.0.1:${address.port}`;
          }
          resolve();
        });
      });
    });

    after(async () => {
      if (mockDbServer) {
        await new Promise<void>((resolve) => mockDbServer.close(() => resolve()));
      }
    });

    test('Colliding with an already published article returns 409 and never modifies published post', async () => {
      process.env.SUPABASE_URL = mockDbUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-test';
      mockExistingPostStatus = 'published';
      mockDbFail = false;

      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({
          title: 'Attempting to Overwrite Published Article',
          slug: 'already-published-fintech-article',
          vertical: 'finance',
          content: '<p>Content attempting to overwrite the published post.</p>',
        }),
      });

      assert.equal(res.status, 409);
      const data = await res.json();
      assert.equal(data.code, 'PUBLISHED_ARTICLE_COLLISION');
      assert.match(data.error, /already published/i);
    });

    test('Database failure returns safe error without leaking credentials', async () => {
      process.env.SUPABASE_URL = mockDbUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'super-secret-service-role-key-12345';
      mockDbFail = true;

      const res = await fetch(`${baseUrl}/api/editorial/drafts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_EDITORIAL_SECRET}`,
        },
        body: JSON.stringify({
          title: 'Article During Database Failure',
          slug: 'db-failure-article-test',
          vertical: 'finance',
          content: '<p>Content being submitted while database is unavailable.</p>',
        }),
      });

      assert.equal(res.status, 500);
      const data = await res.json();
      assert.equal(data.code, 'DATABASE_ERROR');
      // Assert that no secret keys leaked in error message or payload
      const responseText = JSON.stringify(data);
      assert.equal(responseText.includes('super-secret-service-role-key-12345'), false);
      assert.equal(responseText.includes(TEST_EDITORIAL_SECRET), false);
    });
  });
});
