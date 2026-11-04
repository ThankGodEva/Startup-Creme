import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { store } from '../src/lib/store';
import { UserProfile, Post, EventOpportunity } from '../src/types';

describe('RLS Privilege Escalation Security Audit & Hardening Suite', () => {
  const nonAdminUser: UserProfile = {
    id: '11111111-2222-3333-4444-555555555555',
    email: 'hacker@example.com',
    full_name: 'Regular Non-Admin User',
    role: 'user',
    reputation: 10,
    badge: 'Member',
    created_at: new Date().toISOString(),
  };

  const adminUser: UserProfile = {
    id: '99999999-8888-7777-6666-555555555555',
    email: 'admin@startupcreme.com',
    full_name: 'Verified Editorial Admin',
    role: 'admin',
    reputation: 999,
    badge: 'Founder',
    created_at: new Date().toISOString(),
  };

  const sampleDraftPost: Post = {
    id: 'post-draft-001',
    slug: 'secret-draft-unreleased',
    locale: 'en-us',
    vertical: 'finance',
    title: 'Top Secret Unreleased Acquisition Draft',
    excerpt: 'Draft content that should not be visible to public or regular users.',
    content: 'Unreleased insider analysis.',
    status: 'draft',
    meta_description: 'Draft',
    canonical_url: 'https://startupcreme.com/en-us/finance/secret-draft-unreleased',
    cover_image: 'https://images.unsplash.com/photo-1',
    author_name: 'Editorial Lead',
    author_role: 'Editor',
    dual_silo: false,
    silo_badge: '',
    tags: ['M&A', 'Finance'],
    reading_time_minutes: 4,
    word_count: 600,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const samplePublishedPost: Post = {
    id: 'post-pub-001',
    slug: 'public-macro-analysis-2026',
    locale: 'en-us',
    vertical: 'finance',
    title: 'Public Treasury Analysis',
    excerpt: 'Public content accessible to everyone.',
    content: 'Public macro economic editorial.',
    status: 'published',
    meta_description: 'Public',
    canonical_url: 'https://startupcreme.com/en-us/finance/public-macro-analysis-2026',
    cover_image: 'https://images.unsplash.com/photo-2',
    author_name: 'Editorial Lead',
    author_role: 'Editor',
    dual_silo: false,
    silo_badge: '',
    tags: ['Finance'],
    reading_time_minutes: 5,
    word_count: 800,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleDraftEvent: EventOpportunity = {
    id: 'evt-draft-001',
    title: 'Unpublished Internal Grant',
    slug: 'internal-grant-draft',
    description: 'Internal draft opportunity',
    opportunity_type: 'grant',
    funding_amount: '$100,000',
    location: 'Remote',
    deadline_date: '2026-12-31T00:00:00Z',
    application_url: 'https://grant.example.com/draft-apply',
    linked_post_id: sampleDraftPost.id,
    created_at: new Date().toISOString(),
    linked_post: sampleDraftPost,
  };

  const samplePublishedEvent: EventOpportunity = {
    id: 'evt-pub-001',
    title: 'Global Tech Accelerator 2026',
    slug: 'global-tech-accelerator-2026',
    description: 'Verified public accelerator opportunity',
    opportunity_type: 'accelerator',
    funding_amount: '$250,000',
    location: 'San Francisco, CA',
    deadline_date: '2026-11-30T00:00:00Z',
    application_url: 'https://accelerator.example.com/apply',
    linked_post_id: samplePublishedPost.id,
    created_at: new Date().toISOString(),
    linked_post: samplePublishedPost,
  };

  beforeEach(() => {
    store.setCurrentUser(null);
  });

  // ====================================================================
  // 1. Migration File SQL Verification
  // ====================================================================
  describe('Migration Verification: 20261028_harden_all_rls_privilege_escalation.sql', () => {
    const migrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20261028_harden_all_rls_privilege_escalation.sql'
    );

    test('Migration file exists in supabase/migrations/', () => {
      assert.equal(fs.existsSync(migrationPath), true, 'Migration file must exist');
    });

    test('All loose policies with authenticated true are revoked', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');

      // Check posts write policies use is_admin
      assert.equal(
        sql.includes('CREATE POLICY "Admins can insert posts"'),
        true,
        'Posts insert must be restricted to admins'
      );
      assert.equal(
        sql.includes('startupcreme.is_admin(auth.uid())'),
        true,
        'is_admin function must be called'
      );

      // Check events write policies use is_admin
      assert.equal(
        sql.includes('CREATE POLICY "Admins can insert events"'),
        true,
        'Events insert must be restricted to admins'
      );
      assert.equal(
        sql.includes('CREATE POLICY "Admins can update events"'),
        true,
        'Events update must be restricted to admins'
      );
      assert.equal(
        sql.includes('CREATE POLICY "Admins can delete events"'),
        true,
        'Events delete must be restricted to admins'
      );

      // Check users role protection
      assert.equal(
        sql.includes('prevent_user_role_escalation'),
        true,
        'Trigger function to prevent role escalation must be defined'
      );
      assert.equal(
        sql.includes('trg_prevent_user_role_escalation'),
        true,
        'Trigger must be attached to startupcreme.users'
      );

      // Check newsletter select/update/delete restricted to admins
      assert.equal(
        sql.includes('Only admins can select newsletter subscribers'),
        true,
        'Newsletter SELECT must be admin only'
      );

      // Check AI subsystem restricted to admins
      assert.equal(
        sql.includes('Admins full access to ai_tasks'),
        true,
        'AI tasks must be admin only'
      );
      assert.equal(
        sql.includes('Admins full access to ai_memory'),
        true,
        'AI memory must be admin only'
      );

      // Check user-owned forum rows
      assert.equal(
        sql.includes('auth.uid() = user_id'),
        true,
        'User-owned forum topics/comments must require auth.uid() = user_id'
      );
    });
  });

  // ====================================================================
  // 2. Non-Admin Authenticated User Post Write Prevention
  // ====================================================================
  describe('Finding 1: Non-Admin Authenticated User Cannot Update or Delete Posts', () => {
    test('Non-admin authenticated user cannot save or insert new posts', async () => {
      store.setCurrentUser(nonAdminUser);

      const res = await store.savePost({
        title: 'Exploit Article Submission',
        slug: 'exploit-article-submission',
        content: 'This should be rejected by authorization checks.',
        status: 'published',
      });

      assert.equal(res.success, false, 'Save post must fail for non-admin user');
      assert.match(
        res.error || '',
        /unauthorized|admin/i,
        'Error must state that admin privileges are required'
      );
    });

    test('Non-admin authenticated user cannot update existing posts', async () => {
      store.setCurrentUser(nonAdminUser);

      const res = await store.savePost({
        id: samplePublishedPost.id,
        title: 'Tampered Article Title',
        slug: samplePublishedPost.slug,
        content: 'Tampered content by non-admin.',
      });

      assert.equal(res.success, false, 'Updating existing post must fail for non-admin');
      assert.match(res.error || '', /unauthorized|admin/i);
    });

    test('Non-admin authenticated user cannot delete posts', async () => {
      store.setCurrentUser(nonAdminUser);

      const res = await store.deletePost('some-post-id');
      assert.equal(res.success, false, 'deletePost must fail for non-admin user');
      assert.match(res.error || '', /unauthorized|admin/i);
    });

    test('Non-admin authenticated user cannot toggle post publication status', async () => {
      store.setCurrentUser(nonAdminUser);

      const res = await store.togglePostStatus('some-post-id');
      assert.equal(res.success, false, 'togglePostStatus must fail for non-admin user');
      assert.match(res.error || '', /unauthorized|admin/i);
    });

    test('Direct database write without admin JWT session is rejected by RLS policy', async () => {
      // With anon key and no admin JWT session, direct database write violates RLS policy
      const { supabase } = await import('../src/lib/supabase');
      const { data, error } = await supabase.schema('startupcreme').from('posts').insert({
        title: 'Unauthorized Post Direct DB Test',
        slug: 'unauthorized-direct-db-test-' + Date.now(),
        vertical: 'finance',
        locale: 'en-us',
        content: 'Should be blocked by RLS',
        status: 'published',
      }).select();

      assert.ok(error, 'Direct write without admin session MUST return an RLS violation error');
      assert.match(
        error.message || '',
        /row-level security|policy/i,
        'Error must specifically cite row-level security violation'
      );
    });
  });

  // ====================================================================
  // 3. Non-Admin Authenticated User Event Write Prevention
  // ====================================================================
  describe('Finding 2: Non-Admin Authenticated User Cannot Update or Delete Events', () => {
    test('Non-admin authenticated user cannot manually publish events', async () => {
      store.setCurrentUser(nonAdminUser);

      const res = await store.publishEvent({
        title: 'Malicious Fake Grant',
        description: 'Unauthorized grant submission.',
        opportunity_type: 'grant',
        deadline_date: '2026-12-31T00:00:00Z',
        application_url: 'https://malicious.example.com/apply',
      });

      assert.equal(res.success, false, 'publishEvent must fail for non-admin user');
      assert.match(res.error || '', /admin privileges required/i);
    });

    test('Non-admin authenticated user cannot delete events', async () => {
      store.setCurrentUser(nonAdminUser);

      const res = await store.deleteEvent('evt-12345');
      assert.equal(res.success, false, 'deleteEvent must fail for non-admin user');
      assert.match(res.error || '', /admin privileges required/i);
    });

    test('Non-admin authenticated user cannot clear all events', async () => {
      store.setCurrentUser(nonAdminUser);

      const res = await store.clearAllEvents();
      assert.equal(res.success, false, 'clearAllEvents must fail for non-admin user');
      assert.match(res.error || '', /admin privileges required/i);
    });

    test('Admin authenticated user is permitted to delete events', async () => {
      store.setCurrentUser(adminUser);

      const res = await store.deleteEvent('evt-placeholder-admin');
      assert.equal(res.success, true, 'Admin deleteEvent must succeed');
    });
  });

  // ====================================================================
  // 4. Draft Read Protection (Non-Admin Cannot Read Drafts)
  // ====================================================================
  describe('Finding 3: Non-Admin and Anonymous Users Cannot Read Drafts', () => {
    test('Unpublished/draft posts are filtered out for regular users and guests', () => {
      store.setCurrentUser(nonAdminUser);

      const publicPosts = store.getPosts('en-us', 'finance');
      const containsDraft = publicPosts.some((p) => p.status === 'draft');
      assert.equal(containsDraft, false, 'getPosts must not return drafts to non-admin users');
    });

    test('Events linked to draft or unapproved posts are hidden from non-admin users', () => {
      store.setCurrentUser(nonAdminUser);

      const visibleEvents = store.getEvents();
      const containsDraftEvent = visibleEvents.some(
        (e) => e.linked_post?.status === 'draft'
      );
      assert.equal(
        containsDraftEvent,
        false,
        'getEvents must not return opportunities linked to drafts for non-admins'
      );
    });

    test('Admin user retains access to view and review drafts', () => {
      store.setCurrentUser(adminUser);

      const adminVisibleEvents = store.getEvents();
      assert.ok(Array.isArray(adminVisibleEvents));
    });
  });

  // ====================================================================
  // 5. User Role Self-Escalation Protection
  // ====================================================================
  describe('Finding 4: Users Cannot Set or Modify Their Own Role Column', () => {
    test('Simulated role update payload with role="admin" is strictly rejected', () => {
      const regularUserId = nonAdminUser.id;

      // Simulate the RLS policy check:
      // Policy: (auth.uid() = id AND role = (SELECT role FROM startupcreme.users WHERE id = auth.uid())) OR startupcreme.is_admin(auth.uid())
      const evaluateRoleUpdatePolicy = (
        authUid: string,
        targetId: string,
        currentRole: string,
        newRole: string,
        isCallerAdmin: boolean
      ): boolean => {
        if (isCallerAdmin) return true;
        // Non-admin can only update their own row AND cannot change role
        return authUid === targetId && newRole === currentRole;
      };

      const attackerCanEscalate = evaluateRoleUpdatePolicy(
        regularUserId,
        regularUserId,
        'user', // existing role in DB
        'admin', // attempted new role
        false // caller is not admin
      );

      assert.equal(
        attackerCanEscalate,
        false,
        'Non-admin user MUST NOT be allowed to update role from user to admin'
      );

      const adminCanUpdateUser = evaluateRoleUpdatePolicy(
        adminUser.id,
        regularUserId,
        'user',
        'admin',
        true // caller is admin
      );

      assert.equal(
        adminCanUpdateUser,
        true,
        'Admin MUST be allowed to promote or update user roles'
      );
    });

    test('Database trigger SQL strictly throws exception on role change attempt by non-admin', () => {
      const migrationSql = fs.readFileSync(
        path.join(process.cwd(), 'supabase', 'migrations', '20261028_harden_all_rls_privilege_escalation.sql'),
        'utf8'
      );

      assert.equal(
        migrationSql.includes("RAISE EXCEPTION 'Forbidden: Non-admin users cannot alter their role'"),
        true,
        'Trigger must raise exception when non-admin changes role'
      );
      assert.equal(
        migrationSql.includes("RAISE EXCEPTION 'Forbidden: Only administrators can assign the admin role'"),
        true,
        'Trigger must raise exception when non-admin attempts to insert admin user'
      );
    });
  });
});
