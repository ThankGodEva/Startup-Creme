import { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import { normalizeImageUrl } from './router';
import { Post, DiscussionTopic, DiscussionComment, PostComment, UserProfile, ContentVertical, PublicationStatus, DiscussionCategory, DiscussionPoll } from '../types';

const SEED_POSTS: Post[] = [];
const SAMPLE_POST_SLUGS = [
  'the-great-treasury-yield-re-alignment',
  'autonomous-agent-architectures-and-llm-compilers'
];

const POSTS_CACHE_KEY = 'startupcreme_posts_cache_v3';
const TOPICS_CACHE_KEY = 'startupcreme_topics_cache_v3';

const SEED_TOPICS: DiscussionTopic[] = [
  {
    id: 'topic-01',
    slug: 'what-is-your-2026-ai-compute-budget-allocation',
    title: 'What is your 2026 AI compute budget allocation between proprietary LLM APIs vs custom fine-tuned open weights?',
    content: 'Many Series B+ engineering organizations are re-evaluating token costs vs latency control. Are you moving core workflows to fine-tuned Llama/DeepSeek models or staying with frontier APIs like Gemini 1.5 Pro and Claude 3.5?',
    category: 'tech',
    user_id: 'system-topic-01',
    author_name: 'Marcus Chen',
    author_handle: '@marcus_ai',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
    upvotes: 42,
    downvotes: 3,
    tags: ['LLM', 'AI Infrastructure', 'FinOps', 'DevOps'],
    comment_count: 0,
    created_at: '2026-08-03T10:00:00Z',
    updated_at: '2026-08-03T10:00:00Z',
  }
];

// Helper to execute query strictly on 'startupcreme' schema
async function supabaseExecute<T = any>(
  queryFn: (client: SupabaseClient) => PromiseLike<any>
): Promise<{ data: T | null; error: any }> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase is not configured yet.');
    return { 
      data: null, 
      error: new Error('Supabase project URL & Anon Key are not configured yet. Please configure Supabase keys in the Database modal.') 
    };
  }

  // Strictly execute on 'startupcreme' schema
  try {
    const scClient = supabase.schema('startupcreme');
    const res = await Promise.resolve(queryFn(scClient as any));
    if (res.error) {
      console.warn('startupcreme schema query returned error:', res.error?.message || res.error);
      const scErrMsg = res.error?.message || String(res.error || '');
      if (scErrMsg.includes('permission denied for schema')) {
        return {
          data: null,
          error: new Error('Permission denied for schema "startupcreme". Grant schema usage in Supabase SQL Editor by running supabase/schema.sql.')
        };
      }
      return res as { data: T | null; error: any };
    }
    return res as { data: T | null; error: any };
  } catch (err: any) {
    console.error('startupcreme schema query exception:', err);
    return { data: null, error: err };
  }
}

class StartupCremeStore {
  private posts: Post[] = [];
  private topics: DiscussionTopic[] = [];
  private discussionComments: Record<string, DiscussionComment[]> = {};
  private postComments: Record<string, PostComment[]> = {};
  private currentUser: UserProfile | null = null;
  private topicUserVotes: Record<string, 'up' | 'down' | null> = {};
  private commentUserVotes: Record<string, 'up' | 'down' | null> = {};
  private pollUserVotes: Record<string, string> = {};
  private bookmarks: Set<string> = new Set();
  private subscribers: Array<() => void> = [];

  private hasAttemptedSeed = false;

  constructor() {
    this.loadInitialData();
  }

  private persistCache() {
    if (typeof window === 'undefined') return;
    try {
      if (this.posts && this.posts.length > 0) {
        localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(this.posts));
      }
      if (this.topics && this.topics.length > 0) {
        localStorage.setItem(TOPICS_CACHE_KEY, JSON.stringify(this.topics));
      }
    } catch (e) {
      // ignore quota limits
    }
  }

  private loadInitialData() {
    this.posts = [];
    this.topics = [];
    this.postComments = {};
    this.discussionComments = {};
    this.currentUser = null;

    // Synchronously hydrate from cache & SSR data on line 1 for 0ms latency
    if (typeof window !== 'undefined') {
      const win = window as any;
      const postsMap = new Map<string, Post>();
      const topicsMap = new Map<string, DiscussionTopic>();

      // 1. Hydrate from localStorage cache
      try {
        const cachedPostsJson = localStorage.getItem(POSTS_CACHE_KEY);
        if (cachedPostsJson) {
          const cached = JSON.parse(cachedPostsJson);
          if (Array.isArray(cached)) {
            cached.forEach(p => {
              if (p && p.slug && !SAMPLE_POST_SLUGS.includes(p.slug)) {
                postsMap.set(p.slug, { ...p, cover_image: normalizeImageUrl(p.cover_image) });
              }
            });
          }
        }
        const cachedTopicsJson = localStorage.getItem(TOPICS_CACHE_KEY);
        if (cachedTopicsJson) {
          const cached = JSON.parse(cachedTopicsJson);
          if (Array.isArray(cached)) {
            cached.forEach(t => {
              if (t && t.slug) topicsMap.set(t.slug, t);
            });
          }
        }
      } catch (e) {
        console.warn('Cache hydration error:', e);
      }

      // 2. Hydrate from SSR pre-fetched payload
      if (win.__INITIAL_POST__) {
        const p = win.__INITIAL_POST__;
        if (p && p.slug && !SAMPLE_POST_SLUGS.includes(p.slug)) {
          postsMap.set(p.slug, { ...p, cover_image: normalizeImageUrl(p.cover_image) });
        }
      }
      if (Array.isArray(win.__INITIAL_POSTS__)) {
        win.__INITIAL_POSTS__.forEach((p: any) => {
          if (p && p.slug && !SAMPLE_POST_SLUGS.includes(p.slug)) {
            postsMap.set(p.slug, { ...p, cover_image: normalizeImageUrl(p.cover_image) });
          }
        });
      }
      if (win.__INITIAL_TOPIC__) {
        const t = win.__INITIAL_TOPIC__;
        if (t && t.slug) topicsMap.set(t.slug, t);
      }

      this.posts = Array.from(postsMap.values());
      this.topics = Array.from(topicsMap.values());
    }

    if (isSupabaseConfigured()) {
      this.syncFromSupabase().catch(err => {
        console.warn('Initial sync error:', err);
      });
      this.initSupabaseAuthListener();
    }
  }

  private initSupabaseAuthListener() {
    try {
      // 1. Check existing active session immediately on startup
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          this.syncUserFromSession(session);
        }
      }).catch(err => {
        console.warn('Session hydration error:', err);
      });

      // 2. Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          await this.syncUserFromSession(session);
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          this.notify();
        }
      });

      // 3. Auto-sync on window focus and periodic background poll
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => {
          this.refreshCurrentUserRole().catch(() => {});
        });
        setInterval(() => {
          if (this.currentUser) {
            this.refreshCurrentUserRole().catch(() => {});
          }
        }, 15000);
      }
    } catch (e) {
      console.warn('Supabase auth listener error:', e);
    }
  }

  public async syncUserFromSession(session: any) {
    if (!session?.user) return;
    const userObj = session.user;
    const userEmail = (userObj.email || '').trim();

    let computedRole: 'admin' | 'user' = (userObj.user_metadata?.role as 'admin' | 'user') || 'user';
    let computedName = userObj.user_metadata?.full_name || (userEmail ? userEmail.split('@')[0] : 'User');
    let computedAvatar = userObj.user_metadata?.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(userEmail || 'user')}/100/100`;

    // 1. Authoritative check via backend API with service_role bypass
    if (session?.access_token) {
      try {
        const resp = await fetch('/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        if (resp.ok) {
          const profile = await resp.json();
          if (profile && profile.role) {
            this.currentUser = {
              id: profile.id || userObj.id,
              email: profile.email || userEmail,
              full_name: profile.full_name || computedName,
              avatar_url: profile.avatar_url || computedAvatar,
              role: profile.role === 'admin' ? 'admin' : 'user',
              created_at: profile.created_at || userObj.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            this.notify();
            return;
          }
        }
      } catch (apiErr) {
        console.warn('Backend /api/auth/profile check failed, falling back to direct DB queries:', apiErr);
      }
    }

    // 2. Direct fallback query to startupcreme.users table (try ID first, fallback to email)
    try {
      let scUser: any = null;
      if (userObj.id) {
        const { data } = await supabase
          .schema('startupcreme')
          .from('users')
          .select('id, email, full_name, avatar_url, role')
          .eq('id', userObj.id)
          .maybeSingle();
        if (data) scUser = data;
      }

      if (!scUser && userEmail) {
        const { data } = await supabase
          .schema('startupcreme')
          .from('users')
          .select('id, email, full_name, avatar_url, role')
          .ilike('email', userEmail)
          .maybeSingle();
        if (data) scUser = data;
      }

      if (scUser) {
        if (scUser.role) {
          computedRole = scUser.role.trim().toLowerCase() === 'admin' ? 'admin' : 'user';
        }
        if (scUser.full_name) computedName = scUser.full_name;
        if (scUser.avatar_url) computedAvatar = scUser.avatar_url;
      }
    } catch (e) {
      console.warn('DB user role fetch error:', e);
    }

    this.currentUser = {
      id: userObj.id,
      email: userEmail,
      full_name: computedName,
      avatar_url: computedAvatar,
      role: computedRole,
      created_at: userObj.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.notify();
  }

  public async refreshCurrentUserRole(): Promise<'admin' | 'user' | null> {
    if (!isSupabaseConfigured()) return this.currentUser?.role || null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // 1. Check backend API first
      if (session?.access_token) {
        try {
          const resp = await fetch('/api/auth/profile', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          if (resp.ok) {
            const profile = await resp.json();
            if (profile && profile.role) {
              const dbRole: 'admin' | 'user' = profile.role === 'admin' ? 'admin' : 'user';
              const dbName = profile.full_name || this.currentUser?.full_name || 'User';
              const dbAvatar = profile.avatar_url || this.currentUser?.avatar_url;

              const changed = !this.currentUser || this.currentUser.role !== dbRole || this.currentUser.full_name !== dbName;
              this.currentUser = {
                id: profile.id || session.user?.id || this.currentUser?.id || 'unknown',
                email: profile.email || session.user?.email || this.currentUser?.email || '',
                full_name: dbName,
                avatar_url: dbAvatar,
                role: dbRole,
                created_at: profile.created_at || this.currentUser?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              if (changed) this.notify();
              return dbRole;
            }
          }
        } catch (apiErr) {
          console.warn('/api/auth/profile refresh error, falling back:', apiErr);
        }
      }

      // 2. Direct DB fallback
      const currentAuthUser = session?.user;
      const effectiveId = currentAuthUser?.id || this.currentUser?.id;
      const effectiveEmail = (currentAuthUser?.email || this.currentUser?.email || '').trim();

      if (!effectiveId && !effectiveEmail) return null;

      let scUser: any = null;

      if (effectiveId) {
        const { data } = await supabase
          .schema('startupcreme')
          .from('users')
          .select('id, email, full_name, avatar_url, role')
          .eq('id', effectiveId)
          .maybeSingle();
        if (data) scUser = data;
      }

      if (!scUser && effectiveEmail) {
        const { data } = await supabase
          .schema('startupcreme')
          .from('users')
          .select('id, email, full_name, avatar_url, role')
          .ilike('email', effectiveEmail)
          .maybeSingle();
        if (data) scUser = data;
      }

      if (scUser) {
        const dbRole: 'admin' | 'user' = (scUser.role?.trim().toLowerCase() === 'admin') ? 'admin' : 'user';
        const dbName = scUser.full_name || this.currentUser?.full_name || 'User';
        const dbAvatar = scUser.avatar_url || this.currentUser?.avatar_url;

        if (this.currentUser) {
          const changed = this.currentUser.role !== dbRole || this.currentUser.full_name !== dbName;
          this.currentUser = {
            ...this.currentUser,
            id: scUser.id || this.currentUser.id,
            email: scUser.email || this.currentUser.email,
            full_name: dbName,
            avatar_url: dbAvatar,
            role: dbRole,
            updated_at: new Date().toISOString(),
          };
          if (changed) this.notify();
        } else if (currentAuthUser) {
          this.currentUser = {
            id: scUser.id || currentAuthUser.id,
            email: scUser.email || currentAuthUser.email || '',
            full_name: dbName,
            avatar_url: dbAvatar,
            role: dbRole,
            created_at: currentAuthUser.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          this.notify();
        }
        return dbRole;
      }
    } catch (err) {
      console.warn('Failed to refresh user role from DB:', err);
    }
    return this.currentUser?.role || null;
  }

  public subscribe(fn: () => void) {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== fn);
    };
  }

  private notify() {
    this.subscribers.forEach(fn => fn());
  }

  public async seedStaticArticlesToSupabase(skipSync = false): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured()) return { success: false, message: 'Supabase is not configured yet.' };

    try {
      // Seed initial posts into Supabase startupcreme schema
      for (const post of SEED_POSTS) {
        const postPayload = {
          slug: post.slug,
          locale: post.locale,
          vertical: post.vertical,
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          status: post.status,
          meta_description: post.meta_description,
          canonical_url: post.canonical_url,
          cover_image: post.cover_image,
          author_name: post.author_name || 'Startup Crème Editorial',
          author_role: post.author_role || 'Principal Editor',
          author_avatar: post.author_avatar,
          dual_silo: post.dual_silo ?? false,
          silo_badge: post.silo_badge,
          tags: post.tags || [],
          reading_time_minutes: post.reading_time_minutes || 5,
          word_count: post.word_count || 800,
          created_at: post.created_at || new Date().toISOString(),
          updated_at: post.updated_at || new Date().toISOString(),
        };

        await supabaseExecute((client) => client.from('posts').insert(postPayload));
      }

      // Seed initial discussion topics into Supabase startupcreme schema
      for (const topic of SEED_TOPICS) {
        const topicPayload = {
          slug: topic.slug,
          title: topic.title,
          content: topic.content,
          category: topic.category,
          author_name: topic.author_name,
          author_handle: topic.author_handle,
          author_avatar: topic.author_avatar,
          upvotes: topic.upvotes || 0,
          downvotes: topic.downvotes || 0,
          tags: topic.tags || [],
          comment_count: topic.comment_count || 0,
          created_at: topic.created_at || new Date().toISOString(),
          updated_at: topic.updated_at || new Date().toISOString(),
        };

        await supabaseExecute((client) => client.from('discussion_topics').upsert(topicPayload, { onConflict: 'slug' }));
      }

      if (!skipSync) {
        await this.syncFromSupabase();
      } else {
        this.posts = SEED_POSTS;
        this.topics = SEED_TOPICS;
        this.notify();
      }
      return {
        success: true,
        message: `Successfully seeded initial articles and topics into Supabase!`,
      };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to seed static data to Supabase.' };
    }
  }

  public async deleteAllSamplePosts(): Promise<{ success: boolean; message: string }> {
    this.posts = this.posts.filter(p => !SAMPLE_POST_SLUGS.includes(p.slug));
    this.notify();

    if (!isSupabaseConfigured()) {
      return { success: true, message: 'Sample posts cleared locally.' };
    }

    try {
      const res = await supabaseExecute((client) =>
        client.from('posts').delete().in('slug', SAMPLE_POST_SLUGS)
      );
      if (res.error) {
        return { success: false, message: res.error.message || String(res.error) };
      }
      return { success: true, message: 'All sample posts deleted from Supabase database successfully!' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error deleting sample posts' };
    }
  }

  public async syncFromSupabase() {
    if (!isSupabaseConfigured()) return;

    try {
      // Purge any sample posts from Supabase database
      await supabaseExecute((client) =>
        client.from('posts').delete().in('slug', SAMPLE_POST_SLUGS)
      );

      // Fetch Posts strictly from startupcreme schema
      const { data: postsData } = await supabaseExecute((client) =>
        client.from('posts').select('*').order('created_at', { ascending: false })
      );

      this.posts = (postsData as Post[] || [])
        .filter(p => !SAMPLE_POST_SLUGS.includes(p.slug))
        .map(p => ({
          ...p,
          cover_image: normalizeImageUrl(p.cover_image),
        }));

      // Fetch Discussion Topics strictly from startupcreme schema
      const { data: topicsData } = await supabaseExecute((client) =>
        client.from('discussion_topics').select('*').order('created_at', { ascending: false })
      );

      // Fetch Discussion Polls & Options strictly from database tables
      const { data: pollsData } = await supabaseExecute((client) =>
        client.from('discussion_polls').select('*')
      ).catch(() => ({ data: null }));

      const { data: pollOptionsData } = await supabaseExecute((client) =>
        client.from('discussion_poll_options').select('*')
      ).catch(() => ({ data: null }));

      // Fetch logged-in user's topic and poll votes if authenticated
      if (this.currentUser) {
        const userId = await this.ensureUserInDb(this.currentUser);
        if (userId) {
          const { data: pollVotesData } = await supabaseExecute((client) =>
            client.from('discussion_poll_votes').select('*').eq('user_id', userId)
          ).catch(() => ({ data: null }));

          if (pollVotesData && pollVotesData.length > 0) {
            pollVotesData.forEach(pv => {
              if (pv.poll_id && pv.option_id) {
                this.pollUserVotes[pv.poll_id] = pv.option_id;
              }
            });
          }

          const { data: topicVotesData } = await supabaseExecute((client) =>
            client.from('discussion_topic_votes').select('*').eq('user_id', userId)
          ).catch(() => ({ data: null }));

          if (topicVotesData && topicVotesData.length > 0) {
            topicVotesData.forEach(tv => {
              if (tv.topic_id && tv.vote_type) {
                this.topicUserVotes[tv.topic_id] = tv.vote_type;
              }
            });
          }
        }
      }

      if (topicsData && topicsData.length > 0) {
        const pollsMap = new Map<string, DiscussionPoll>();

        if (pollsData && pollsData.length > 0) {
          pollsData.forEach((p: any) => {
            pollsMap.set(p.id, {
              id: p.id,
              topic_id: p.topic_id,
              question: p.question,
              total_votes: p.total_votes || 0,
              created_at: p.created_at,
              options: [],
            });
          });

          if (pollOptionsData && pollOptionsData.length > 0) {
            pollOptionsData.forEach((opt: any) => {
              const parentPoll = pollsMap.get(opt.poll_id);
              if (parentPoll) {
                parentPoll.options.push({
                  id: opt.id,
                  poll_id: opt.poll_id,
                  option_text: opt.option_text,
                  votes: opt.votes || 0,
                });
              }
            });
          }
        }

        this.topics = topicsData.map(t => {
          let pollObj: DiscussionPoll | undefined = undefined;

          // Search in dedicated discussion_polls table
          const dedicatedPoll = Array.from(pollsMap.values()).find(p => p.topic_id === t.id);
          if (dedicatedPoll) {
            pollObj = dedicatedPoll;
          } else if (t.poll) {
            // Fallback to JSON poll on topic row
            pollObj = typeof t.poll === 'string' ? JSON.parse(t.poll) : t.poll;
          }

          return {
            ...t,
            poll: pollObj,
          };
        }) as DiscussionTopic[];
      }

      // Fetch Discussion Comments strictly from startupcreme schema
      const { data: discCommentsData } = await supabaseExecute((client) =>
        client.from('discussion_comments').select('*').order('created_at', { ascending: true })
      );

      const groupedDiscComments: Record<string, DiscussionComment[]> = {};
      if (discCommentsData && discCommentsData.length > 0) {
        const commentsMap = new Map<string, DiscussionComment>();

        discCommentsData.forEach(c => {
          commentsMap.set(c.id, {
            id: c.id,
            topic_id: c.topic_id,
            parent_id: c.parent_id || null,
            user_id: c.user_id || 'user-anon',
            author_name: c.author_name || 'Member',
            author_handle: c.author_handle || '@member',
            author_avatar: c.author_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
            content: c.content,
            upvotes: c.upvotes || 0,
            downvotes: c.downvotes || 0,
            created_at: c.created_at,
            updated_at: c.updated_at,
            replies: []
          });
        });

        commentsMap.forEach(comment => {
          if (!groupedDiscComments[comment.topic_id]) {
            groupedDiscComments[comment.topic_id] = [];
          }
          if (comment.parent_id && commentsMap.has(comment.parent_id)) {
            const parent = commentsMap.get(comment.parent_id)!;
            if (!parent.replies) parent.replies = [];
            if (!parent.replies.some(r => r.id === comment.id)) {
              parent.replies.push(comment);
            }
          } else {
            if (!groupedDiscComments[comment.topic_id].some(existing => existing.id === comment.id)) {
              groupedDiscComments[comment.topic_id].unshift(comment);
            }
          }
        });
      }
      this.discussionComments = groupedDiscComments;

      // Fetch Article Comments strictly from startupcreme schema
      const { data: postCommentsData } = await supabaseExecute((client) =>
        client.from('comments').select('*').order('created_at', { ascending: false })
      );

      const groupedPostComments: Record<string, PostComment[]> = {};
      if (postCommentsData && postCommentsData.length > 0) {
        postCommentsData.forEach(c => {
          if (!groupedPostComments[c.post_id]) {
            groupedPostComments[c.post_id] = [];
          }
          if (!groupedPostComments[c.post_id].some(existing => existing.id === c.id)) {
            groupedPostComments[c.post_id].push({
              id: c.id,
              post_id: c.post_id,
              user_id: c.user_id || 'user-anon',
              author_name: c.author_name || 'Member',
              author_avatar: c.author_avatar,
              content: c.content,
              created_at: c.created_at,
              updated_at: c.updated_at,
            });
          }
        });
      }
      this.postComments = groupedPostComments;

      this.persistCache();
      this.notify();
    } catch (e) {
      console.warn('Supabase sync error:', e);
    }
  }

  // Getters
  public getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  public setCurrentUser(user: UserProfile | null) {
    this.currentUser = user;
    this.notify();
    if (user) {
      this.refreshCurrentUserRole().catch(() => {});
    }
  }

  public switchDemoRole(role: 'admin' | 'user' | 'guest') {
    if (role === 'guest') {
      this.currentUser = null;
      if (isSupabaseConfigured()) {
        supabase.auth.signOut().catch(() => {});
      }
    } else if (role === 'admin') {
      this.currentUser = {
        id: 'admin-demo-id',
        email: 'admin@startupcreme.com',
        full_name: 'Startup Crème Admin',
        avatar_url: '/logo.jpg',
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    } else {
      this.currentUser = {
        id: 'user-demo-id',
        email: 'editor@startupcreme.com',
        full_name: 'Community Member',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    this.notify();
  }

  private async ensureUserInDb(user: UserProfile | null): Promise<string> {
    const fallbackUUID = '00000000-0000-0000-0000-000000000001';
    if (!user) return fallbackUUID;

    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    const targetUserId = isValidUUID ? user.id : (user.role === 'admin' ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002');

    if (isSupabaseConfigured()) {
      try {
        // Query startupcreme.users first to never overwrite existing role
        let existingUser: any = null;

        if (isValidUUID) {
          const { data } = await supabase
            .schema('startupcreme')
            .from('users')
            .select('id, role, full_name, avatar_url')
            .eq('id', targetUserId)
            .maybeSingle();
          if (data) existingUser = data;
        }

        if (!existingUser && user.email) {
          const { data } = await supabase
            .schema('startupcreme')
            .from('users')
            .select('id, role, full_name, avatar_url')
            .ilike('email', user.email.trim())
            .maybeSingle();
          if (data) existingUser = data;
        }

        if (existingUser) {
          // Sync database role to in-memory currentUser if different
          if (existingUser.role && this.currentUser) {
            const dbRole: 'admin' | 'user' = existingUser.role.trim().toLowerCase() === 'admin' ? 'admin' : 'user';
            if (this.currentUser.role !== dbRole) {
              this.currentUser.role = dbRole;
              this.notify();
            }
          }
          return existingUser.id || targetUserId;
        }

        // Only insert if user does not exist in DB yet
        await supabase
          .schema('startupcreme')
          .from('users')
          .insert({
            id: targetUserId,
            email: user.email || 'user@startupcreme.com',
            full_name: user.full_name || 'Community Member',
            avatar_url: user.avatar_url || 'https://picsum.photos/seed/user/100/100',
            role: user.role || 'user',
          });
      } catch (e) {
        console.warn('ensureUserInDb notice:', e);
      }
    }

    return targetUserId;
  }

  public getPosts(locale = 'en-us', vertical?: ContentVertical, statusOnly: PublicationStatus = 'published'): Post[] {
    return this.posts.filter(p => {
      const matchesLocale = p.locale.toLowerCase() === locale.toLowerCase() || p.locale === 'en-us';
      const matchesVertical = !vertical || p.vertical === vertical || p.dual_silo;
      const matchesStatus = statusOnly ? p.status === statusOnly : true;
      return matchesLocale && matchesVertical && matchesStatus;
    });
  }

  public getAllPosts(): Post[] {
    return [...this.posts];
  }

  public getPostBySlug(slug: string, locale = 'en-us', vertical?: ContentVertical): Post | undefined {
    if (!slug) return undefined;
    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();

    // 1. Exact or case-insensitive match with vertical constraint or dual_silo
    let found = this.posts.find(p => {
      const matchSlug = p.slug.toLowerCase() === decodedSlug || p.id.toLowerCase() === decodedSlug;
      const matchVert = !vertical || p.vertical === vertical || p.dual_silo;
      return matchSlug && matchVert;
    });

    // 2. Fallback: match by slug regardless of vertical
    if (!found) {
      found = this.posts.find(p => p.slug.toLowerCase() === decodedSlug || p.id.toLowerCase() === decodedSlug);
    }

    // 3. Fallback: fuzzy/partial match if slug contains unique base slug or hash
    if (!found && decodedSlug.length > 8) {
      found = this.posts.find(p => {
        const pSlug = p.slug.toLowerCase();
        return decodedSlug.includes(pSlug) || pSlug.includes(decodedSlug);
      });
    }

    return found;
  }

  public async fetchPostBySlug(slug: string, locale = 'en-us', vertical?: ContentVertical): Promise<Post | null> {
    const existing = this.getPostBySlug(slug, locale, vertical);
    if (existing) return existing;

    if (!isSupabaseConfigured()) return null;

    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();

    try {
      // 1. Direct targeted query by slug
      const { data: postsData } = await supabaseExecute((client) =>
        client.from('posts').select('*').or(`slug.ilike.${decodedSlug},id.ilike.${decodedSlug}`).maybeSingle()
      );

      if (postsData) {
        const post: Post = {
          ...postsData,
          cover_image: normalizeImageUrl(postsData.cover_image)
        };
        const map = new Map<string, Post>();
        map.set(post.slug, post);
        this.posts.forEach(p => { if (!map.has(p.slug)) map.set(p.slug, p); });
        this.posts = Array.from(map.values());
        this.persistCache();
        this.notify();
        return post;
      }

      // 2. Partial/fuzzy query fallback
      if (decodedSlug.length > 8) {
        const shortSlug = decodedSlug.slice(-20);
        const { data: fuzzyData } = await supabaseExecute((client) =>
          client.from('posts').select('*').ilike('slug', `%${shortSlug}%`).limit(1)
        );

        if (fuzzyData && fuzzyData.length > 0) {
          const post: Post = {
            ...fuzzyData[0],
            cover_image: normalizeImageUrl(fuzzyData[0].cover_image)
          };
          const map = new Map<string, Post>();
          map.set(post.slug, post);
          this.posts.forEach(p => { if (!map.has(p.slug)) map.set(p.slug, p); });
          this.posts = Array.from(map.values());
          this.persistCache();
          this.notify();
          return post;
        }
      }
    } catch (e) {
      console.warn('fetchPostBySlug exception:', e);
    }

    return null;
  }

  public async fetchTopicBySlug(slug: string): Promise<DiscussionTopic | null> {
    const existing = this.getDiscussionTopicBySlug(slug);
    if (existing) return existing;

    if (!isSupabaseConfigured()) return null;

    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();

    try {
      const { data: topicData } = await supabaseExecute((client) =>
        client.from('discussion_topics').select('*').or(`slug.ilike.${decodedSlug},id.ilike.${decodedSlug}`).maybeSingle()
      );

      if (topicData) {
        const topic: DiscussionTopic = topicData;
        const map = new Map<string, DiscussionTopic>();
        map.set(topic.slug, topic);
        this.topics.forEach(t => { if (!map.has(t.slug)) map.set(t.slug, t); });
        this.topics = Array.from(map.values());
        this.persistCache();
        this.notify();
        return topic;
      }
    } catch (e) {
      console.warn('fetchTopicBySlug exception:', e);
    }

    return null;
  }

  public getPostComments(postId: string): PostComment[] {
    const targetPost = this.posts.find(p => p.id === postId || p.slug === postId);
    const listById = this.postComments[postId] || [];
    const listByTargetId = targetPost?.id ? (this.postComments[targetPost.id] || []) : [];
    const listByTargetSlug = targetPost?.slug ? (this.postComments[targetPost.slug] || []) : [];

    const combined = [...listById, ...listByTargetId, ...listByTargetSlug];
    const unique = new Map<string, PostComment>();
    combined.forEach(c => unique.set(c.id, c));

    return Array.from(unique.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  public async addPostComment(postId: string, content: string): Promise<PostComment | null> {
    if (!this.currentUser) return null;
    const now = new Date().toISOString();
    const commentId = `comment-${Date.now()}`;

    // 1. Resolve target post to ensure valid DB mapping
    let targetPost = this.posts.find(p => p.id === postId || p.slug === postId);
    let effectivePostId = targetPost?.id || postId;

    if (isSupabaseConfigured() && targetPost) {
      const isValidPostUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetPost.id);

      if (!isValidPostUUID) {
        // Look up post in Supabase by slug to see if it already exists with a Supabase UUID
        const { data: foundPost } = await supabaseExecute((client) =>
          client.from('posts').select('id, slug').eq('slug', targetPost!.slug).maybeSingle()
        );

        if (foundPost?.id) {
          targetPost.id = foundPost.id;
          effectivePostId = foundPost.id;
        } else {
          // Post is not in Supabase yet; auto-save it to generate the Supabase row and UUID
          const saveRes = await this.savePost(targetPost);
          if (saveRes.success && saveRes.post?.id) {
            targetPost = saveRes.post;
            effectivePostId = saveRes.post.id;
          }
        }
      } else {
        effectivePostId = targetPost.id;
      }
    }

    const newComment: PostComment = {
      id: commentId,
      post_id: effectivePostId,
      user_id: this.currentUser.id,
      author_name: this.currentUser.full_name,
      author_avatar: this.currentUser.avatar_url,
      content,
      created_at: now,
      updated_at: now,
    };

    // Synchronize local memory state across all potential keys
    const keysToUpdate = new Set<string>([postId, effectivePostId]);
    if (targetPost) {
      if (targetPost.id) keysToUpdate.add(targetPost.id);
      if (targetPost.slug) keysToUpdate.add(targetPost.slug);
    }

    keysToUpdate.forEach(k => {
      if (!this.postComments[k]) {
        this.postComments[k] = [];
      }
      if (!this.postComments[k].some(c => c.id === newComment.id)) {
        this.postComments[k].unshift(newComment);
      }
    });

    this.notify();

    if (!isSupabaseConfigured()) {
      return newComment;
    }

    const isValidUserUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.currentUser.id);
    const postCommentPayload = {
      post_id: effectivePostId,
      user_id: isValidUserUUID ? this.currentUser.id : null,
      author_name: this.currentUser.full_name,
      author_avatar: this.currentUser.avatar_url,
      content: content,
      created_at: now,
      updated_at: now,
    };

    const res = await supabaseExecute((client) =>
      client.from('comments').insert(postCommentPayload).select()
    );

    if (res.error) {
      console.warn('Notice saving article comment to Supabase (using local state fallback):', res.error?.message || res.error);
    } else if (res.data && res.data[0]) {
      const realCommentId = res.data[0].id;
      newComment.id = realCommentId;

      keysToUpdate.forEach(k => {
        const item = this.postComments[k]?.find(c => c.id === commentId);
        if (item) item.id = realCommentId;
      });

      this.notify();
      console.log('Article comment saved to Supabase startupcreme schema successfully:', res.data[0]);
    }

    return newComment;
  }

  // Admin CRUD for Posts
  public async savePost(post: Partial<Post>): Promise<{ success: boolean; post: Post; error?: string }> {
    const existingIndex = this.posts.findIndex(p => p.id === post.id || (p.slug === post.slug && p.locale === post.locale && p.vertical === post.vertical));
    const now = new Date().toISOString();
    let savedPost: Post;

    if (existingIndex >= 0) {
      savedPost = {
        ...this.posts[existingIndex],
        ...post,
        cover_image: normalizeImageUrl(post.cover_image || this.posts[existingIndex].cover_image),
        updated_at: now,
      } as Post;
      this.posts[existingIndex] = savedPost;
    } else {
      savedPost = {
        id: post.id || `post-${Date.now()}`,
        slug: post.slug || 'new-post-' + Date.now(),
        locale: post.locale || 'en-us',
        vertical: post.vertical || 'finance',
        title: post.title || 'Untitled Article',
        excerpt: post.excerpt || '',
        content: post.content || '',
        status: post.status || 'draft',
        meta_description: post.meta_description || '',
        canonical_url: post.canonical_url || '',
        cover_image: normalizeImageUrl(post.cover_image) || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200',
        author_name: post.author_name || this.currentUser?.full_name || 'Startup Crème Editorial',
        author_role: post.author_role || 'Senior Analyst',
        author_avatar: post.author_avatar || this.currentUser?.avatar_url,
        dual_silo: Boolean(post.dual_silo),
        silo_badge: post.silo_badge || '',
        tags: post.tags || ['Finance', 'Tech'],
        reading_time_minutes: post.reading_time_minutes || 5,
        word_count: post.word_count || 800,
        created_at: now,
        updated_at: now,
      };
      this.posts.unshift(savedPost);
    }
    this.persistCache();
    this.notify();

    if (!isSupabaseConfigured()) {
      return { success: true, post: savedPost };
    }

    const contentPayload = typeof savedPost.content === 'object'
      ? JSON.stringify(savedPost.content)
      : savedPost.content;

    const postPayload = {
      slug: savedPost.slug,
      locale: savedPost.locale,
      vertical: savedPost.vertical,
      title: savedPost.title,
      excerpt: savedPost.excerpt,
      content: contentPayload,
      status: savedPost.status,
      meta_description: savedPost.meta_description,
      canonical_url: savedPost.canonical_url,
      cover_image: savedPost.cover_image,
      author_name: savedPost.author_name,
      author_role: savedPost.author_role,
      author_avatar: savedPost.author_avatar,
      dual_silo: savedPost.dual_silo,
      silo_badge: savedPost.silo_badge,
      tags: savedPost.tags,
      reading_time_minutes: savedPost.reading_time_minutes,
      word_count: savedPost.word_count,
      created_at: savedPost.created_at,
      updated_at: savedPost.updated_at,
    };

    try {
      // Direct INSERT into posts table
      let res = await supabaseExecute((client) =>
        client.from('posts').insert(postPayload).select()
      );

      // On conflict or error (e.g. duplicate slug), append random unique characters to slug and retry INSERT
      if (res.error) {
        console.warn('Initial post insert failed (possible slug conflict):', res.error?.message || res.error);
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        const uniqueSlug = `${savedPost.slug}-${randomSuffix}`;
        postPayload.slug = uniqueSlug;
        savedPost.slug = uniqueSlug;

        res = await supabaseExecute((client) =>
          client.from('posts').insert(postPayload).select()
        );
      }

      if (res.error) {
        const errorMsg = res.error.message || String(res.error);
        console.error('Failed to insert post into Supabase database:', errorMsg);
        return { success: false, post: savedPost, error: errorMsg };
      }

      if (res.data && res.data[0]) {
        savedPost.id = res.data[0].id;
        this.notify();
        console.log('Post inserted into Supabase database successfully:', res.data[0]);
      }

      return { success: true, post: savedPost };
    } catch (err: any) {
      const exceptionMsg = err?.message || 'Database execution exception';
      console.error('Exception during post insert to Supabase:', exceptionMsg);
      return { success: false, post: savedPost, error: exceptionMsg };
    }
  }

  public async deletePost(id: string) {
    const postToDelete = this.posts.find(p => p.id === id);
    this.posts = this.posts.filter(p => p.id !== id);
    this.persistCache();
    this.notify();

    if (postToDelete) {
      await supabaseExecute((client) =>
        client.from('posts').delete().or(`id.eq.${id},slug.eq.${postToDelete.slug}`)
      );
    }
  }

  public async togglePostStatus(id: string) {
    const post = this.posts.find(p => p.id === id);
    if (post) {
      post.status = post.status === 'published' ? 'draft' : 'published';
      post.updated_at = new Date().toISOString();
      this.persistCache();
      this.notify();

      await supabaseExecute((client) =>
        client.from('posts').update({ status: post.status, updated_at: post.updated_at }).or(`id.eq.${id},slug.eq.${post.slug}`)
      );
    }
  }

  // Discussion Forum Methods
  public getDiscussionTopics(category?: DiscussionCategory | 'all'): DiscussionTopic[] {
    if (!category || category === 'all') return [...this.topics];
    return this.topics.filter(t => t.category === category);
  }

  public getDiscussionTopicBySlug(slug: string): DiscussionTopic | undefined {
    if (!slug) return undefined;
    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();

    let found = this.topics.find(t => t.slug.toLowerCase() === decodedSlug || t.id.toLowerCase() === decodedSlug);
    if (!found && decodedSlug.length > 8) {
      found = this.topics.find(t => {
        const tSlug = t.slug.toLowerCase();
        return decodedSlug.includes(tSlug) || tSlug.includes(decodedSlug);
      });
    }
    return found;
  }

  public async createDiscussionTopic(data: {
    title: string;
    content: string;
    category: DiscussionCategory;
    tags: string[];
    pollQuestion?: string;
    pollOptions?: string[];
  }): Promise<DiscussionTopic | null> {
    if (!this.currentUser) return null;
    const now = new Date().toISOString();
    const topicUuid = crypto.randomUUID();
    const baseSlug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'topic';
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    let pollObj: DiscussionPoll | undefined = undefined;
    if (data.pollQuestion && data.pollOptions && data.pollOptions.filter(o => o.trim()).length > 0) {
      const pollUuid = crypto.randomUUID();
      const validOptions = data.pollOptions.filter(o => o.trim());
      pollObj = {
        id: pollUuid,
        topic_id: topicUuid,
        question: data.pollQuestion.trim(),
        total_votes: 0,
        created_at: now,
        options: validOptions.map((opt) => ({
          id: crypto.randomUUID(),
          poll_id: pollUuid,
          option_text: opt.trim(),
          votes: 0,
        })),
      };
    }

    const newTopic: DiscussionTopic = {
      id: topicUuid,
      slug: uniqueSlug,
      title: data.title,
      content: data.content,
      category: data.category,
      user_id: this.currentUser.id,
      author_name: this.currentUser.full_name,
      author_handle: `@${this.currentUser.full_name.toLowerCase().replace(/\s+/g, '')}`,
      author_avatar: this.currentUser.avatar_url,
      upvotes: 0,
      downvotes: 0,
      tags: data.tags || [],
      comment_count: 0,
      poll: pollObj,
      created_at: now,
      updated_at: now,
    };

    this.topics.unshift(newTopic);
    this.notify();

    if (!isSupabaseConfigured()) return newTopic;

    const validUserId = await this.ensureUserInDb(this.currentUser);
    const topicPayload = {
      id: topicUuid,
      slug: uniqueSlug,
      title: newTopic.title,
      content: newTopic.content,
      category: newTopic.category,
      author_name: newTopic.author_name,
      author_handle: newTopic.author_handle,
      author_avatar: newTopic.author_avatar,
      upvotes: 0,
      downvotes: 0,
      tags: newTopic.tags || [],
      comment_count: 0,
      user_id: validUserId,
      created_at: now,
      updated_at: now,
    };

    const res = await supabaseExecute((client) =>
      client.from('discussion_topics').insert(topicPayload).select()
    );

    if (res.error) {
      console.error('Failed saving discussion topic to Supabase:', res.error?.message || res.error);
    } else if (res.data && res.data[0]) {
      const createdDbTopic = res.data[0];
      newTopic.id = createdDbTopic.id;

      if (pollObj) {
        // 1. Insert poll into discussion_polls table
        const pollInsertRes = await supabaseExecute((client) =>
          client.from('discussion_polls').insert({
            id: pollObj!.id,
            topic_id: createdDbTopic.id,
            question: pollObj!.question,
            total_votes: 0,
            created_at: now,
          }).select()
        ).catch((err) => {
          console.warn('Error saving to discussion_polls table:', err);
          return { data: null };
        });

        const dbPoll = pollInsertRes.data && pollInsertRes.data[0] ? pollInsertRes.data[0] : null;
        const actualPollId = dbPoll ? dbPoll.id : pollObj.id;

        newTopic.poll = {
          ...pollObj,
          id: actualPollId,
          topic_id: createdDbTopic.id,
        };

        // 2. Insert options into discussion_poll_options table
        if (pollObj.options && pollObj.options.length > 0) {
          const optionsPayload = pollObj.options.map(opt => ({
            id: opt.id,
            poll_id: actualPollId,
            option_text: opt.option_text,
            votes: 0,
          }));

          const optionsInsertRes = await supabaseExecute((client) =>
            client.from('discussion_poll_options').insert(optionsPayload).select()
          ).catch((err) => {
            console.warn('Error saving options to discussion_poll_options table:', err);
            return { data: null };
          });

          if (optionsInsertRes.data && optionsInsertRes.data.length > 0) {
            newTopic.poll.options = optionsInsertRes.data.map((opt: any) => ({
              id: opt.id,
              poll_id: opt.poll_id,
              option_text: opt.option_text,
              votes: opt.votes || 0,
            }));
          }
        }
      }

      this.notify();
      console.log('Discussion topic and poll saved to Supabase startupcreme schema successfully:', createdDbTopic);
    }

    return newTopic;
  }

  public async voteTopic(topicId: string, type: 'up' | 'down') {
    if (!this.currentUser) return;
    const topic = this.topics.find(t => t.id === topicId || t.slug === topicId);
    if (!topic) return;

    const key = topic.id;
    const currentVote = this.topicUserVotes[key] || this.topicUserVotes[topicId] || (topic.slug ? this.topicUserVotes[topic.slug] : null);

    if (currentVote === type) {
      if (type === 'up') topic.upvotes = Math.max(0, topic.upvotes - 1);
      if (type === 'down') topic.downvotes = Math.max(0, topic.downvotes - 1);
      this.topicUserVotes[key] = null;
      this.topicUserVotes[topicId] = null;
      if (topic.slug) this.topicUserVotes[topic.slug] = null;
    } else {
      if (currentVote === 'up') topic.upvotes = Math.max(0, topic.upvotes - 1);
      if (currentVote === 'down') topic.downvotes = Math.max(0, topic.downvotes - 1);

      if (type === 'up') topic.upvotes += 1;
      if (type === 'down') topic.downvotes += 1;
      this.topicUserVotes[key] = type;
      this.topicUserVotes[topicId] = type;
      if (topic.slug) this.topicUserVotes[topic.slug] = type;
    }

    this.notify();

    if (!isSupabaseConfigured()) return;

    const isTopicUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topic.id);

    await supabaseExecute((client) => {
      const q = client.from('discussion_topics').update({
        upvotes: topic.upvotes,
        downvotes: topic.downvotes,
      });
      return isTopicUUID ? q.eq('id', topic.id) : q.eq('slug', topic.slug);
    });

    const isUserUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.currentUser.id);
    if (isTopicUUID && isUserUUID) {
      await supabaseExecute((client) =>
        client.from('discussion_topic_votes').upsert({
          topic_id: topic.id,
          user_id: this.currentUser!.id,
          vote_type: type,
        })
      ).catch(() => {});
    }
  }

  public getUserTopicVote(topicId: string): 'up' | 'down' | null {
    return this.topicUserVotes[topicId] || null;
  }

  public async votePoll(pollId: string, optionId: string) {
    if (!this.currentUser) return;
    const topic = this.topics.find(t => t.poll && (t.poll.id === pollId || t.poll.options.some(o => o.id === optionId)));
    if (!topic || !topic.poll) return;

    const existingOptionId = this.pollUserVotes[pollId] || this.pollUserVotes[topic.poll.id];

    if (existingOptionId === optionId) {
      return;
    }

    if (existingOptionId) {
      const prevOpt = topic.poll.options.find(o => o.id === existingOptionId);
      if (prevOpt) prevOpt.votes = Math.max(0, prevOpt.votes - 1);
    } else {
      topic.poll.total_votes += 1;
    }

    const newOpt = topic.poll.options.find(o => o.id === optionId);
    if (newOpt) {
      newOpt.votes += 1;
    }

    this.pollUserVotes[pollId] = optionId;
    if (topic.poll.id) this.pollUserVotes[topic.poll.id] = optionId;

    this.notify();

    if (!isSupabaseConfigured()) return;

    const validUserId = await this.ensureUserInDb(this.currentUser);
    const realPollId = topic.poll.id;
    const isPollUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realPollId);
    const isOptUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(optionId);

    // 1. Record vote in discussion_poll_votes table
    if (isPollUUID && isOptUUID) {
      const voteRes = await supabaseExecute((client) =>
        client.from('discussion_poll_votes').upsert({
          poll_id: realPollId,
          user_id: validUserId,
          option_id: optionId,
        }, { onConflict: 'poll_id,user_id' })
      );

      if (voteRes.error) {
        await supabaseExecute((client) =>
          client.from('discussion_poll_votes').delete().eq('poll_id', realPollId).eq('user_id', validUserId)
        );
        await supabaseExecute((client) =>
          client.from('discussion_poll_votes').insert({
            poll_id: realPollId,
            user_id: validUserId,
            option_id: optionId,
          })
        );
      }
    }

    // 2. Update option votes count in discussion_poll_options table
    if (isOptUUID && newOpt) {
      await supabaseExecute((client) =>
        client.from('discussion_poll_options').update({ votes: newOpt.votes }).eq('id', newOpt.id)
      ).catch(() => {});
    }
    if (existingOptionId) {
      const prevOpt = topic.poll.options.find(o => o.id === existingOptionId);
      if (prevOpt && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prevOpt.id)) {
        await supabaseExecute((client) =>
          client.from('discussion_poll_options').update({ votes: prevOpt.votes }).eq('id', prevOpt.id)
        ).catch(() => {});
      }
    }

    // 3. Update total_votes in discussion_polls table
    if (isPollUUID) {
      await supabaseExecute((client) =>
        client.from('discussion_polls').update({ total_votes: topic.poll!.total_votes }).eq('id', realPollId)
      ).catch(() => {});
    }
  }

  public getUserPollVote(pollId: string): string | undefined {
    return this.pollUserVotes[pollId];
  }

  public getTopicComments(topicId: string): DiscussionComment[] {
    return this.discussionComments[topicId] || [];
  }

  public async addDiscussionComment(topicId: string, content: string, parentId?: string | null): Promise<DiscussionComment | null> {
    if (!this.currentUser) return null;
    const now = new Date().toISOString();
    const commentId = `dcomm-${Date.now()}`;

    const newComment: DiscussionComment = {
      id: commentId,
      topic_id: topicId,
      parent_id: parentId || null,
      user_id: this.currentUser.id,
      author_name: this.currentUser.full_name,
      author_handle: `@${this.currentUser.full_name.toLowerCase().replace(/\s+/g, '')}`,
      author_avatar: this.currentUser.avatar_url,
      content,
      upvotes: 0,
      downvotes: 0,
      created_at: now,
      updated_at: now,
      replies: [],
    };

    if (!this.discussionComments[topicId]) {
      this.discussionComments[topicId] = [];
    }

    if (parentId) {
      const addReply = (list: DiscussionComment[]): boolean => {
        for (const item of list) {
          if (item.id === parentId) {
            if (!item.replies) item.replies = [];
            item.replies.push(newComment);
            return true;
          }
          if (item.replies && addReply(item.replies)) return true;
        }
        return false;
      };
      addReply(this.discussionComments[topicId]);
    } else {
      this.discussionComments[topicId].unshift(newComment);
    }

    const topic = this.topics.find(t => t.id === topicId || t.slug === topicId);
    if (topic) {
      topic.comment_count += 1;
    }

    this.notify();

    if (!isSupabaseConfigured()) return newComment;

    let targetTopicUUID = topicId;
    if (topic) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topic.id);
      if (isUUID) {
        targetTopicUUID = topic.id;
      } else if (topic.slug) {
        const { data: dbTopic } = await supabaseExecute((client) =>
          client.from('discussion_topics').select('id').eq('slug', topic.slug).maybeSingle()
        );
        if (dbTopic?.id) {
          topic.id = dbTopic.id;
          targetTopicUUID = dbTopic.id;
        }
      }
    }

    const validUserId = await this.ensureUserInDb(this.currentUser);
    const commentPayload = {
      topic_id: targetTopicUUID,
      parent_id: parentId || null,
      user_id: validUserId,
      author_name: this.currentUser.full_name,
      author_handle: `@${this.currentUser.full_name.toLowerCase().replace(/\s+/g, '')}`,
      author_avatar: this.currentUser.avatar_url,
      content,
      upvotes: 0,
      downvotes: 0,
      created_at: now,
      updated_at: now,
    };

    const res = await supabaseExecute((client) =>
      client.from('discussion_comments').insert(commentPayload).select()
    );

    if (res.error) {
      console.warn('Notice saving discussion comment to Supabase (using local state fallback):', res.error?.message || res.error);
    } else if (res.data && res.data[0]) {
      newComment.id = res.data[0].id;
      this.notify();
      console.log('Discussion comment saved to Supabase startupcreme schema successfully:', res.data[0]);
    }

    if (topic) {
      const isTopicUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topic.id);
      await supabaseExecute((client) => {
        const q = client.from('discussion_topics').update({ comment_count: topic.comment_count });
        return isTopicUUID ? q.eq('id', topic.id) : q.eq('slug', topic.slug);
      });
    }

    return newComment;
  }

  public async voteComment(commentId: string, topicId: string, type: 'up' | 'down') {
    if (!this.currentUser) return;
    const commentsList = this.discussionComments[topicId] || [];
    let updatedItem: DiscussionComment | null = null;

    const findAndVote = (list: DiscussionComment[]): boolean => {
      for (const item of list) {
        if (item.id === commentId) {
          const currentVote = this.commentUserVotes[commentId];
          if (currentVote === type) {
            if (type === 'up') item.upvotes = Math.max(0, item.upvotes - 1);
            if (type === 'down') item.downvotes = Math.max(0, item.downvotes - 1);
            this.commentUserVotes[commentId] = null;
          } else {
            if (currentVote === 'up') item.upvotes = Math.max(0, item.upvotes - 1);
            if (currentVote === 'down') item.downvotes = Math.max(0, item.downvotes - 1);
            if (type === 'up') item.upvotes += 1;
            if (type === 'down') item.downvotes += 1;
            this.commentUserVotes[commentId] = type;
          }
          updatedItem = item;
          return true;
        }
        if (item.replies && findAndVote(item.replies)) return true;
      }
      return false;
    };

    findAndVote(commentsList);
    this.notify();

    if (!isSupabaseConfigured() || !updatedItem) return;

    const targetComment = updatedItem as DiscussionComment;
    const isCommentUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetComment.id);

    await supabaseExecute((client) => {
      if (isCommentUUID) {
        return client.from('discussion_comments').update({
          upvotes: targetComment.upvotes,
          downvotes: targetComment.downvotes,
        }).eq('id', targetComment.id);
      } else {
        return client.from('discussion_comments').update({
          upvotes: targetComment.upvotes,
          downvotes: targetComment.downvotes,
        }).eq('content', targetComment.content);
      }
    });

    const isUserUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.currentUser.id);
    if (isCommentUUID && isUserUUID) {
      await supabaseExecute((client) =>
        client.from('discussion_comment_votes').upsert({
          comment_id: targetComment.id,
          user_id: this.currentUser!.id,
          vote_type: type,
        })
      ).catch(() => {});
    }
  }

  public getUserCommentVote(commentId: string): 'up' | 'down' | null {
    return this.commentUserVotes[commentId] || null;
  }

  public async deleteTopic(topicId: string) {
    const topicToDelete = this.topics.find(t => t.id === topicId);
    this.topics = this.topics.filter(t => t.id !== topicId);
    delete this.discussionComments[topicId];
    this.notify();

    if (topicToDelete) {
      await supabaseExecute((client) =>
        client.from('discussion_topics').delete().or(`id.eq.${topicId},slug.eq.${topicToDelete.slug}`)
      );
    }
  }

  // Bookmarks
  public toggleBookmark(postId: string) {
    if (this.bookmarks.has(postId)) {
      this.bookmarks.delete(postId);
    } else {
      this.bookmarks.add(postId);
    }
    this.notify();
  }

  public isBookmarked(postId: string): boolean {
    return this.bookmarks.has(postId);
  }

  // Newsletter Subscribers
  public async subscribeNewsletter(email: string, source = 'footer', vertical = 'all', locale = 'en-us'): Promise<{ success: boolean; error?: string }> {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { success: false, error: 'Email address is required.' };

    if (!isSupabaseConfigured()) {
      return { 
        success: false, 
        error: 'Supabase URL & Anon Key are not configured yet. Please enter your Supabase connection keys in the Database modal.' 
      };
    }

    const payload = {
      email: trimmed,
      source,
      vertical,
      locale,
      status: 'active',
      updated_at: new Date().toISOString(),
    };

    try {
      let res = await supabaseExecute((client) =>
        client.from('newsletter_subscribers').upsert(payload, { onConflict: 'email' })
      );

      if (res.error) {
        res = await supabaseExecute((client) =>
          client.from('newsletter_subscribers').insert(payload)
        );
      }

      if (res.error) {
        const errorMsg = res.error.message || String(res.error);
        console.warn('Newsletter subscription database error:', errorMsg);
        return { success: false, error: errorMsg };
      }

      console.log('Newsletter subscription recorded in Supabase database:', trimmed);
      return { success: true };
    } catch (err: any) {
      console.warn('Newsletter subscription exception:', err);
      return { success: false, error: err?.message || 'Database execution exception' };
    }
  }
}

export const store = new StartupCremeStore();
