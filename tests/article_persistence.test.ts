import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../src/lib/store';
import { setSupabaseCredentials } from '../src/lib/supabase';
import { Post } from '../src/types';

describe('Article Persistence & Publishing Flow', () => {
  beforeEach(() => {
    // Clear credentials to isolate store logic in deterministic test mode
    setSupabaseCredentials('', '');
    (store as any).posts = [];
  });

  test('Saving a new article draft creates a single record', async () => {
    const draftPayload: Partial<Post> = {
      title: 'How Global Macro Shifts Impact Series B Valuations',
      slug: 'how-global-macro-shifts-impact-series-b-valuations',
      locale: 'en-us',
      vertical: 'finance',
      status: 'draft',
      content: '<p>Initial draft analysis of Series B market conditions.</p>',
      excerpt: 'Macro shifts and valuation multiples.',
    };

    const result = await store.savePost(draftPayload);
    assert.equal(result.success, true);
    assert.ok(result.post.id, 'Expected post to have an ID');
    assert.equal(result.post.status, 'draft');
    assert.equal(result.post.slug, 'how-global-macro-shifts-impact-series-b-valuations');

    const allPosts = store.getAllPosts();
    assert.equal(allPosts.length, 1, 'Expected exactly 1 post in store');
  });

  test('Editing and publishing an existing draft updates the record without creating a duplicate', async () => {
    // Step 1: Save initial draft
    const initialDraft: Partial<Post> = {
      title: 'The Spider Web System: How the Empire Built Wealth',
      slug: 'the-spider-web-system-how-the-empire-built-wealth',
      locale: 'en-us',
      vertical: 'finance',
      status: 'draft',
      content: '<p>Draft body paragraph.</p>',
      excerpt: 'Draft excerpt summary.',
    };

    const draftResult = await store.savePost(initialDraft);
    assert.equal(draftResult.success, true);
    const existingId = draftResult.post.id;
    assert.ok(existingId);
    assert.equal(draftResult.post.status, 'draft');

    const postsAfterDraft = store.getAllPosts();
    assert.equal(postsAfterDraft.length, 1);

    // Step 2: Edit the draft and publish it (same ID passed from editor)
    const publishedPayload: Partial<Post> = {
      ...draftResult.post,
      title: 'The Spider Web System: How the Empire Built Wealth (Final)',
      status: 'published',
      content: '<p>Updated final published content with full analysis.</p>',
      word_count: 1450,
      reading_time_minutes: 7,
    };

    const publishResult = await store.savePost(publishedPayload);
    assert.equal(publishResult.success, true);
    assert.equal(publishResult.post.id, existingId, 'Post ID must remain unchanged upon update');
    assert.equal(publishResult.post.status, 'published', 'Publication status must be updated to published');
    assert.equal(publishResult.post.title, 'The Spider Web System: How the Empire Built Wealth (Final)');

    // Verify total count in store remains exactly 1 — NO DUPLICATE CREATED
    const postsAfterPublish = store.getAllPosts();
    assert.equal(postsAfterPublish.length, 1, 'Store must still have exactly 1 post, never a duplicate entry');
    assert.equal(postsAfterPublish[0].id, existingId);
    assert.equal(postsAfterPublish[0].status, 'published');
  });

  test('Editing an existing draft with UUID id preserves the exact ID and updates content in-place', async () => {
    const existingUuid = 'd3b07384-d113-4623-8321-cf28cfcf650b';
    const draftPost: Post = {
      id: existingUuid,
      title: 'Original Draft Title',
      slug: 'the-spider-web-system-how-the-world-s-richest-man-built-an-empire-that-never-paid-tax',
      locale: 'en-us',
      vertical: 'finance',
      status: 'draft',
      content: '<p>Draft text</p>',
      excerpt: 'Draft excerpt',
      cover_image: '',
      author_name: 'Author',
      author_role: 'Editor',
      dual_silo: false,
      tags: ['Finance'],
      reading_time_minutes: 5,
      word_count: 500,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Pre-populate store with this draft
    (store as any).posts = [draftPost];

    // Simulate clicking "Publish" from editor
    const editPayload: Partial<Post> = {
      ...draftPost,
      title: 'Edited Title',
      content: '<p>Updated rich content</p>',
      status: 'published',
    };

    const saveResult = await store.savePost(editPayload);
    assert.equal(saveResult.success, true);
    assert.equal(saveResult.post.id, existingUuid, 'Must retain original database UUID');
    assert.equal(saveResult.post.status, 'published');
    assert.equal(saveResult.post.slug, 'the-spider-web-system-how-the-world-s-richest-man-built-an-empire-that-never-paid-tax');

    // Verify no duplicate in store
    const posts = store.getAllPosts();
    assert.equal(posts.length, 1, 'Store must contain exactly 1 post');
    assert.equal(posts[0].id, existingUuid);
    assert.equal(posts[0].status, 'published');
    assert.equal(posts[0].title, 'Edited Title');
  });

  test('Deleting a post removes it cleanly from memory and store', async () => {
    const post: Partial<Post> = {
      title: 'Temporary Market Analysis',
      slug: 'temporary-market-analysis',
      locale: 'en-us',
      vertical: 'finance',
      status: 'draft',
    };

    const result = await store.savePost(post);
    assert.equal(result.success, true);
    assert.equal(store.getAllPosts().length, 1);

    await store.deletePost(result.post.id);
    assert.equal(store.getAllPosts().length, 0, 'Post should be removed');
  });

  test('Toggling post status switches between draft and published', async () => {
    const post: Partial<Post> = {
      title: 'Status Toggle Verification',
      slug: 'status-toggle-verification',
      locale: 'en-us',
      vertical: 'finance',
      status: 'draft',
    };

    const result = await store.savePost(post);
    assert.equal(result.post.status, 'draft');

    await store.togglePostStatus(result.post.id);
    const updated = store.getPostBySlug('status-toggle-verification');
    assert.equal(updated?.status, 'published');

    await store.togglePostStatus(result.post.id);
    const reverted = store.getPostBySlug('status-toggle-verification');
    assert.equal(reverted?.status, 'draft');
  });
});
