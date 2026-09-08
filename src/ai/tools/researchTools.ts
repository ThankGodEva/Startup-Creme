import { z } from 'zod';
import { ITool, ToolExecutionContext, ToolExecutionResult } from '../types/tool';
import { store } from '../../lib/store';
import { Post, ContentVertical } from '../../types';

// 1. Search Content Tool (Safe, Green)
export const SearchContentParamsSchema = z.object({
  query: z.string().min(2, 'Query must be at least 2 characters').max(100),
  vertical: z.enum(['finance', 'tech', 'all']).optional().default('all'),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

export type SearchContentParams = z.infer<typeof SearchContentParamsSchema>;

export class SearchContentTool implements ITool<SearchContentParams, { results: Array<{ id: string; slug: string; title: string; excerpt: string; vertical: string; status: string }> }> {
  public readonly name = 'search_content';
  public readonly description = 'Searches existing StartupCrème articles and discussions to cross-reference coverage or avoid duplication.';
  public readonly parameters = SearchContentParamsSchema;
  public readonly policyLevel = 'green';
  public readonly permissions = ['content:read'];
  public readonly reversible = false;

  public validate(params: unknown) {
    const res = this.parameters.safeParse(params);
    if (!res.success) {
      return { success: false, errors: res.error.issues };
    }
    return { success: true, data: res.data };
  }

  public async execute(params: SearchContentParams, _context: ToolExecutionContext): Promise<ToolExecutionResult<{ results: Array<{ id: string; slug: string; title: string; excerpt: string; vertical: string; status: string }> }>> {
    try {
      const q = params.query.toLowerCase().trim();
      const allPosts = store.getPosts();
      
      const filtered = allPosts.filter(p => {
        const matchesVertical = params.vertical === 'all' || p.vertical === params.vertical || p.dual_silo;
        const matchesQuery = p.title.toLowerCase().includes(q) || 
                             p.excerpt.toLowerCase().includes(q) || 
                             p.tags.some(t => t.toLowerCase().includes(q));
        return matchesVertical && matchesQuery;
      }).slice(0, params.limit);

      const results = filtered.map(p => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        vertical: p.vertical,
        status: p.status
      }));

      return {
        success: true,
        result: { results },
        targetEntity: 'posts'
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Error searching content'
      };
    }
  }
}

// 2. Get Article Details Tool (Safe, Green)
export const GetArticleParamsSchema = z.object({
  slugOrId: z.string().min(1, 'Slug or ID is required'),
});

export type GetArticleParams = z.infer<typeof GetArticleParamsSchema>;

export class GetArticleTool implements ITool<GetArticleParams, Post | null> {
  public readonly name = 'get_article';
  public readonly description = 'Fetches full article metadata and content by slug or ID.';
  public readonly parameters = GetArticleParamsSchema;
  public readonly policyLevel = 'green';
  public readonly permissions = ['content:read'];
  public readonly reversible = false;

  public validate(params: unknown) {
    const res = this.parameters.safeParse(params);
    if (!res.success) return { success: false, errors: res.error.issues };
    return { success: true, data: res.data };
  }

  public async execute(params: GetArticleParams, _context: ToolExecutionContext): Promise<ToolExecutionResult<Post | null>> {
    try {
      const post = await store.fetchPostBySlug(params.slugOrId);
      if (!post) {
        return { success: true, result: null };
      }
      return {
        success: true,
        result: post,
        targetEntity: 'post',
        targetEntityId: post.id
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error fetching article' };
    }
  }
}

// 3. Create Article Draft Tool (Safe, Green - NEVER auto-publishes)
export const CreateDraftParamsSchema = z.object({
  title: z.string().min(5).max(200),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().min(10).max(500),
  content: z.string().min(20),
  vertical: z.enum(['finance', 'tech']),
  locale: z.string().default('en-us'),
  tags: z.array(z.string()).default(['Analysis']),
  cover_image: z.string().optional().default('https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200'),
  author_name: z.string().default('StartupCrème Research Desk'),
  reading_time_minutes: z.number().int().default(5),
  word_count: z.number().int().default(800)
});

export type CreateDraftParams = z.infer<typeof CreateDraftParamsSchema>;

export class CreateArticleDraftTool implements ITool<CreateDraftParams, { post: Post }> {
  public readonly name = 'create_article_draft';
  public readonly description = 'Creates a new article draft in the CMS. Articles are strictly created with status="draft" and require human review to publish.';
  public readonly parameters = CreateDraftParamsSchema;
  public readonly policyLevel = 'green';
  public readonly permissions = ['content:create_draft'];
  public readonly reversible = true;

  public validate(params: unknown) {
    const res = this.parameters.safeParse(params);
    if (!res.success) return { success: false, errors: res.error.issues };
    return { success: true, data: res.data };
  }

  public async execute(params: CreateDraftParams, _context: ToolExecutionContext): Promise<ToolExecutionResult<{ post: Post }>> {
    try {
      const draftPayload: Partial<Post> = {
        title: params.title,
        slug: params.slug,
        excerpt: params.excerpt,
        content: params.content,
        vertical: params.vertical as ContentVertical,
        locale: params.locale,
        status: 'draft', // STRICT RULE: autonomous agents can only create drafts
        tags: params.tags,
        cover_image: params.cover_image,
        author_name: params.author_name,
        author_role: 'AI Autonomous Intelligence',
        reading_time_minutes: params.reading_time_minutes,
        word_count: params.word_count
      };

      const res = await store.savePost(draftPayload);
      if (!res.success) {
        return { success: false, error: res.error || 'Failed to save post draft' };
      }

      return {
        success: true,
        result: { post: res.post },
        reversible: true,
        targetEntity: 'post',
        targetEntityId: res.post.id
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error creating draft' };
    }
  }

  public async rollback(targetEntityId: string, _context: ToolExecutionContext) {
    try {
      await store.deletePost(targetEntityId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to rollback draft creation' };
    }
  }
}

// 4. Get Site Metrics Tool (Safe, Green)
export class GetSiteMetricsTool implements ITool<Record<string, never>, { totalPosts: number; financePosts: number; techPosts: number; publishedCount: number; draftCount: number }> {
  public readonly name = 'get_site_metrics';
  public readonly description = 'Retrieves aggregate publication statistics across verticals and statuses.';
  public readonly parameters = z.object({});
  public readonly policyLevel = 'green';
  public readonly permissions = ['analytics:read'];
  public readonly reversible = false;

  public validate(params: unknown) {
    return { success: true, data: {} };
  }

  public async execute(_params: Record<string, never>, _context: ToolExecutionContext) {
    try {
      const posts = store.getPosts();
      const totalPosts = posts.length;
      const financePosts = posts.filter(p => p.vertical === 'finance').length;
      const techPosts = posts.filter(p => p.vertical === 'tech').length;
      const publishedCount = posts.filter(p => p.status === 'published').length;
      const draftCount = posts.filter(p => p.status === 'draft').length;

      return {
        success: true,
        result: {
          totalPosts,
          financePosts,
          techPosts,
          publishedCount,
          draftCount
        },
        targetEntity: 'metrics'
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error fetching metrics' };
    }
  }
}
