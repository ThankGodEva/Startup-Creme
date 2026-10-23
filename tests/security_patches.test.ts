import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { aiRouter } from '../src/server/aiRouter';
import { expansionRouter } from '../src/server/expansionRouter';
import { AIErrorCodes } from '../src/ai/server/automationContract';

describe('Security Patch 1: Verified Security Fixes Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());

    // Mount middleware that simulates an authenticated admin session if x-test-session: admin is present
    app.use((req, _res, next) => {
      if (req.headers['x-test-session'] === 'admin') {
        (req as any).user = { id: 'admin-123', role: 'admin', email: 'admin@startupcreme.com' };
      } else if (req.headers['x-test-session'] === 'user') {
        (req as any).user = { id: 'user-456', role: 'user', email: 'user@startupcreme.com' };
      }
      next();
    });

    app.use('/api/ai', aiRouter);
    app.use('/api', expansionRouter);

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

  // ====================================================================
  // Finding A: AI Automation Authentication
  // ====================================================================
  describe('Finding A: AI Automation & M2M Authentication', () => {
    const originalSecret = process.env.STARTUPCREME_AUTOMATION_SECRET;

    after(() => {
      process.env.STARTUPCREME_AUTOMATION_SECRET = originalSecret;
    });

    test('Header "x-admin-role: admin" alone CANNOT bypass authentication (returns 401)', async () => {
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'secure_prod_secret_9988';

      const res = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET',
        headers: {
          'x-admin-role': 'admin'
        }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
      assert.match(data.error, /Unauthorized/);
    });

    test('Header "x-admin-role: admin" combined with random fake token is rejected with 401', async () => {
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'secure_prod_secret_9988';

      const res = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET',
        headers: {
          'x-admin-role': 'admin',
          'Authorization': 'Bearer attacker_fake_token'
        }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
    });

    test('Missing secret fails closed: when STARTUPCREME_AUTOMATION_SECRET is unset, M2M requests return 401', async () => {
      delete process.env.STARTUPCREME_AUTOMATION_SECRET;

      const res = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer any_token_at_all'
        }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
    });

    test('Placeholder secret fails closed: when STARTUPCREME_AUTOMATION_SECRET is default placeholder, returns 401', async () => {
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'your_m2m_automation_secret_key';

      const res = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer your_m2m_automation_secret_key'
        }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
    });

    test('Invalid M2M token is rejected with 401', async () => {
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'configured_strong_secret_xyz';

      const res = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer wrong_secret'
        }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
    });

    test('Valid M2M token in Authorization Bearer succeeds with 200', async () => {
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'configured_strong_secret_xyz';

      const res = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer configured_strong_secret_xyz'
        }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'healthy');
    });

    test('Valid M2M token in x-automation-secret header succeeds with 200', async () => {
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'configured_strong_secret_xyz';

      const res = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET',
        headers: {
          'x-automation-secret': 'configured_strong_secret_xyz'
        }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'healthy');
    });

    test('Legitimate pre-authenticated admin user session is granted access', async () => {
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'configured_strong_secret_xyz';

      // Simulates request authenticated by session middleware setting req.user.role = 'admin'
      const res = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET',
        headers: {
          'x-test-session': 'admin'
        }
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'healthy');
    });

    test('Pre-authenticated non-admin user session is rejected with 401', async () => {
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'configured_strong_secret_xyz';

      const res = await fetch(`${baseUrl}/api/ai/health`, {
        method: 'GET',
        headers: {
          'x-test-session': 'user'
        }
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
    });
  });

  // ====================================================================
  // Finding B: Events Webhook Authentication
  // ====================================================================
  describe('Finding B: Events Webhook Token Authentication', () => {
    const envBackup = {
      N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET,
      EVENT_WEBHOOK_SECRET: process.env.EVENT_WEBHOOK_SECRET,
      N8N_BEARER_TOKEN: process.env.N8N_BEARER_TOKEN,
      EVENTS_API_BEARER_TOKEN: process.env.EVENTS_API_BEARER_TOKEN,
      STARTUPCREME_AUTOMATION_SECRET: process.env.STARTUPCREME_AUTOMATION_SECRET
    };

    const clearAllWebhookSecrets = () => {
      delete process.env.N8N_WEBHOOK_SECRET;
      delete process.env.EVENT_WEBHOOK_SECRET;
      delete process.env.N8N_BEARER_TOKEN;
      delete process.env.EVENTS_API_BEARER_TOKEN;
      delete process.env.STARTUPCREME_AUTOMATION_SECRET;
    };

    after(() => {
      Object.assign(process.env, envBackup);
    });

    test('Hardcoded fallback secret "startupcreme-n8n-events-secret-2026" is strictly REJECTED (returns 401)', async () => {
      clearAllWebhookSecrets();

      const res = await fetch(`${baseUrl}/api/events/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer startupcreme-n8n-events-secret-2026'
        },
        body: JSON.stringify({ event_title: 'Test' })
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.match(data.error, /Unauthorized: Missing or invalid Bearer token/);
    });

    test('Webhook authentication fails closed when no environment secrets are configured', async () => {
      clearAllWebhookSecrets();

      const res = await fetch(`${baseUrl}/api/events/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer any_secret_whatsoever'
        },
        body: JSON.stringify({ event_title: 'Test' })
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    test('Webhook request missing Authorization header is rejected with 401', async () => {
      process.env.N8N_WEBHOOK_SECRET = 'valid_secret_abc123';

      const res = await fetch(`${baseUrl}/api/events/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ event_title: 'Test' })
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    test('Webhook request with invalid Bearer token is rejected with 401', async () => {
      process.env.N8N_WEBHOOK_SECRET = 'valid_secret_abc123';

      const res = await fetch(`${baseUrl}/api/events/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid_wrong_token'
        },
        body: JSON.stringify({ event_title: 'Test' })
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });

    test('Valid N8N_WEBHOOK_SECRET is accepted (passes auth stage to payload validation)', async () => {
      clearAllWebhookSecrets();
      process.env.N8N_WEBHOOK_SECRET = 'valid_n8n_secret_999';

      const res = await fetch(`${baseUrl}/api/events/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_n8n_secret_999'
        },
        body: JSON.stringify({}) // Empty body to trigger payload validation (which proves auth succeeded)
      });

      // 400 Bad Request proves authentication PASSED and was not 401 Unauthorized
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Payload validation failed/);
    });

    test('Valid EVENT_WEBHOOK_SECRET is accepted', async () => {
      clearAllWebhookSecrets();
      process.env.EVENT_WEBHOOK_SECRET = 'valid_event_secret_888';

      const res = await fetch(`${baseUrl}/api/events/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_event_secret_888'
        },
        body: JSON.stringify({})
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Payload validation failed/);
    });

    test('Valid N8N_BEARER_TOKEN is accepted', async () => {
      clearAllWebhookSecrets();
      process.env.N8N_BEARER_TOKEN = 'valid_bearer_token_777';

      const res = await fetch(`${baseUrl}/api/events/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_bearer_token_777'
        },
        body: JSON.stringify({})
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Payload validation failed/);
    });

    test('Valid EVENTS_API_BEARER_TOKEN is accepted', async () => {
      clearAllWebhookSecrets();
      process.env.EVENTS_API_BEARER_TOKEN = 'valid_events_api_token_666';

      const res = await fetch(`${baseUrl}/api/events/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_events_api_token_666'
        },
        body: JSON.stringify({})
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Payload validation failed/);
    });

    test('Valid STARTUPCREME_AUTOMATION_SECRET is accepted', async () => {
      clearAllWebhookSecrets();
      process.env.STARTUPCREME_AUTOMATION_SECRET = 'valid_startupcreme_secret_555';

      const res = await fetch(`${baseUrl}/api/events/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_startupcreme_secret_555'
        },
        body: JSON.stringify({})
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Payload validation failed/);
    });

    test('Legitimate server-authenticated admin is authorized to manually publish an event (returns 200)', async () => {
      clearAllWebhookSecrets();

      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-session': 'admin',
        },
        body: JSON.stringify({
          title: 'Manual Admin Opportunity Test 2026',
          application_url: 'https://startupcreme.com/apply/test-opp-2026',
          opportunity_type: 'grant',
          funding_amount: '$75,000',
          location: 'Global (Remote)',
          deadline_date: '2026-12-31',
          description: 'A manually published grant opportunity created by an admin editor.',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.data.event_title, 'Manual Admin Opportunity Test 2026');

      // Clean up test event and linked article immediately so mock data is not left in the DB
      if (data.data?.event_id) {
        await fetch(`${baseUrl}/api/events/${encodeURIComponent(data.data.event_id)}`, {
          method: 'DELETE',
          headers: {
            'x-test-session': 'admin',
          },
        });
      }
    });

    test('Ordinary user (role: "user") cannot manually publish an event (returns 401)', async () => {
      clearAllWebhookSecrets();

      const res = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-session': 'user',
        },
        body: JSON.stringify({
          title: 'Unauthorized Event Post',
          application_url: 'https://example.com/unauthorized-event',
        }),
      });

      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.success, false);
    });
  });

  // ====================================================================
  // Security Patch 2: Authorization Hardening Suite
  // ====================================================================
  describe('Security Patch 2: Authorization Hardening Suite', () => {
    // ------------------------------------------------------------------
    // Finding A: resolveRequestUser & Route-Level Guard Hardening
    // ------------------------------------------------------------------
    describe('Finding A: resolveRequestUser & Route-Level Guard Hardening', () => {
      test('Forged "x-user-role: admin" header is strictly rejected on startup approval (returns 403)', async () => {
        const res = await fetch(`${baseUrl}/api/directory/st-123/approve`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': 'admin',
            'x-user-id': 'attacker-id-001'
          },
          body: JSON.stringify({ is_approved: true })
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.code, 'ADMIN_PRIVILEGES_REQUIRED');
      });

      test('Forged "userRole: admin" in request body is strictly rejected on startup approval (returns 403)', async () => {
        const res = await fetch(`${baseUrl}/api/directory/st-123/approve`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            is_approved: true,
            userRole: 'admin',
            userId: 'attacker-id-002'
          })
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.code, 'ADMIN_PRIVILEGES_REQUIRED');
      });

      test('Non-UUID user ID in header/body cannot bypass authorization or gain admin privileges (returns 403)', async () => {
        const res = await fetch(`${baseUrl}/api/directory/st-123/approve`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'custom-non-uuid-admin-bypass',
            'x-user-role': 'admin'
          },
          body: JSON.stringify({ is_approved: true })
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.code, 'ADMIN_PRIVILEGES_REQUIRED');
      });

      test('Unauthenticated callers cannot approve startups (PATCH /api/directory/:id/approve returns 403)', async () => {
        const res = await fetch(`${baseUrl}/api/directory/st-123/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_approved: true })
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.code, 'ADMIN_PRIVILEGES_REQUIRED');
      });

      test('Unauthenticated callers cannot delete startups (DELETE /api/directory/:id returns 403)', async () => {
        const res = await fetch(`${baseUrl}/api/directory/st-123`, {
          method: 'DELETE'
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.code, 'ADMIN_PRIVILEGES_REQUIRED');
      });

      test('Unauthenticated callers cannot approve job listings (PATCH /api/careers/:id/approve returns 403)', async () => {
        const res = await fetch(`${baseUrl}/api/careers/job-123/approve`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true })
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.code, 'ADMIN_PRIVILEGES_REQUIRED');
      });

      test('Unauthenticated callers cannot delete job listings (DELETE /api/careers/:id returns 403)', async () => {
        const res = await fetch(`${baseUrl}/api/careers/job-123`, {
          method: 'DELETE'
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.code, 'ADMIN_PRIVILEGES_REQUIRED');
      });

      test('Unauthenticated callers cannot delete events (DELETE /api/events/:id returns 403)', async () => {
        const res = await fetch(`${baseUrl}/api/events/ev-123`, {
          method: 'DELETE'
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.code, 'ADMIN_PRIVILEGES_REQUIRED');
      });

      test('Verified ordinary user (role: "user") cannot approve or delete resources (returns 403)', async () => {
        const resApprove = await fetch(`${baseUrl}/api/directory/st-123/approve`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-test-session': 'user'
          },
          body: JSON.stringify({ is_approved: true })
        });
        assert.equal(resApprove.status, 403);

        const resDelete = await fetch(`${baseUrl}/api/directory/st-123`, {
          method: 'DELETE',
          headers: { 'x-test-session': 'user' }
        });
        assert.equal(resDelete.status, 403);
      });

      test('Legitimate server-authenticated admin (role: "admin") is permitted to approve startups (returns 200)', async () => {
        const res = await fetch(`${baseUrl}/api/directory/st-123/approve`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-test-session': 'admin'
          },
          body: JSON.stringify({ is_approved: true })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
      });
    });

    // ------------------------------------------------------------------
    // Finding B: Supabase Authoritative Role Verification & user_metadata Elimination
    // ------------------------------------------------------------------
    describe('Finding B: Supabase Authoritative Role Verification & user_metadata Elimination', () => {
      let mockSupabaseServer: http.Server;
      let mockSupabaseUrl: string;
      let mockUserMetadataRole = 'admin';
      let mockDbRole = 'user';
      let mockDbFail = false;

      const originalEnv = {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        STARTUPCREME_AUTOMATION_SECRET: process.env.STARTUPCREME_AUTOMATION_SECRET,
      };

      before(async () => {
        await new Promise<void>((resolve) => {
          mockSupabaseServer = http.createServer((req, res) => {
            const url = req.url || '';

            // Handle Supabase Auth /auth/v1/user
            if (url.startsWith('/auth/v1/user')) {
              const authHeader = req.headers.authorization;
              if (authHeader === 'Bearer valid-user-token') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(
                  JSON.stringify({
                    id: '11111111-2222-3333-4444-555555555555',
                    email: 'testuser@startupcreme.com',
                    user_metadata: { role: mockUserMetadataRole },
                  })
                );
              }
              res.writeHead(401, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ message: 'Invalid JWT' }));
            }

            // Handle Supabase DB REST /rest/v1/users
            if (url.startsWith('/rest/v1/users')) {
              if (mockDbFail) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ message: 'Database connection failed' }));
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              return res.end(
                JSON.stringify({
                  id: '11111111-2222-3333-4444-555555555555',
                  role: mockDbRole,
                })
              );
            }

            res.writeHead(404);
            res.end();
          });

          mockSupabaseServer.listen(0, '127.0.0.1', () => {
            const address = mockSupabaseServer.address();
            if (address && typeof address === 'object') {
              mockSupabaseUrl = `http://127.0.0.1:${address.port}`;
            }
            resolve();
          });
        });
      });

      after(async () => {
        Object.assign(process.env, originalEnv);
        if (mockSupabaseServer) {
          await new Promise<void>((resolve) => mockSupabaseServer.close(() => resolve()));
        }
      });

      test('[Mocked Supabase Auth] User with editable user_metadata.role="admin" but database role="user" is strictly denied in AI endpoint (returns 401)', async () => {
        process.env.SUPABASE_URL = mockSupabaseUrl;
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-test';
        process.env.SUPABASE_ANON_KEY = 'valid-anon-key-test';
        delete process.env.STARTUPCREME_AUTOMATION_SECRET;

        mockUserMetadataRole = 'admin'; // User set their own metadata to admin
        mockDbRole = 'user'; // Authoritative DB role is only 'user'
        mockDbFail = false;

        const res = await fetch(`${baseUrl}/api/ai/health`, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid-user-token'
          }
        });

        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
      });

      test('[Mocked Supabase Auth] User with editable user_metadata.role="admin" but database role="user" is strictly denied in directory approval (returns 403)', async () => {
        process.env.SUPABASE_URL = mockSupabaseUrl;
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-test';
        process.env.SUPABASE_ANON_KEY = 'valid-anon-key-test';

        mockUserMetadataRole = 'admin';
        mockDbRole = 'user';
        mockDbFail = false;

        const res = await fetch(`${baseUrl}/api/directory/st-123/approve`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid-user-token'
          },
          body: JSON.stringify({ is_approved: true })
        });

        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.code, 'ADMIN_PRIVILEGES_REQUIRED');
      });

      test('[Mocked Supabase Auth] Database role lookup failure fails closed and denies admin access (returns 401)', async () => {
        process.env.SUPABASE_URL = mockSupabaseUrl;
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-test';
        process.env.SUPABASE_ANON_KEY = 'valid-anon-key-test';
        delete process.env.STARTUPCREME_AUTOMATION_SECRET;

        mockUserMetadataRole = 'admin';
        mockDbRole = 'admin';
        mockDbFail = true; // DB fails

        const res = await fetch(`${baseUrl}/api/ai/health`, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid-user-token'
          }
        });

        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
      });

      test('[Mocked Supabase Auth] Missing service role key fails closed and denies admin access even with valid token (returns 401)', async () => {
        process.env.SUPABASE_URL = mockSupabaseUrl;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SERVICE_ROLE_KEY;
        process.env.SUPABASE_ANON_KEY = 'valid-anon-key-test';
        delete process.env.STARTUPCREME_AUTOMATION_SECRET;

        mockUserMetadataRole = 'admin';
        mockDbRole = 'admin';
        mockDbFail = false;

        const res = await fetch(`${baseUrl}/api/ai/health`, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid-user-token'
          }
        });

        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.code, AIErrorCodes.UNAUTHORIZED_AUTOMATION);
      });

      test('[Mocked Supabase Auth] Legitimate database-authorized admin (startupcreme.users.role="admin") succeeds with 200', async () => {
        process.env.SUPABASE_URL = mockSupabaseUrl;
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'valid-service-role-key-test';
        process.env.SUPABASE_ANON_KEY = 'valid-anon-key-test';
        delete process.env.STARTUPCREME_AUTOMATION_SECRET;

        mockUserMetadataRole = 'admin';
        mockDbRole = 'admin'; // Both or DB alone is admin
        mockDbFail = false;

        const res = await fetch(`${baseUrl}/api/ai/health`, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer valid-user-token'
          }
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, 'healthy');
      });
    });
  });
});

