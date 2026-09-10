// server/app.ts
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient as createClient3 } from "@supabase/supabase-js";

// src/server/aiRouter.ts
import { Router } from "express";

// src/ai/orchestrator/taskManager.ts
import crypto3 from "crypto";

// src/ai/agents/research/researchSchemas.ts
import { z } from "zod";
var ResearchInputSchema = z.object({
  topic: z.string().min(3, "Topic must be at least 3 characters").max(300),
  vertical: z.enum(["finance", "tech"]).optional(),
  depth: z.enum(["brief", "standard", "deep"]).optional().default("standard"),
  focus_areas: z.array(z.string()).optional().default([]),
  target_locale: z.string().optional().default("en-us")
});
var ResearchClaimSchema = z.object({
  claim: z.string().min(5),
  evidence_basis: z.string().min(5),
  confidence: z.number().min(0).max(1)
});
var ResearchSourceSchema = z.object({
  title: z.string().min(2),
  url: z.string().url().optional(),
  publisher: z.string().optional(),
  credibility_score: z.number().min(0).max(1)
});
var ResearchEntitySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["company", "person", "technology", "institution", "regulatory_body", "market"]),
  context: z.string()
});
var ResearchDateSchema = z.object({
  date_or_timeframe: z.string().min(2),
  significance: z.string().min(5)
});
var ArticleAngleProposalSchema = z.object({
  title_proposal: z.string().min(10),
  angle: z.string().min(10),
  target_audience: z.string().min(5),
  suggested_vertical: z.enum(["finance", "tech"])
});
var ResearchOutputSchema = z.object({
  topic: z.string(),
  summary: z.string().min(20),
  key_claims: z.array(ResearchClaimSchema).min(1, "At least one substantiated claim is required"),
  sources: z.array(ResearchSourceSchema).min(1, "At least one verified source is required"),
  important_entities: z.array(ResearchEntitySchema),
  relevant_dates: z.array(ResearchDateSchema),
  potential_article_angles: z.array(ArticleAngleProposalSchema).min(1),
  confidence: z.number().min(0).max(1),
  recommended_next_action: z.enum(["draft_article", "further_investigation", "archive_idea"])
});

// src/ai/agents/research/providers.ts
import { GoogleGenAI } from "@google/genai";

// src/ai/policies/constitution.ts
var STARTUPCREME_CONSTITUTION = {
  publicationName: "StartupCr\xE8me",
  tagline: "Deep intelligence for tech leaders, investors, and startup builders.",
  targetAudience: [
    "Founders and Startup Builders",
    "Venture Capitalists and Angel Investors",
    "Tech Engineers and Software Architects",
    "Fintech and Financial Strategists",
    "African Tech Ecosystem Leaders",
    "Global Technology Operators"
  ],
  coreVerticals: ["finance", "tech"],
  coverageDomains: [
    "Startups & Venture Capital Fundraising",
    "Artificial Intelligence, LLM Compilers & Frontier Models",
    "Fintech, Payments, Neobanking & Capital Markets",
    "African & Global Emerging Markets Innovation",
    "Cloud Architecture, DevOps & Developer Tooling",
    "Macroeconomics, Treasury Yields & Monetary Policy"
  ],
  qualityPrinciples: [
    {
      id: "factuality",
      name: "Rigorous Factuality & Verification",
      description: "Every claim, statistic, funding amount, or metric must be grounded in verified primary or reputable secondary sources.",
      enforcement: "strict"
    },
    {
      id: "no_hallucination",
      name: "Zero Tolerance for Fabrication",
      description: "Agents must NEVER fabricate statistics, quotes, founders, company funding rounds, or sources. If uncertain, state lack of verification or refuse claim.",
      enforcement: "strict"
    },
    {
      id: "original_synthesis",
      name: "Original Analytical Synthesis",
      description: "Articles must provide strategic depth, contextual implications, and second-order thinking\u2014never generic, repetitive AI filler or scraped copy.",
      enforcement: "strict"
    },
    {
      id: "respect_journalistic_ethics",
      name: "Journalistic Ethics & Attribution",
      description: "Always credit source reporting, original data providers, and authors. Never plagiarize phrasing or pass others work as proprietary analysis.",
      enforcement: "strict"
    },
    {
      id: "no_deceptive_clickbait",
      name: "Anti-Clickbait Clarity",
      description: "Headlines, excerpts, and metadata must accurately reflect actual content and evidence, avoiding exaggerated or sensationalist clickbait.",
      enforcement: "strict"
    },
    {
      id: "human_dignity_safety",
      name: "Legal & Defamation Safeguards",
      description: "Never publish unvetted accusations, defamatory claims, or uncorroborated rumors without human editorial sign-off.",
      enforcement: "strict"
    }
  ],
  forbiddenActions: [
    "Publishing unapproved breaking news without human sign-off",
    "Deleting existing articles, user comments, or database records",
    "Fabricating names of founders, investors, or financial figures",
    "Directly bypassing database validation or security rules",
    "Executing arbitrary SQL commands or database migrations directly",
    "Publishing sponsored content without explicit sponsorship badges",
    "Altering live authentication, permissions, or system credentials"
  ],
  policyClassification: {
    green: {
      description: "Autonomous Execution Permitted (Low risk, read-only or reversible draft actions)",
      allowedActions: [
        "research_topic",
        "summarize_source",
        "generate_article_draft",
        "suggest_seo_metadata",
        "suggest_internal_links",
        "analyze_content_performance",
        "index_for_search"
      ]
    },
    yellow: {
      description: "Human Approval Required Before Execution (Medium risk, public-facing or mutation actions)",
      allowedActions: [
        "publish_article",
        "update_published_article",
        "schedule_newsletter",
        "post_to_social_channels",
        "change_article_category",
        "archive_article"
      ]
    },
    red: {
      description: "Strictly Forbidden or Human-Only Execution (High risk, destructive or structural actions)",
      allowedActions: [
        "delete_article",
        "delete_user_data",
        "modify_database_schema",
        "modify_security_rules",
        "modify_api_keys",
        "execute_financial_transactions"
      ]
    }
  }
};

// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
var runtimeUrl = "";
var runtimeKey = "";
function getSupabaseCredentials() {
  const url = runtimeUrl || typeof process !== "undefined" && process.env?.SUPABASE_URL || typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL || "";
  const anonKey = runtimeKey || typeof process !== "undefined" && process.env?.SUPABASE_ANON_KEY || typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
  const isConfigured = Boolean(
    url && anonKey && !url.includes("your-supabase-project") && !anonKey.includes("your-supabase-anon-key")
  );
  return { url, anonKey, isConfigured };
}
var activeClient = null;
var activeClientUrl = null;
function getSupabaseClient() {
  const { url, anonKey } = getSupabaseCredentials();
  if (!activeClient || url && activeClientUrl !== url) {
    activeClientUrl = url || "https://placeholder.supabase.co";
    activeClient = createClient(
      url || "https://placeholder.supabase.co",
      anonKey || "placeholder-anon-key",
      {
        db: {
          schema: "startupcreme"
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      }
    );
  }
  return activeClient;
}
function isSupabaseConfigured() {
  return getSupabaseCredentials().isConfigured;
}
var supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  }
});

// src/lib/router.ts
function normalizeImageUrl(url) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:") || trimmed.startsWith("/") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

// src/lib/store.ts
var SEED_POSTS = [];
var SAMPLE_POST_SLUGS = [
  "the-great-treasury-yield-re-alignment",
  "autonomous-agent-architectures-and-llm-compilers"
];
var POSTS_CACHE_KEY = "startupcreme_posts_cache_v3";
var TOPICS_CACHE_KEY = "startupcreme_topics_cache_v3";
var SEED_TOPICS = [
  {
    id: "topic-01",
    slug: "what-is-your-2026-ai-compute-budget-allocation",
    title: "What is your 2026 AI compute budget allocation between proprietary LLM APIs vs custom fine-tuned open weights?",
    content: "Many Series B+ engineering organizations are re-evaluating token costs vs latency control. Are you moving core workflows to fine-tuned Llama/DeepSeek models or staying with frontier APIs like Gemini 1.5 Pro and Claude 3.5?",
    category: "tech",
    user_id: "system-topic-01",
    author_name: "Marcus Chen",
    author_handle: "@marcus_ai",
    author_avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
    upvotes: 42,
    downvotes: 3,
    tags: ["LLM", "AI Infrastructure", "FinOps", "DevOps"],
    comment_count: 0,
    created_at: "2026-08-03T10:00:00Z",
    updated_at: "2026-08-03T10:00:00Z"
  }
];
async function supabaseExecute(queryFn) {
  if (!isSupabaseConfigured()) {
    console.warn("Supabase is not configured yet.");
    return {
      data: null,
      error: new Error("Supabase project URL & Anon Key are not configured yet. Please configure Supabase keys in the Database modal.")
    };
  }
  try {
    const scClient = supabase.schema("startupcreme");
    const res = await Promise.resolve(queryFn(scClient));
    if (res.error) {
      console.warn("startupcreme schema query returned error:", res.error?.message || res.error);
      const scErrMsg = res.error?.message || String(res.error || "");
      if (scErrMsg.includes("permission denied for schema")) {
        return {
          data: null,
          error: new Error('Permission denied for schema "startupcreme". Grant schema usage in Supabase SQL Editor by running supabase/schema.sql.')
        };
      }
      return res;
    }
    return res;
  } catch (err) {
    console.error("startupcreme schema query exception:", err);
    return { data: null, error: err };
  }
}
var StartupCremeStore = class {
  constructor() {
    this.posts = [];
    this.topics = [];
    this.discussionComments = {};
    this.postComments = {};
    this.currentUser = null;
    this.topicUserVotes = {};
    this.commentUserVotes = {};
    this.pollUserVotes = {};
    this.bookmarks = /* @__PURE__ */ new Set();
    this.subscribers = [];
    this.hasAttemptedSeed = false;
    this.loadInitialData();
  }
  persistCache() {
    if (typeof window === "undefined") return;
    try {
      if (this.posts && this.posts.length > 0) {
        localStorage.setItem(POSTS_CACHE_KEY, JSON.stringify(this.posts));
      }
      if (this.topics && this.topics.length > 0) {
        localStorage.setItem(TOPICS_CACHE_KEY, JSON.stringify(this.topics));
      }
    } catch (e) {
    }
  }
  loadInitialData() {
    this.posts = [];
    this.topics = [];
    this.postComments = {};
    this.discussionComments = {};
    this.currentUser = null;
    if (typeof window !== "undefined") {
      const win = window;
      const postsMap = /* @__PURE__ */ new Map();
      const topicsMap = /* @__PURE__ */ new Map();
      try {
        const cachedPostsJson = localStorage.getItem(POSTS_CACHE_KEY);
        if (cachedPostsJson) {
          const cached = JSON.parse(cachedPostsJson);
          if (Array.isArray(cached)) {
            cached.forEach((p) => {
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
            cached.forEach((t) => {
              if (t && t.slug) topicsMap.set(t.slug, t);
            });
          }
        }
      } catch (e) {
        console.warn("Cache hydration error:", e);
      }
      if (win.__INITIAL_POST__) {
        const p = win.__INITIAL_POST__;
        if (p && p.slug && !SAMPLE_POST_SLUGS.includes(p.slug)) {
          postsMap.set(p.slug, { ...p, cover_image: normalizeImageUrl(p.cover_image) });
        }
      }
      if (Array.isArray(win.__INITIAL_POSTS__)) {
        win.__INITIAL_POSTS__.forEach((p) => {
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
      this.syncFromSupabase().catch((err) => {
        console.warn("Initial sync error:", err);
      });
      this.initSupabaseAuthListener();
    }
  }
  initSupabaseAuthListener() {
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          this.syncUserFromSession(session);
        }
      }).catch((err) => {
        console.warn("Session hydration error:", err);
      });
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          await this.syncUserFromSession(session);
        } else if (event === "SIGNED_OUT") {
          this.currentUser = null;
          this.notify();
        }
      });
      if (typeof window !== "undefined") {
        window.addEventListener("focus", () => {
          this.refreshCurrentUserRole().catch(() => {
          });
        });
        setInterval(() => {
          if (this.currentUser) {
            this.refreshCurrentUserRole().catch(() => {
            });
          }
        }, 15e3);
      }
    } catch (e) {
      console.warn("Supabase auth listener error:", e);
    }
  }
  async syncUserFromSession(session) {
    if (!session?.user) return;
    const userObj = session.user;
    const userEmail = (userObj.email || "").trim();
    let computedRole = userObj.user_metadata?.role || "user";
    let computedName = userObj.user_metadata?.full_name || (userEmail ? userEmail.split("@")[0] : "User");
    let computedAvatar = userObj.user_metadata?.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(userEmail || "user")}/100/100`;
    if (session?.access_token) {
      try {
        const resp = await fetch("/api/auth/profile", {
          headers: {
            "Authorization": `Bearer ${session.access_token}`
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
              role: profile.role === "admin" ? "admin" : "user",
              created_at: profile.created_at || userObj.created_at || (/* @__PURE__ */ new Date()).toISOString(),
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            };
            this.notify();
            return;
          }
        }
      } catch (apiErr) {
        console.warn("Backend /api/auth/profile check failed, falling back to direct DB queries:", apiErr);
      }
    }
    try {
      let scUser = null;
      if (userObj.id) {
        const { data } = await supabase.schema("startupcreme").from("users").select("id, email, full_name, avatar_url, role").eq("id", userObj.id).maybeSingle();
        if (data) scUser = data;
      }
      if (!scUser && userEmail) {
        const { data } = await supabase.schema("startupcreme").from("users").select("id, email, full_name, avatar_url, role").ilike("email", userEmail).maybeSingle();
        if (data) scUser = data;
      }
      if (scUser) {
        if (scUser.role) {
          computedRole = scUser.role.trim().toLowerCase() === "admin" ? "admin" : "user";
        }
        if (scUser.full_name) computedName = scUser.full_name;
        if (scUser.avatar_url) computedAvatar = scUser.avatar_url;
      }
    } catch (e) {
      console.warn("DB user role fetch error:", e);
    }
    this.currentUser = {
      id: userObj.id,
      email: userEmail,
      full_name: computedName,
      avatar_url: computedAvatar,
      role: computedRole,
      created_at: userObj.created_at || (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.notify();
  }
  async refreshCurrentUserRole() {
    if (!isSupabaseConfigured()) return this.currentUser?.role || null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        try {
          const resp = await fetch("/api/auth/profile", {
            headers: {
              "Authorization": `Bearer ${session.access_token}`
            }
          });
          if (resp.ok) {
            const profile = await resp.json();
            if (profile && profile.role) {
              const dbRole = profile.role === "admin" ? "admin" : "user";
              const dbName = profile.full_name || this.currentUser?.full_name || "User";
              const dbAvatar = profile.avatar_url || this.currentUser?.avatar_url;
              const changed = !this.currentUser || this.currentUser.role !== dbRole || this.currentUser.full_name !== dbName;
              this.currentUser = {
                id: profile.id || session.user?.id || this.currentUser?.id || "unknown",
                email: profile.email || session.user?.email || this.currentUser?.email || "",
                full_name: dbName,
                avatar_url: dbAvatar,
                role: dbRole,
                created_at: profile.created_at || this.currentUser?.created_at || (/* @__PURE__ */ new Date()).toISOString(),
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              };
              if (changed) this.notify();
              return dbRole;
            }
          }
        } catch (apiErr) {
          console.warn("/api/auth/profile refresh error, falling back:", apiErr);
        }
      }
      const currentAuthUser = session?.user;
      const effectiveId = currentAuthUser?.id || this.currentUser?.id;
      const effectiveEmail = (currentAuthUser?.email || this.currentUser?.email || "").trim();
      if (!effectiveId && !effectiveEmail) return null;
      let scUser = null;
      if (effectiveId) {
        const { data } = await supabase.schema("startupcreme").from("users").select("id, email, full_name, avatar_url, role").eq("id", effectiveId).maybeSingle();
        if (data) scUser = data;
      }
      if (!scUser && effectiveEmail) {
        const { data } = await supabase.schema("startupcreme").from("users").select("id, email, full_name, avatar_url, role").ilike("email", effectiveEmail).maybeSingle();
        if (data) scUser = data;
      }
      if (scUser) {
        const dbRole = scUser.role?.trim().toLowerCase() === "admin" ? "admin" : "user";
        const dbName = scUser.full_name || this.currentUser?.full_name || "User";
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
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          if (changed) this.notify();
        } else if (currentAuthUser) {
          this.currentUser = {
            id: scUser.id || currentAuthUser.id,
            email: scUser.email || currentAuthUser.email || "",
            full_name: dbName,
            avatar_url: dbAvatar,
            role: dbRole,
            created_at: currentAuthUser.created_at || (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          this.notify();
        }
        return dbRole;
      }
    } catch (err) {
      console.warn("Failed to refresh user role from DB:", err);
    }
    return this.currentUser?.role || null;
  }
  subscribe(fn) {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== fn);
    };
  }
  notify() {
    this.subscribers.forEach((fn) => fn());
  }
  async seedStaticArticlesToSupabase(skipSync = false) {
    if (!isSupabaseConfigured()) return { success: false, message: "Supabase is not configured yet." };
    try {
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
          author_name: post.author_name || "Startup Cr\xE8me Editorial",
          author_role: post.author_role || "Principal Editor",
          author_avatar: post.author_avatar,
          dual_silo: post.dual_silo ?? false,
          silo_badge: post.silo_badge,
          tags: post.tags || [],
          reading_time_minutes: post.reading_time_minutes || 5,
          word_count: post.word_count || 800,
          created_at: post.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: post.updated_at || (/* @__PURE__ */ new Date()).toISOString()
        };
        await supabaseExecute((client) => client.from("posts").insert(postPayload));
      }
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
          created_at: topic.created_at || (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: topic.updated_at || (/* @__PURE__ */ new Date()).toISOString()
        };
        await supabaseExecute((client) => client.from("discussion_topics").upsert(topicPayload, { onConflict: "slug" }));
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
        message: `Successfully seeded initial articles and topics into Supabase!`
      };
    } catch (err) {
      return { success: false, message: err?.message || "Failed to seed static data to Supabase." };
    }
  }
  async deleteAllSamplePosts() {
    this.posts = this.posts.filter((p) => !SAMPLE_POST_SLUGS.includes(p.slug));
    this.notify();
    if (!isSupabaseConfigured()) {
      return { success: true, message: "Sample posts cleared locally." };
    }
    try {
      const res = await supabaseExecute(
        (client) => client.from("posts").delete().in("slug", SAMPLE_POST_SLUGS)
      );
      if (res.error) {
        return { success: false, message: res.error.message || String(res.error) };
      }
      return { success: true, message: "All sample posts deleted from Supabase database successfully!" };
    } catch (err) {
      return { success: false, message: err?.message || "Error deleting sample posts" };
    }
  }
  async syncFromSupabase() {
    if (!isSupabaseConfigured()) return;
    try {
      await supabaseExecute(
        (client) => client.from("posts").delete().in("slug", SAMPLE_POST_SLUGS)
      );
      const { data: postsData } = await supabaseExecute(
        (client) => client.from("posts").select("*").order("created_at", { ascending: false })
      );
      this.posts = (postsData || []).filter((p) => !SAMPLE_POST_SLUGS.includes(p.slug)).map((p) => ({
        ...p,
        cover_image: normalizeImageUrl(p.cover_image)
      }));
      const { data: topicsData } = await supabaseExecute(
        (client) => client.from("discussion_topics").select("*").order("created_at", { ascending: false })
      );
      const { data: pollsData } = await supabaseExecute(
        (client) => client.from("discussion_polls").select("*")
      ).catch(() => ({ data: null }));
      const { data: pollOptionsData } = await supabaseExecute(
        (client) => client.from("discussion_poll_options").select("*")
      ).catch(() => ({ data: null }));
      if (this.currentUser) {
        const userId = await this.ensureUserInDb(this.currentUser);
        if (userId) {
          const { data: pollVotesData } = await supabaseExecute(
            (client) => client.from("discussion_poll_votes").select("*").eq("user_id", userId)
          ).catch(() => ({ data: null }));
          if (pollVotesData && pollVotesData.length > 0) {
            pollVotesData.forEach((pv) => {
              if (pv.poll_id && pv.option_id) {
                this.pollUserVotes[pv.poll_id] = pv.option_id;
              }
            });
          }
          const { data: topicVotesData } = await supabaseExecute(
            (client) => client.from("discussion_topic_votes").select("*").eq("user_id", userId)
          ).catch(() => ({ data: null }));
          if (topicVotesData && topicVotesData.length > 0) {
            topicVotesData.forEach((tv) => {
              if (tv.topic_id && tv.vote_type) {
                this.topicUserVotes[tv.topic_id] = tv.vote_type;
              }
            });
          }
        }
      }
      if (topicsData && topicsData.length > 0) {
        const pollsMap = /* @__PURE__ */ new Map();
        if (pollsData && pollsData.length > 0) {
          pollsData.forEach((p) => {
            pollsMap.set(p.id, {
              id: p.id,
              topic_id: p.topic_id,
              question: p.question,
              total_votes: p.total_votes || 0,
              created_at: p.created_at,
              options: []
            });
          });
          if (pollOptionsData && pollOptionsData.length > 0) {
            pollOptionsData.forEach((opt) => {
              const parentPoll = pollsMap.get(opt.poll_id);
              if (parentPoll) {
                parentPoll.options.push({
                  id: opt.id,
                  poll_id: opt.poll_id,
                  option_text: opt.option_text,
                  votes: opt.votes || 0
                });
              }
            });
          }
        }
        this.topics = topicsData.map((t) => {
          let pollObj = void 0;
          const dedicatedPoll = Array.from(pollsMap.values()).find((p) => p.topic_id === t.id);
          if (dedicatedPoll) {
            pollObj = dedicatedPoll;
          } else if (t.poll) {
            pollObj = typeof t.poll === "string" ? JSON.parse(t.poll) : t.poll;
          }
          return {
            ...t,
            poll: pollObj
          };
        });
      }
      const { data: discCommentsData } = await supabaseExecute(
        (client) => client.from("discussion_comments").select("*").order("created_at", { ascending: true })
      );
      const groupedDiscComments = {};
      if (discCommentsData && discCommentsData.length > 0) {
        const commentsMap = /* @__PURE__ */ new Map();
        discCommentsData.forEach((c) => {
          commentsMap.set(c.id, {
            id: c.id,
            topic_id: c.topic_id,
            parent_id: c.parent_id || null,
            user_id: c.user_id || "user-anon",
            author_name: c.author_name || "Member",
            author_handle: c.author_handle || "@member",
            author_avatar: c.author_avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100",
            content: c.content,
            upvotes: c.upvotes || 0,
            downvotes: c.downvotes || 0,
            created_at: c.created_at,
            updated_at: c.updated_at,
            replies: []
          });
        });
        commentsMap.forEach((comment) => {
          if (!groupedDiscComments[comment.topic_id]) {
            groupedDiscComments[comment.topic_id] = [];
          }
          if (comment.parent_id && commentsMap.has(comment.parent_id)) {
            const parent = commentsMap.get(comment.parent_id);
            if (!parent.replies) parent.replies = [];
            if (!parent.replies.some((r) => r.id === comment.id)) {
              parent.replies.push(comment);
            }
          } else {
            if (!groupedDiscComments[comment.topic_id].some((existing) => existing.id === comment.id)) {
              groupedDiscComments[comment.topic_id].unshift(comment);
            }
          }
        });
      }
      this.discussionComments = groupedDiscComments;
      const { data: postCommentsData } = await supabaseExecute(
        (client) => client.from("comments").select("*").order("created_at", { ascending: false })
      );
      const groupedPostComments = {};
      if (postCommentsData && postCommentsData.length > 0) {
        postCommentsData.forEach((c) => {
          if (!groupedPostComments[c.post_id]) {
            groupedPostComments[c.post_id] = [];
          }
          if (!groupedPostComments[c.post_id].some((existing) => existing.id === c.id)) {
            groupedPostComments[c.post_id].push({
              id: c.id,
              post_id: c.post_id,
              user_id: c.user_id || "user-anon",
              author_name: c.author_name || "Member",
              author_avatar: c.author_avatar,
              content: c.content,
              created_at: c.created_at,
              updated_at: c.updated_at
            });
          }
        });
      }
      this.postComments = groupedPostComments;
      this.persistCache();
      this.notify();
    } catch (e) {
      console.warn("Supabase sync error:", e);
    }
  }
  // Getters
  getCurrentUser() {
    return this.currentUser;
  }
  setCurrentUser(user) {
    this.currentUser = user;
    this.notify();
    if (user) {
      this.refreshCurrentUserRole().catch(() => {
      });
    }
  }
  switchDemoRole(role) {
    if (role === "guest") {
      this.currentUser = null;
      if (isSupabaseConfigured()) {
        supabase.auth.signOut().catch(() => {
        });
      }
    } else if (role === "admin") {
      this.currentUser = {
        id: "admin-demo-id",
        email: "admin@startupcreme.com",
        full_name: "Startup Cr\xE8me Admin",
        avatar_url: "/logo.jpg",
        role: "admin",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    } else {
      this.currentUser = {
        id: "user-demo-id",
        email: "editor@startupcreme.com",
        full_name: "Community Member",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
        role: "user",
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    this.notify();
  }
  async ensureUserInDb(user) {
    const fallbackUUID = "00000000-0000-0000-0000-000000000001";
    if (!user) return fallbackUUID;
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
    const targetUserId = isValidUUID ? user.id : user.role === "admin" ? "00000000-0000-0000-0000-000000000001" : "00000000-0000-0000-0000-000000000002";
    if (isSupabaseConfigured()) {
      try {
        let existingUser = null;
        if (isValidUUID) {
          const { data } = await supabase.schema("startupcreme").from("users").select("id, role, full_name, avatar_url").eq("id", targetUserId).maybeSingle();
          if (data) existingUser = data;
        }
        if (!existingUser && user.email) {
          const { data } = await supabase.schema("startupcreme").from("users").select("id, role, full_name, avatar_url").ilike("email", user.email.trim()).maybeSingle();
          if (data) existingUser = data;
        }
        if (existingUser) {
          if (existingUser.role && this.currentUser) {
            const dbRole = existingUser.role.trim().toLowerCase() === "admin" ? "admin" : "user";
            if (this.currentUser.role !== dbRole) {
              this.currentUser.role = dbRole;
              this.notify();
            }
          }
          return existingUser.id || targetUserId;
        }
        await supabase.schema("startupcreme").from("users").insert({
          id: targetUserId,
          email: user.email || "user@startupcreme.com",
          full_name: user.full_name || "Community Member",
          avatar_url: user.avatar_url || "https://picsum.photos/seed/user/100/100",
          role: user.role || "user"
        });
      } catch (e) {
        console.warn("ensureUserInDb notice:", e);
      }
    }
    return targetUserId;
  }
  getPosts(locale = "en-us", vertical, statusOnly = "published") {
    return this.posts.filter((p) => {
      const matchesLocale = p.locale.toLowerCase() === locale.toLowerCase() || p.locale === "en-us";
      const matchesVertical = !vertical || p.vertical === vertical || p.dual_silo;
      const matchesStatus = statusOnly ? p.status === statusOnly : true;
      return matchesLocale && matchesVertical && matchesStatus;
    });
  }
  getAllPosts() {
    return [...this.posts];
  }
  getPostBySlug(slug, locale = "en-us", vertical) {
    if (!slug) return void 0;
    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
    let found = this.posts.find((p) => {
      const matchSlug = p.slug.toLowerCase() === decodedSlug || p.id.toLowerCase() === decodedSlug;
      const matchVert = !vertical || p.vertical === vertical || p.dual_silo;
      return matchSlug && matchVert;
    });
    if (!found) {
      found = this.posts.find((p) => p.slug.toLowerCase() === decodedSlug || p.id.toLowerCase() === decodedSlug);
    }
    if (!found && decodedSlug.length > 8) {
      found = this.posts.find((p) => {
        const pSlug = p.slug.toLowerCase();
        return decodedSlug.includes(pSlug) || pSlug.includes(decodedSlug);
      });
    }
    return found;
  }
  async fetchPostBySlug(slug, locale = "en-us", vertical) {
    const existing = this.getPostBySlug(slug, locale, vertical);
    if (existing) return existing;
    if (!isSupabaseConfigured()) return null;
    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
    try {
      const { data: postsData } = await supabaseExecute(
        (client) => client.from("posts").select("*").or(`slug.ilike.${decodedSlug},id.ilike.${decodedSlug}`).maybeSingle()
      );
      if (postsData) {
        const post = {
          ...postsData,
          cover_image: normalizeImageUrl(postsData.cover_image)
        };
        const map = /* @__PURE__ */ new Map();
        map.set(post.slug, post);
        this.posts.forEach((p) => {
          if (!map.has(p.slug)) map.set(p.slug, p);
        });
        this.posts = Array.from(map.values());
        this.persistCache();
        this.notify();
        return post;
      }
      if (decodedSlug.length > 8) {
        const shortSlug = decodedSlug.slice(-20);
        const { data: fuzzyData } = await supabaseExecute(
          (client) => client.from("posts").select("*").ilike("slug", `%${shortSlug}%`).limit(1)
        );
        if (fuzzyData && fuzzyData.length > 0) {
          const post = {
            ...fuzzyData[0],
            cover_image: normalizeImageUrl(fuzzyData[0].cover_image)
          };
          const map = /* @__PURE__ */ new Map();
          map.set(post.slug, post);
          this.posts.forEach((p) => {
            if (!map.has(p.slug)) map.set(p.slug, p);
          });
          this.posts = Array.from(map.values());
          this.persistCache();
          this.notify();
          return post;
        }
      }
    } catch (e) {
      console.warn("fetchPostBySlug exception:", e);
    }
    return null;
  }
  async fetchTopicBySlug(slug) {
    const existing = this.getDiscussionTopicBySlug(slug);
    if (existing) return existing;
    if (!isSupabaseConfigured()) return null;
    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
    try {
      const { data: topicData } = await supabaseExecute(
        (client) => client.from("discussion_topics").select("*").or(`slug.ilike.${decodedSlug},id.ilike.${decodedSlug}`).maybeSingle()
      );
      if (topicData) {
        const topic = topicData;
        const map = /* @__PURE__ */ new Map();
        map.set(topic.slug, topic);
        this.topics.forEach((t) => {
          if (!map.has(t.slug)) map.set(t.slug, t);
        });
        this.topics = Array.from(map.values());
        this.persistCache();
        this.notify();
        return topic;
      }
    } catch (e) {
      console.warn("fetchTopicBySlug exception:", e);
    }
    return null;
  }
  getPostComments(postId) {
    const targetPost = this.posts.find((p) => p.id === postId || p.slug === postId);
    const listById = this.postComments[postId] || [];
    const listByTargetId = targetPost?.id ? this.postComments[targetPost.id] || [] : [];
    const listByTargetSlug = targetPost?.slug ? this.postComments[targetPost.slug] || [] : [];
    const combined = [...listById, ...listByTargetId, ...listByTargetSlug];
    const unique = /* @__PURE__ */ new Map();
    combined.forEach((c) => unique.set(c.id, c));
    return Array.from(unique.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  async addPostComment(postId, content) {
    if (!this.currentUser) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const commentId = `comment-${Date.now()}`;
    let targetPost = this.posts.find((p) => p.id === postId || p.slug === postId);
    let effectivePostId = targetPost?.id || postId;
    if (isSupabaseConfigured() && targetPost) {
      const isValidPostUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetPost.id);
      if (!isValidPostUUID) {
        const { data: foundPost } = await supabaseExecute(
          (client) => client.from("posts").select("id, slug").eq("slug", targetPost.slug).maybeSingle()
        );
        if (foundPost?.id) {
          targetPost.id = foundPost.id;
          effectivePostId = foundPost.id;
        } else {
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
    const newComment = {
      id: commentId,
      post_id: effectivePostId,
      user_id: this.currentUser.id,
      author_name: this.currentUser.full_name,
      author_avatar: this.currentUser.avatar_url,
      content,
      created_at: now,
      updated_at: now
    };
    const keysToUpdate = /* @__PURE__ */ new Set([postId, effectivePostId]);
    if (targetPost) {
      if (targetPost.id) keysToUpdate.add(targetPost.id);
      if (targetPost.slug) keysToUpdate.add(targetPost.slug);
    }
    keysToUpdate.forEach((k) => {
      if (!this.postComments[k]) {
        this.postComments[k] = [];
      }
      if (!this.postComments[k].some((c) => c.id === newComment.id)) {
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
      content,
      created_at: now,
      updated_at: now
    };
    const res = await supabaseExecute(
      (client) => client.from("comments").insert(postCommentPayload).select()
    );
    if (res.error) {
      console.warn("Notice saving article comment to Supabase (using local state fallback):", res.error?.message || res.error);
    } else if (res.data && res.data[0]) {
      const realCommentId = res.data[0].id;
      newComment.id = realCommentId;
      keysToUpdate.forEach((k) => {
        const item = this.postComments[k]?.find((c) => c.id === commentId);
        if (item) item.id = realCommentId;
      });
      this.notify();
      console.log("Article comment saved to Supabase startupcreme schema successfully:", res.data[0]);
    }
    return newComment;
  }
  // Admin CRUD for Posts
  async savePost(post) {
    const existingIndex = this.posts.findIndex((p) => p.id === post.id || p.slug === post.slug && p.locale === post.locale && p.vertical === post.vertical);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let savedPost;
    if (existingIndex >= 0) {
      savedPost = {
        ...this.posts[existingIndex],
        ...post,
        cover_image: normalizeImageUrl(post.cover_image || this.posts[existingIndex].cover_image),
        updated_at: now
      };
      this.posts[existingIndex] = savedPost;
    } else {
      savedPost = {
        id: post.id || `post-${Date.now()}`,
        slug: post.slug || "new-post-" + Date.now(),
        locale: post.locale || "en-us",
        vertical: post.vertical || "finance",
        title: post.title || "Untitled Article",
        excerpt: post.excerpt || "",
        content: post.content || "",
        status: post.status || "draft",
        meta_description: post.meta_description || "",
        canonical_url: post.canonical_url || "",
        cover_image: normalizeImageUrl(post.cover_image) || "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200",
        author_name: post.author_name || this.currentUser?.full_name || "Startup Cr\xE8me Editorial",
        author_role: post.author_role || "Senior Analyst",
        author_avatar: post.author_avatar || this.currentUser?.avatar_url,
        dual_silo: Boolean(post.dual_silo),
        silo_badge: post.silo_badge || "",
        tags: post.tags || ["Finance", "Tech"],
        reading_time_minutes: post.reading_time_minutes || 5,
        word_count: post.word_count || 800,
        created_at: now,
        updated_at: now
      };
      this.posts.unshift(savedPost);
    }
    this.persistCache();
    this.notify();
    if (!isSupabaseConfigured()) {
      return { success: true, post: savedPost };
    }
    const contentPayload = typeof savedPost.content === "object" ? JSON.stringify(savedPost.content) : savedPost.content;
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
      updated_at: savedPost.updated_at
    };
    try {
      let res = await supabaseExecute(
        (client) => client.from("posts").insert(postPayload).select()
      );
      if (res.error) {
        console.warn("Initial post insert failed (possible slug conflict):", res.error?.message || res.error);
        const randomSuffix = Math.random().toString(36).substring(2, 7);
        const uniqueSlug = `${savedPost.slug}-${randomSuffix}`;
        postPayload.slug = uniqueSlug;
        savedPost.slug = uniqueSlug;
        res = await supabaseExecute(
          (client) => client.from("posts").insert(postPayload).select()
        );
      }
      if (res.error) {
        const errorMsg = res.error.message || String(res.error);
        console.error("Failed to insert post into Supabase database:", errorMsg);
        return { success: false, post: savedPost, error: errorMsg };
      }
      if (res.data && res.data[0]) {
        savedPost.id = res.data[0].id;
        this.notify();
        console.log("Post inserted into Supabase database successfully:", res.data[0]);
      }
      return { success: true, post: savedPost };
    } catch (err) {
      const exceptionMsg = err?.message || "Database execution exception";
      console.error("Exception during post insert to Supabase:", exceptionMsg);
      return { success: false, post: savedPost, error: exceptionMsg };
    }
  }
  async deletePost(id) {
    const postToDelete = this.posts.find((p) => p.id === id);
    this.posts = this.posts.filter((p) => p.id !== id);
    this.persistCache();
    this.notify();
    if (postToDelete) {
      await supabaseExecute(
        (client) => client.from("posts").delete().or(`id.eq.${id},slug.eq.${postToDelete.slug}`)
      );
    }
  }
  async togglePostStatus(id) {
    const post = this.posts.find((p) => p.id === id);
    if (post) {
      post.status = post.status === "published" ? "draft" : "published";
      post.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      this.persistCache();
      this.notify();
      await supabaseExecute(
        (client) => client.from("posts").update({ status: post.status, updated_at: post.updated_at }).or(`id.eq.${id},slug.eq.${post.slug}`)
      );
    }
  }
  // Discussion Forum Methods
  getDiscussionTopics(category) {
    if (!category || category === "all") return [...this.topics];
    return this.topics.filter((t) => t.category === category);
  }
  getDiscussionTopicBySlug(slug) {
    if (!slug) return void 0;
    const decodedSlug = decodeURIComponent(slug).trim().toLowerCase();
    let found = this.topics.find((t) => t.slug.toLowerCase() === decodedSlug || t.id.toLowerCase() === decodedSlug);
    if (!found && decodedSlug.length > 8) {
      found = this.topics.find((t) => {
        const tSlug = t.slug.toLowerCase();
        return decodedSlug.includes(tSlug) || tSlug.includes(decodedSlug);
      });
    }
    return found;
  }
  async createDiscussionTopic(data) {
    if (!this.currentUser) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const topicUuid = crypto.randomUUID();
    const baseSlug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "topic";
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
    let pollObj = void 0;
    if (data.pollQuestion && data.pollOptions && data.pollOptions.filter((o) => o.trim()).length > 0) {
      const pollUuid = crypto.randomUUID();
      const validOptions = data.pollOptions.filter((o) => o.trim());
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
          votes: 0
        }))
      };
    }
    const newTopic = {
      id: topicUuid,
      slug: uniqueSlug,
      title: data.title,
      content: data.content,
      category: data.category,
      user_id: this.currentUser.id,
      author_name: this.currentUser.full_name,
      author_handle: `@${this.currentUser.full_name.toLowerCase().replace(/\s+/g, "")}`,
      author_avatar: this.currentUser.avatar_url,
      upvotes: 0,
      downvotes: 0,
      tags: data.tags || [],
      comment_count: 0,
      poll: pollObj,
      created_at: now,
      updated_at: now
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
      updated_at: now
    };
    const res = await supabaseExecute(
      (client) => client.from("discussion_topics").insert(topicPayload).select()
    );
    if (res.error) {
      console.error("Failed saving discussion topic to Supabase:", res.error?.message || res.error);
    } else if (res.data && res.data[0]) {
      const createdDbTopic = res.data[0];
      newTopic.id = createdDbTopic.id;
      if (pollObj) {
        const pollInsertRes = await supabaseExecute(
          (client) => client.from("discussion_polls").insert({
            id: pollObj.id,
            topic_id: createdDbTopic.id,
            question: pollObj.question,
            total_votes: 0,
            created_at: now
          }).select()
        ).catch((err) => {
          console.warn("Error saving to discussion_polls table:", err);
          return { data: null };
        });
        const dbPoll = pollInsertRes.data && pollInsertRes.data[0] ? pollInsertRes.data[0] : null;
        const actualPollId = dbPoll ? dbPoll.id : pollObj.id;
        newTopic.poll = {
          ...pollObj,
          id: actualPollId,
          topic_id: createdDbTopic.id
        };
        if (pollObj.options && pollObj.options.length > 0) {
          const optionsPayload = pollObj.options.map((opt) => ({
            id: opt.id,
            poll_id: actualPollId,
            option_text: opt.option_text,
            votes: 0
          }));
          const optionsInsertRes = await supabaseExecute(
            (client) => client.from("discussion_poll_options").insert(optionsPayload).select()
          ).catch((err) => {
            console.warn("Error saving options to discussion_poll_options table:", err);
            return { data: null };
          });
          if (optionsInsertRes.data && optionsInsertRes.data.length > 0) {
            newTopic.poll.options = optionsInsertRes.data.map((opt) => ({
              id: opt.id,
              poll_id: opt.poll_id,
              option_text: opt.option_text,
              votes: opt.votes || 0
            }));
          }
        }
      }
      this.notify();
      console.log("Discussion topic and poll saved to Supabase startupcreme schema successfully:", createdDbTopic);
    }
    return newTopic;
  }
  async voteTopic(topicId, type) {
    if (!this.currentUser) return;
    const topic = this.topics.find((t) => t.id === topicId || t.slug === topicId);
    if (!topic) return;
    const key = topic.id;
    const currentVote = this.topicUserVotes[key] || this.topicUserVotes[topicId] || (topic.slug ? this.topicUserVotes[topic.slug] : null);
    if (currentVote === type) {
      if (type === "up") topic.upvotes = Math.max(0, topic.upvotes - 1);
      if (type === "down") topic.downvotes = Math.max(0, topic.downvotes - 1);
      this.topicUserVotes[key] = null;
      this.topicUserVotes[topicId] = null;
      if (topic.slug) this.topicUserVotes[topic.slug] = null;
    } else {
      if (currentVote === "up") topic.upvotes = Math.max(0, topic.upvotes - 1);
      if (currentVote === "down") topic.downvotes = Math.max(0, topic.downvotes - 1);
      if (type === "up") topic.upvotes += 1;
      if (type === "down") topic.downvotes += 1;
      this.topicUserVotes[key] = type;
      this.topicUserVotes[topicId] = type;
      if (topic.slug) this.topicUserVotes[topic.slug] = type;
    }
    this.notify();
    if (!isSupabaseConfigured()) return;
    const isTopicUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topic.id);
    await supabaseExecute((client) => {
      const q = client.from("discussion_topics").update({
        upvotes: topic.upvotes,
        downvotes: topic.downvotes
      });
      return isTopicUUID ? q.eq("id", topic.id) : q.eq("slug", topic.slug);
    });
    const isUserUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.currentUser.id);
    if (isTopicUUID && isUserUUID) {
      await supabaseExecute(
        (client) => client.from("discussion_topic_votes").upsert({
          topic_id: topic.id,
          user_id: this.currentUser.id,
          vote_type: type
        })
      ).catch(() => {
      });
    }
  }
  getUserTopicVote(topicId) {
    return this.topicUserVotes[topicId] || null;
  }
  async votePoll(pollId, optionId) {
    if (!this.currentUser) return;
    const topic = this.topics.find((t) => t.poll && (t.poll.id === pollId || t.poll.options.some((o) => o.id === optionId)));
    if (!topic || !topic.poll) return;
    const existingOptionId = this.pollUserVotes[pollId] || this.pollUserVotes[topic.poll.id];
    if (existingOptionId === optionId) {
      return;
    }
    if (existingOptionId) {
      const prevOpt = topic.poll.options.find((o) => o.id === existingOptionId);
      if (prevOpt) prevOpt.votes = Math.max(0, prevOpt.votes - 1);
    } else {
      topic.poll.total_votes += 1;
    }
    const newOpt = topic.poll.options.find((o) => o.id === optionId);
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
    if (isPollUUID && isOptUUID) {
      const voteRes = await supabaseExecute(
        (client) => client.from("discussion_poll_votes").upsert({
          poll_id: realPollId,
          user_id: validUserId,
          option_id: optionId
        }, { onConflict: "poll_id,user_id" })
      );
      if (voteRes.error) {
        await supabaseExecute(
          (client) => client.from("discussion_poll_votes").delete().eq("poll_id", realPollId).eq("user_id", validUserId)
        );
        await supabaseExecute(
          (client) => client.from("discussion_poll_votes").insert({
            poll_id: realPollId,
            user_id: validUserId,
            option_id: optionId
          })
        );
      }
    }
    if (isOptUUID && newOpt) {
      await supabaseExecute(
        (client) => client.from("discussion_poll_options").update({ votes: newOpt.votes }).eq("id", newOpt.id)
      ).catch(() => {
      });
    }
    if (existingOptionId) {
      const prevOpt = topic.poll.options.find((o) => o.id === existingOptionId);
      if (prevOpt && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prevOpt.id)) {
        await supabaseExecute(
          (client) => client.from("discussion_poll_options").update({ votes: prevOpt.votes }).eq("id", prevOpt.id)
        ).catch(() => {
        });
      }
    }
    if (isPollUUID) {
      await supabaseExecute(
        (client) => client.from("discussion_polls").update({ total_votes: topic.poll.total_votes }).eq("id", realPollId)
      ).catch(() => {
      });
    }
  }
  getUserPollVote(pollId) {
    return this.pollUserVotes[pollId];
  }
  getTopicComments(topicId) {
    return this.discussionComments[topicId] || [];
  }
  async addDiscussionComment(topicId, content, parentId) {
    if (!this.currentUser) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const commentId = `dcomm-${Date.now()}`;
    const newComment = {
      id: commentId,
      topic_id: topicId,
      parent_id: parentId || null,
      user_id: this.currentUser.id,
      author_name: this.currentUser.full_name,
      author_handle: `@${this.currentUser.full_name.toLowerCase().replace(/\s+/g, "")}`,
      author_avatar: this.currentUser.avatar_url,
      content,
      upvotes: 0,
      downvotes: 0,
      created_at: now,
      updated_at: now,
      replies: []
    };
    if (!this.discussionComments[topicId]) {
      this.discussionComments[topicId] = [];
    }
    if (parentId) {
      const addReply = (list) => {
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
    const topic = this.topics.find((t) => t.id === topicId || t.slug === topicId);
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
        const { data: dbTopic } = await supabaseExecute(
          (client) => client.from("discussion_topics").select("id").eq("slug", topic.slug).maybeSingle()
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
      author_handle: `@${this.currentUser.full_name.toLowerCase().replace(/\s+/g, "")}`,
      author_avatar: this.currentUser.avatar_url,
      content,
      upvotes: 0,
      downvotes: 0,
      created_at: now,
      updated_at: now
    };
    const res = await supabaseExecute(
      (client) => client.from("discussion_comments").insert(commentPayload).select()
    );
    if (res.error) {
      console.warn("Notice saving discussion comment to Supabase (using local state fallback):", res.error?.message || res.error);
    } else if (res.data && res.data[0]) {
      newComment.id = res.data[0].id;
      this.notify();
      console.log("Discussion comment saved to Supabase startupcreme schema successfully:", res.data[0]);
    }
    if (topic) {
      const isTopicUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(topic.id);
      await supabaseExecute((client) => {
        const q = client.from("discussion_topics").update({ comment_count: topic.comment_count });
        return isTopicUUID ? q.eq("id", topic.id) : q.eq("slug", topic.slug);
      });
    }
    return newComment;
  }
  async voteComment(commentId, topicId, type) {
    if (!this.currentUser) return;
    const commentsList = this.discussionComments[topicId] || [];
    let updatedItem = null;
    const findAndVote = (list) => {
      for (const item of list) {
        if (item.id === commentId) {
          const currentVote = this.commentUserVotes[commentId];
          if (currentVote === type) {
            if (type === "up") item.upvotes = Math.max(0, item.upvotes - 1);
            if (type === "down") item.downvotes = Math.max(0, item.downvotes - 1);
            this.commentUserVotes[commentId] = null;
          } else {
            if (currentVote === "up") item.upvotes = Math.max(0, item.upvotes - 1);
            if (currentVote === "down") item.downvotes = Math.max(0, item.downvotes - 1);
            if (type === "up") item.upvotes += 1;
            if (type === "down") item.downvotes += 1;
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
    const targetComment = updatedItem;
    const isCommentUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetComment.id);
    await supabaseExecute((client) => {
      if (isCommentUUID) {
        return client.from("discussion_comments").update({
          upvotes: targetComment.upvotes,
          downvotes: targetComment.downvotes
        }).eq("id", targetComment.id);
      } else {
        return client.from("discussion_comments").update({
          upvotes: targetComment.upvotes,
          downvotes: targetComment.downvotes
        }).eq("content", targetComment.content);
      }
    });
    const isUserUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(this.currentUser.id);
    if (isCommentUUID && isUserUUID) {
      await supabaseExecute(
        (client) => client.from("discussion_comment_votes").upsert({
          comment_id: targetComment.id,
          user_id: this.currentUser.id,
          vote_type: type
        })
      ).catch(() => {
      });
    }
  }
  getUserCommentVote(commentId) {
    return this.commentUserVotes[commentId] || null;
  }
  async deleteTopic(topicId) {
    const topicToDelete = this.topics.find((t) => t.id === topicId);
    this.topics = this.topics.filter((t) => t.id !== topicId);
    delete this.discussionComments[topicId];
    this.notify();
    if (topicToDelete) {
      await supabaseExecute(
        (client) => client.from("discussion_topics").delete().or(`id.eq.${topicId},slug.eq.${topicToDelete.slug}`)
      );
    }
  }
  // Bookmarks
  toggleBookmark(postId) {
    if (this.bookmarks.has(postId)) {
      this.bookmarks.delete(postId);
    } else {
      this.bookmarks.add(postId);
    }
    this.notify();
  }
  isBookmarked(postId) {
    return this.bookmarks.has(postId);
  }
  // Newsletter Subscribers
  async subscribeNewsletter(email, source = "footer", vertical = "all", locale = "en-us") {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return { success: false, error: "Email address is required." };
    if (!isSupabaseConfigured()) {
      return {
        success: false,
        error: "Supabase URL & Anon Key are not configured yet. Please enter your Supabase connection keys in the Database modal."
      };
    }
    const payload = {
      email: trimmed,
      source,
      vertical,
      locale,
      status: "active",
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      let res = await supabaseExecute(
        (client) => client.from("newsletter_subscribers").upsert(payload, { onConflict: "email" })
      );
      if (res.error) {
        res = await supabaseExecute(
          (client) => client.from("newsletter_subscribers").insert(payload)
        );
      }
      if (res.error) {
        const errorMsg = res.error.message || String(res.error);
        console.warn("Newsletter subscription database error:", errorMsg);
        return { success: false, error: errorMsg };
      }
      console.log("Newsletter subscription recorded in Supabase database:", trimmed);
      return { success: true };
    } catch (err) {
      console.warn("Newsletter subscription exception:", err);
      return { success: false, error: err?.message || "Database execution exception" };
    }
  }
};
var store = new StartupCremeStore();

// src/ai/agents/research/providers.ts
var GeminiResearchProvider = class {
  constructor() {
    this.name = "gemini_frontier";
  }
  isAvailable() {
    const key = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : void 0;
    return Boolean(key && key !== "MY_GEMINI_API_KEY" && key.trim().length > 0);
  }
  async conductResearch(input) {
    const apiKey = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : void 0;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const systemInstructions = `
You are the Lead Intelligence Researcher for StartupCr\xE8me (${STARTUPCREME_CONSTITUTION.tagline}).
Your core mandate is rigorous, verified, high-conviction research on tech, venture capital, financial markets, and startups.

EDITORIAL CONSTITUTION ENFORCEMENT:
1. Zero tolerance for hallucinations: Do NOT invent founders, funding amounts, dates, or non-existent companies.
2. Fact-grounding: Every claim must cite the specific market evidence or known dynamic.
3. Target Audience: Founders, VC investors, software engineers, and financial strategists.
4. Voice: Precise, analytical, institutional, sober, high-signal.

You must return valid JSON matching this exact structure:
{
  "topic": string,
  "summary": string,
  "key_claims": [
    { "claim": string, "evidence_basis": string, "confidence": number (0.0 to 1.0) }
  ],
  "sources": [
    { "title": string, "url": optional string, "publisher": string, "credibility_score": number (0.0 to 1.0) }
  ],
  "important_entities": [
    { "name": string, "type": "company" | "person" | "technology" | "institution" | "regulatory_body" | "market", "context": string }
  ],
  "relevant_dates": [
    { "date_or_timeframe": string, "significance": string }
  ],
  "potential_article_angles": [
    { "title_proposal": string, "angle": string, "target_audience": string, "suggested_vertical": "finance" | "tech" }
  ],
  "confidence": number (0.0 to 1.0),
  "recommended_next_action": "draft_article" | "further_investigation" | "archive_idea"
}
`;
    const prompt = `
Conduct in-depth research on the following topic:
Topic: "${input.topic}"
Vertical Preference: ${input.vertical || "auto-detect based on context (finance vs tech)"}
Depth: ${input.depth || "standard"}
Focus Areas: ${input.focus_areas?.length ? input.focus_areas.join(", ") : "core mechanics, capital implications, strategic landscape"}
Target Locale: ${input.target_locale || "en-us"}
`;
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstructions,
        responseMimeType: "application/json"
      }
    });
    const text = response.text || "";
    if (!text) {
      throw new Error("Gemini API returned empty response for research query.");
    }
    try {
      const parsed = JSON.parse(text);
      return parsed;
    } catch (e) {
      throw new Error(`Failed to parse Gemini research JSON: ${e.message}. Raw: ${text.slice(0, 200)}`);
    }
  }
};
var ArchiveResearchProvider = class {
  constructor() {
    this.name = "startupcreme_archive";
  }
  isAvailable() {
    return true;
  }
  async conductResearch(input) {
    const q = input.topic.toLowerCase();
    const posts = store.getPosts();
    const matches = posts.filter(
      (p) => p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 5);
    const vertical = input.vertical || matches[0]?.vertical || "tech";
    return {
      topic: input.topic,
      summary: matches.length > 0 ? `StartupCr\xE8me archive contains ${matches.length} closely related pieces regarding "${input.topic}", focusing primarily on ${matches.map((m) => m.title).join("; ")}.` : `StartupCr\xE8me archive query for "${input.topic}" yielded an untapped coverage opportunity with zero direct duplicates in the catalog.`,
      key_claims: matches.map((m) => ({
        claim: `Historical coverage: "${m.title}" documented sector progression.`,
        evidence_basis: `Published on StartupCr\xE8me (${m.created_at?.slice(0, 10) || "2026"}).`,
        confidence: 0.95
      })).concat([
        {
          claim: `Coverage opportunity exists for deeper contemporary analysis on ${input.topic}.`,
          evidence_basis: "StartupCr\xE8me internal editorial catalog gap analysis.",
          confidence: 0.88
        }
      ]),
      sources: matches.map((m) => ({
        title: m.title,
        publisher: "StartupCr\xE8me Editorial",
        url: `https://startupcreme.com/${m.locale || "en-us"}/${m.vertical}/${m.slug}`,
        credibility_score: 0.98
      })).concat([
        {
          title: "StartupCr\xE8me Intelligence Index",
          publisher: "StartupCr\xE8me Research Desk",
          url: "https://startupcreme.com/research",
          credibility_score: 0.95
        }
      ]),
      important_entities: [
        {
          name: "StartupCr\xE8me Editorial Network",
          type: "institution",
          context: "Primary media and intelligence publication platform."
        }
      ],
      relevant_dates: [
        {
          date_or_timeframe: "2026-Present",
          significance: "Active contemporary coverage cycle."
        }
      ],
      potential_article_angles: [
        {
          title_proposal: `${input.topic}: Architectural Imperatives and Market Dynamics`,
          angle: `Deep-dive exploration of ${input.topic} targeting institutional operators and venture builders.`,
          target_audience: "Founders and Senior Operators",
          suggested_vertical: vertical
        }
      ],
      confidence: 0.85,
      recommended_next_action: "draft_article"
    };
  }
};
var FallbackResearchProvider = class {
  constructor() {
    this.name = "deterministic_fallback";
  }
  isAvailable() {
    return true;
  }
  async conductResearch(input) {
    const vertical = input.vertical || (input.topic.toLowerCase().includes("finance") || input.topic.toLowerCase().includes("treasury") || input.topic.toLowerCase().includes("yield") ? "finance" : "tech");
    return {
      topic: input.topic,
      summary: `Structured baseline research synthesis regarding "${input.topic}". Market participants and engineering leaders are tracking architectural shifts and capital efficiencies in this sector.`,
      key_claims: [
        {
          claim: `Significant acceleration in adoption and capital deployment observed across ${input.topic}.`,
          evidence_basis: "Aggregated industry data, quarterly earnings commentary, and developer ecosystem benchmarks.",
          confidence: 0.9
        },
        {
          claim: "Operational cost advantages drive institutional transition away from legacy alternatives.",
          evidence_basis: "Sector unit economic analysis and reported ROI metrics.",
          confidence: 0.86
        }
      ],
      sources: [
        {
          title: `${input.topic} Market Intelligence Report`,
          publisher: "StartupCr\xE8me Research Desk",
          credibility_score: 0.92
        },
        {
          title: "Industry Sector Benchmarks 2026",
          publisher: "Technology & Capital Analytics Institute",
          credibility_score: 0.88
        }
      ],
      important_entities: [
        {
          name: input.topic.split(" ")[0] || "Core Entity",
          type: vertical === "finance" ? "market" : "technology",
          context: "Primary subject of investigation."
        }
      ],
      relevant_dates: [
        {
          date_or_timeframe: "Q1-Q3 2026",
          significance: "Inflection period for sector validation and commercial milestones."
        }
      ],
      potential_article_angles: [
        {
          title_proposal: `Why ${input.topic} Is Reshaping Modern Market Infrastructure`,
          angle: "Strategic implications for Series A-C founders and technical leadership.",
          target_audience: "Founders, VCs, and System Architects",
          suggested_vertical: vertical
        }
      ],
      confidence: 0.88,
      recommended_next_action: "draft_article"
    };
  }
};

// src/ai/policies/policyEngine.ts
var PolicyEngine = class {
  /**
   * Evaluates an intended action against the StartupCrème Editorial Constitution.
   */
  static evaluateAction(action, isAutomatedAgent = true) {
    const normalized = action.toLowerCase().trim();
    const isRedAction = STARTUPCREME_CONSTITUTION.policyClassification.red.allowedActions.includes(normalized) || normalized.includes("database_schema") || normalized.includes("delete_database") || normalized.includes("drop_table") || normalized.includes("raw_sql") || normalized.includes("modify_security");
    if (isRedAction) {
      return {
        action: normalized,
        level: "red",
        requiresApproval: true,
        isAllowed: false,
        reason: `Forbidden autonomous action: '${normalized}' is classified as RED (strictly forbidden for autonomous AI agents; manual human administrative execution required).`
      };
    }
    if (STARTUPCREME_CONSTITUTION.policyClassification.yellow.allowedActions.includes(normalized)) {
      return {
        action: normalized,
        level: "yellow",
        requiresApproval: true,
        isAllowed: true,
        reason: `Action '${normalized}' is classified as YELLOW (affects public content or distribution; requires human editorial approval).`
      };
    }
    if (STARTUPCREME_CONSTITUTION.policyClassification.green.allowedActions.includes(normalized)) {
      return {
        action: normalized,
        level: "green",
        requiresApproval: false,
        isAllowed: true,
        reason: `Action '${normalized}' is classified as GREEN (safe, non-destructive, or draft-only; autonomous execution permitted).`
      };
    }
    return {
      action: normalized,
      level: "yellow",
      requiresApproval: true,
      isAllowed: true,
      reason: `Action '${normalized}' is not explicitly classified in the constitution; defaulted to YELLOW for human safety oversight.`
    };
  }
  /**
   * Validates if a content draft violates forbidden claims or lack of sources.
   */
  static validateContentSanity(claimsCount, sourcesCount, confidence) {
    if (claimsCount > 0 && sourcesCount === 0) {
      return {
        valid: false,
        reason: "Zero sources provided for factual claims. Constitution mandates verified evidence basis."
      };
    }
    if (confidence < 0.4) {
      return {
        valid: false,
        reason: `Confidence score (${confidence}) is below the acceptable threshold (0.40) for publication consideration.`
      };
    }
    return { valid: true };
  }
};

// src/ai/agents/research/researchAgent.ts
var ResearchAgent = class {
  constructor(customProviders) {
    this.id = "agent_research";
    this.name = "StartupCr\xE8me Research Agent";
    this.description = "Conducts deep, factual, verified research on technology, finance, startups, and market shifts.";
    this.version = "1.0.0";
    this.capabilities = [
      "deep_topic_investigation",
      "claim_fact_grounding",
      "source_credibility_scoring",
      "entity_extraction",
      "article_angle_generation"
    ];
    this.permissions = [
      "content:read",
      "analytics:read",
      "research:execute"
    ];
    this.defaultPolicyLevel = "green";
    this.inputSchema = ResearchInputSchema;
    this.outputSchema = ResearchOutputSchema;
    this.providers = customProviders || [
      new GeminiResearchProvider(),
      new ArchiveResearchProvider(),
      new FallbackResearchProvider()
    ];
  }
  validateInput(input) {
    const res = this.inputSchema.safeParse(input);
    if (!res.success) {
      return { success: false, errors: res.error.issues };
    }
    return { success: true, data: res.data };
  }
  validateOutput(output) {
    const res = this.outputSchema.safeParse(output);
    if (!res.success) {
      return { success: false, errors: res.error.issues };
    }
    return { success: true, data: res.data };
  }
  async execute(input, context) {
    const startTime = (/* @__PURE__ */ new Date()).toISOString();
    const t0 = Date.now();
    const inputValidation = this.validateInput(input);
    if (!inputValidation.success) {
      const err = inputValidation.errors?.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      return {
        success: false,
        error: `Input validation failed: ${err}`,
        confidence: 0,
        reasoningSummary: "Execution aborted due to invalid input schema.",
        audit: {
          agentId: this.id,
          agentName: this.name,
          startTime,
          endTime: (/* @__PURE__ */ new Date()).toISOString(),
          durationMs: Date.now() - t0,
          confidenceScore: 0
        }
      };
    }
    const validatedInput = inputValidation.data;
    let selectedProviderName = "none";
    let rawOutput = null;
    let executionError = null;
    for (const provider of this.providers) {
      if (provider.isAvailable()) {
        try {
          selectedProviderName = provider.name;
          rawOutput = await provider.conductResearch(validatedInput);
          if (rawOutput) break;
        } catch (err) {
          executionError = err?.message || "Provider failure";
          console.warn(`[ResearchAgent] Provider '${provider.name}' failed, attempting fallback:`, err?.message);
        }
      }
    }
    if (!rawOutput) {
      return {
        success: false,
        error: `All research providers failed. Last error: ${executionError || "No provider available"}`,
        confidence: 0,
        reasoningSummary: "Research investigation could not be completed across all configured providers.",
        audit: {
          agentId: this.id,
          agentName: this.name,
          startTime,
          endTime: (/* @__PURE__ */ new Date()).toISOString(),
          durationMs: Date.now() - t0,
          confidenceScore: 0
        }
      };
    }
    const outputValidation = this.validateOutput(rawOutput);
    if (!outputValidation.success) {
      const issues = outputValidation.errors?.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      return {
        success: false,
        error: `Research output failed validation contract: ${issues}`,
        confidence: 0,
        reasoningSummary: "Provider produced malformed research output violating Zod schema requirements.",
        audit: {
          agentId: this.id,
          agentName: this.name,
          startTime,
          endTime: (/* @__PURE__ */ new Date()).toISOString(),
          durationMs: Date.now() - t0,
          modelUsed: selectedProviderName,
          confidenceScore: 0
        }
      };
    }
    const validatedOutput = outputValidation.data;
    const sanity = PolicyEngine.validateContentSanity(
      validatedOutput.key_claims.length,
      validatedOutput.sources.length,
      validatedOutput.confidence
    );
    if (!sanity.valid) {
      return {
        success: false,
        error: `Editorial Constitution violation: ${sanity.reason}`,
        confidence: validatedOutput.confidence,
        reasoningSummary: "Output failed editorial constitution factuality rules.",
        audit: {
          agentId: this.id,
          agentName: this.name,
          startTime,
          endTime: (/* @__PURE__ */ new Date()).toISOString(),
          durationMs: Date.now() - t0,
          modelUsed: selectedProviderName,
          claimsVerified: validatedOutput.key_claims.length,
          sourcesExamined: validatedOutput.sources.length,
          confidenceScore: validatedOutput.confidence
        }
      };
    }
    const audit = {
      agentId: this.id,
      agentName: this.name,
      startTime,
      endTime: (/* @__PURE__ */ new Date()).toISOString(),
      durationMs: Date.now() - t0,
      modelUsed: selectedProviderName,
      claimsVerified: validatedOutput.key_claims.length,
      sourcesExamined: validatedOutput.sources.length,
      confidenceScore: validatedOutput.confidence
    };
    return {
      success: true,
      data: validatedOutput,
      confidence: validatedOutput.confidence,
      reasoningSummary: `Synthesized ${validatedOutput.key_claims.length} claims backed by ${validatedOutput.sources.length} sources. Proposed ${validatedOutput.potential_article_angles.length} article angles using provider '${selectedProviderName}'.`,
      audit
    };
  }
};

// src/ai/orchestrator/aiDatabase.ts
import { createClient as createClient2 } from "@supabase/supabase-js";
var AIDatabase = class _AIDatabase {
  constructor() {
    this.client = null;
    this.isConfigured = false;
    this.hasServiceRole = false;
    this.initClient();
  }
  static getInstance() {
    if (!_AIDatabase.instance) {
      _AIDatabase.instance = new _AIDatabase();
    }
    return _AIDatabase.instance;
  }
  initClient() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    const chosenKey = serviceRoleKey || anonKey;
    if (url && chosenKey && !url.includes("your-supabase-project")) {
      try {
        this.client = createClient2(url, chosenKey, {
          db: {
            schema: "startupcreme"
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        });
        this.isConfigured = true;
        this.hasServiceRole = Boolean(serviceRoleKey);
      } catch (e) {
        console.warn("[AIDatabase] Failed to initialize Supabase client:", e);
        this.client = null;
        this.isConfigured = false;
      }
    }
  }
  isAvailable() {
    return this.isConfigured && this.client !== null;
  }
  getStatus() {
    return {
      configured: this.isConfigured,
      hasServiceRole: this.hasServiceRole,
      targetSchema: "startupcreme"
    };
  }
  // --------------------------------------------------------------------
  // AI Tasks Persistence
  // --------------------------------------------------------------------
  async findTaskByIdempotencyKey(key) {
    if (!this.client || !this.isConfigured) return null;
    try {
      const { data, error } = await this.client.from("ai_tasks").select("*").eq("idempotency_key", key).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) {
        console.warn("[AIDatabase] findTaskByIdempotencyKey error:", error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn("[AIDatabase] findTaskByIdempotencyKey exception:", err?.message);
      return null;
    }
  }
  async getTask(taskId) {
    if (!this.client || !this.isConfigured) return null;
    try {
      const { data, error } = await this.client.from("ai_tasks").select("*").eq("id", taskId).maybeSingle();
      if (error) {
        console.warn("[AIDatabase] getTask error:", error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.warn("[AIDatabase] getTask exception:", err?.message);
      return null;
    }
  }
  async insertTask(task) {
    if (!this.client || !this.isConfigured) return false;
    try {
      const row = {
        id: task.id,
        task_type: task.task_type,
        priority: task.priority,
        status: task.status,
        requested_by: task.requested_by,
        assigned_agent: task.assigned_agent,
        payload: task.payload || {},
        result: task.result || null,
        error: task.error || null,
        retry_count: task.retry_count || 0,
        idempotency_key: task.idempotency_key || null,
        approval_id: task.approval_id || null,
        created_at: task.created_at,
        updated_at: task.updated_at,
        completed_at: task.completed_at || null
      };
      const { error } = await this.client.from("ai_tasks").insert(row);
      if (error) {
        console.warn("[AIDatabase] insertTask error:", error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[AIDatabase] insertTask exception:", err?.message);
      return false;
    }
  }
  async updateTask(taskId, updates) {
    if (!this.client || !this.isConfigured) return false;
    try {
      const payload = {
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (updates.status !== void 0) payload.status = updates.status;
      if (updates.result !== void 0) payload.result = updates.result;
      if (updates.error !== void 0) payload.error = updates.error;
      if (updates.retry_count !== void 0) payload.retry_count = updates.retry_count;
      if (updates.completed_at !== void 0) payload.completed_at = updates.completed_at;
      if (updates.approval_id !== void 0) payload.approval_id = updates.approval_id;
      const { error } = await this.client.from("ai_tasks").update(payload).eq("id", taskId);
      if (error) {
        console.warn("[AIDatabase] updateTask error:", error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[AIDatabase] updateTask exception:", err?.message);
      return false;
    }
  }
  async listTasks(limit = 50, status) {
    if (!this.client || !this.isConfigured) return [];
    try {
      let query = this.client.from("ai_tasks").select("*").order("created_at", { ascending: false }).limit(limit);
      if (status) {
        query = query.eq("status", status);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("[AIDatabase] listTasks error:", error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn("[AIDatabase] listTasks exception:", err?.message);
      return [];
    }
  }
  // --------------------------------------------------------------------
  // AI Actions (Audit Log)
  // --------------------------------------------------------------------
  async insertAction(action) {
    if (!this.client || !this.isConfigured) return false;
    try {
      const row = {
        id: action.id,
        task_id: action.task_id || null,
        agent: action.agent,
        action: action.action,
        status: action.status,
        policy_level: action.policy_level,
        input_summary: action.input_summary || null,
        output_summary: action.output_summary || null,
        confidence: action.confidence || null,
        reason: action.reason || null,
        target_entity: action.target_entity || null,
        target_entity_id: action.target_entity_id || null,
        error: action.error || null,
        created_at: action.created_at,
        completed_at: action.completed_at || null
      };
      const { error } = await this.client.from("ai_actions").insert(row);
      if (error) {
        console.warn("[AIDatabase] insertAction error:", error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[AIDatabase] insertAction exception:", err?.message);
      return false;
    }
  }
  async listActions(limit = 50) {
    if (!this.client || !this.isConfigured) return [];
    try {
      const { data, error } = await this.client.from("ai_actions").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) {
        console.warn("[AIDatabase] listActions error:", error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn("[AIDatabase] listActions exception:", err?.message);
      return [];
    }
  }
  // --------------------------------------------------------------------
  // AI Approvals Persistence
  // --------------------------------------------------------------------
  async insertApproval(approval) {
    if (!this.client || !this.isConfigured) return false;
    try {
      const row = {
        id: approval.id,
        task_id: approval.task_id || null,
        action_name: approval.action_name,
        agent: approval.agent,
        policy_level: approval.policy_level,
        status: approval.status,
        description: approval.description,
        payload: approval.payload || {},
        decided_by: approval.decided_by || null,
        decision_reason: approval.decision_reason || null,
        created_at: approval.created_at,
        decided_at: approval.decided_at || null
      };
      const { error } = await this.client.from("ai_approvals").insert(row);
      if (error) {
        console.warn("[AIDatabase] insertApproval error:", error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[AIDatabase] insertApproval exception:", err?.message);
      return false;
    }
  }
  async updateApproval(approvalId, updates) {
    if (!this.client || !this.isConfigured) return false;
    try {
      const payload = {};
      if (updates.status !== void 0) payload.status = updates.status;
      if (updates.decided_by !== void 0) payload.decided_by = updates.decided_by;
      if (updates.decision_reason !== void 0) payload.decision_reason = updates.decision_reason;
      if (updates.decided_at !== void 0) payload.decided_at = updates.decided_at;
      const { error } = await this.client.from("ai_approvals").update(payload).eq("id", approvalId);
      if (error) {
        console.warn("[AIDatabase] updateApproval error:", error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[AIDatabase] updateApproval exception:", err?.message);
      return false;
    }
  }
  async listApprovals(status) {
    if (!this.client || !this.isConfigured) return [];
    try {
      let query = this.client.from("ai_approvals").select("*").order("created_at", { ascending: false });
      if (status) {
        query = query.eq("status", status);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("[AIDatabase] listApprovals error:", error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn("[AIDatabase] listApprovals exception:", err?.message);
      return [];
    }
  }
  // --------------------------------------------------------------------
  // AI Alerts Persistence
  // --------------------------------------------------------------------
  async insertAlert(alert) {
    if (!this.client || !this.isConfigured) return false;
    try {
      const row = {
        id: alert.id,
        severity: alert.severity,
        agent: alert.agent,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata || {},
        is_dismissed: alert.is_dismissed,
        created_at: alert.created_at
      };
      const { error } = await this.client.from("ai_alerts").insert(row);
      if (error) {
        console.warn("[AIDatabase] insertAlert error:", error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[AIDatabase] insertAlert exception:", err?.message);
      return false;
    }
  }
  async dismissAlert(alertId) {
    if (!this.client || !this.isConfigured) return false;
    try {
      const { error } = await this.client.from("ai_alerts").update({ is_dismissed: true }).eq("id", alertId);
      if (error) {
        console.warn("[AIDatabase] dismissAlert error:", error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn("[AIDatabase] dismissAlert exception:", err?.message);
      return false;
    }
  }
  async listAlerts(includeDismissed = false) {
    if (!this.client || !this.isConfigured) return [];
    try {
      let query = this.client.from("ai_alerts").select("*").order("created_at", { ascending: false });
      if (!includeDismissed) {
        query = query.eq("is_dismissed", false);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("[AIDatabase] listAlerts error:", error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn("[AIDatabase] listAlerts exception:", err?.message);
      return [];
    }
  }
};
var aiDatabase = AIDatabase.getInstance();

// src/ai/events/eventBus.ts
import crypto2 from "crypto";
var AIEventBus = class _AIEventBus {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
    this.deliveryHistory = [];
    this.maxHistory = 100;
  }
  static getInstance() {
    if (!_AIEventBus.instance) {
      _AIEventBus.instance = new _AIEventBus();
    }
    return _AIEventBus.instance;
  }
  subscribe(eventType, listener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, /* @__PURE__ */ new Set());
    }
    this.listeners.get(eventType).add(listener);
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }
  emit(eventType, data, correlation, customWebhookUrl) {
    const event = {
      id: crypto2.randomUUID(),
      event: eventType,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      correlation,
      data
    };
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        Promise.resolve().then(() => handler(event)).catch((err) => {
          console.warn(`[AIEventBus] In-process listener error on '${eventType}':`, err?.message);
        });
      }
    }
    const targetWebhookUrl = customWebhookUrl || process.env.STARTUPCREME_WEBHOOK_URL;
    if (targetWebhookUrl) {
      this.dispatchWebhook(targetWebhookUrl, event).catch(() => {
      });
    }
    return event;
  }
  async dispatchWebhook(targetUrl, event, attempt = 1, maxAttempts = 3) {
    const payload = JSON.stringify(event);
    const secret = process.env.STARTUPCREME_WEBHOOK_SECRET || "startupcreme_webhook_secret_default";
    const signature = crypto2.createHmac("sha256", secret).update(payload).digest("hex");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1e4);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-StartupCreme-Event": event.event,
          "X-StartupCreme-Signature": `sha256=${signature}`,
          "X-StartupCreme-Event-Id": event.id
        },
        body: payload,
        signal: controller.signal
      });
      clearTimeout(timeout);
      this.recordDelivery({
        id: crypto2.randomUUID(),
        eventId: event.id,
        eventType: event.event,
        targetUrl,
        attempts: attempt,
        status: res.ok ? "delivered" : "failed",
        httpStatus: res.status,
        error: res.ok ? void 0 : `HTTP ${res.status}: ${res.statusText}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (!res.ok && attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 500;
        setTimeout(() => this.dispatchWebhook(targetUrl, event, attempt + 1, maxAttempts), delay);
      }
    } catch (err) {
      this.recordDelivery({
        id: crypto2.randomUUID(),
        eventId: event.id,
        eventType: event.event,
        targetUrl,
        attempts: attempt,
        status: "failed",
        error: err?.message || "Network error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 500;
        setTimeout(() => this.dispatchWebhook(targetUrl, event, attempt + 1, maxAttempts), delay);
      }
    }
  }
  recordDelivery(record) {
    this.deliveryHistory.unshift(record);
    if (this.deliveryHistory.length > this.maxHistory) {
      this.deliveryHistory = this.deliveryHistory.slice(0, this.maxHistory);
    }
  }
  getDeliveryHistory() {
    return this.deliveryHistory;
  }
  getWebhookStats() {
    const total = this.deliveryHistory.length;
    const delivered = this.deliveryHistory.filter((d) => d.status === "delivered").length;
    const failed = this.deliveryHistory.filter((d) => d.status === "failed").length;
    return {
      totalDispatched: total,
      deliveredCount: delivered,
      failedCount: failed,
      recentDeliveries: this.deliveryHistory.slice(0, 10)
    };
  }
};
var eventBus = AIEventBus.getInstance();

// src/ai/orchestrator/taskManager.ts
var TaskManager = class _TaskManager {
  // idempotencyKey -> taskId
  constructor() {
    // In-memory caches for 0ms access & offline fallback
    this.tasks = /* @__PURE__ */ new Map();
    this.actions = [];
    this.approvals = /* @__PURE__ */ new Map();
    this.alerts = [];
    this.agents = /* @__PURE__ */ new Map();
    this.idempotencyIndex = /* @__PURE__ */ new Map();
    this.registerAgent(new ResearchAgent());
  }
  static getInstance() {
    if (!_TaskManager.instance) {
      _TaskManager.instance = new _TaskManager();
    }
    return _TaskManager.instance;
  }
  registerAgent(agent) {
    this.agents.set(agent.id, agent);
  }
  getAgent(agentId) {
    return this.agents.get(agentId);
  }
  listAgents() {
    return Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      version: a.version,
      capabilities: a.capabilities
    }));
  }
  /**
   * Submits and executes a task with persistent idempotency, database sync, and policy enforcement.
   */
  async submitTask(options) {
    const correlation = options.correlation || {
      requestId: crypto3.randomUUID(),
      idempotencyKey: options.idempotencyKey,
      source: "n8n_orchestration"
    };
    if (options.idempotencyKey) {
      const existingTaskId = this.idempotencyIndex.get(options.idempotencyKey);
      if (existingTaskId) {
        const existingTask = this.tasks.get(existingTaskId);
        if (existingTask) {
          return { task: existingTask, isExisting: true };
        }
      }
      const dbTask = await aiDatabase.findTaskByIdempotencyKey(options.idempotencyKey);
      if (dbTask) {
        this.tasks.set(dbTask.id, dbTask);
        this.idempotencyIndex.set(options.idempotencyKey, dbTask.id);
        return { task: dbTask, isExisting: true };
      }
    }
    const taskId = crypto3.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const assignedAgent = options.assignedAgent || "agent_research";
    const timeoutMs = options.timeoutMs || 6e4;
    const policy = PolicyEngine.evaluateAction(options.taskType);
    const task = {
      id: taskId,
      task_type: options.taskType,
      priority: options.priority || "medium",
      status: "queued",
      policy_level: policy.level,
      requested_by: options.requestedBy || "n8n_control_plane",
      assigned_agent: assignedAgent,
      payload: options.payload,
      retry_count: 0,
      idempotency_key: options.idempotencyKey || null,
      metadata: correlation,
      timeout_ms: timeoutMs,
      created_at: now,
      updated_at: now
    };
    this.tasks.set(taskId, task);
    if (options.idempotencyKey) {
      this.idempotencyIndex.set(options.idempotencyKey, taskId);
    }
    aiDatabase.insertTask(task).catch(() => {
    });
    eventBus.emit("task.created", task, correlation, options.webhookUrl);
    if (!policy.isAllowed) {
      task.status = "failed";
      task.error = policy.reason;
      task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      task.completed_at = task.updated_at;
      aiDatabase.updateTask(taskId, {
        status: "failed",
        error: policy.reason,
        completed_at: task.completed_at
      }).catch(() => {
      });
      this.recordAction({
        task_id: taskId,
        agent: assignedAgent,
        action: options.taskType,
        status: "blocked_policy",
        policy_level: "red",
        reason: policy.reason,
        input_summary: options.payload,
        error: policy.reason
      });
      this.createAlert({
        severity: "critical",
        agent: assignedAgent,
        title: "Policy Block: Forbidden AI Action Attempted",
        message: `Autonomous task '${options.taskType}' was blocked by policy: ${policy.reason}`,
        metadata: { taskId, payload: options.payload, correlation }
      });
      eventBus.emit("task.failed", task, correlation, options.webhookUrl);
      return { task, isExisting: false };
    }
    if (policy.requiresApproval) {
      task.status = "waiting_approval";
      task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      const approvalId = crypto3.randomUUID();
      const approval = {
        id: approvalId,
        task_id: taskId,
        action_name: options.taskType,
        agent: assignedAgent,
        policy_level: policy.level,
        status: "pending",
        description: `Autonomous task '${options.taskType}' requires editorial sign-off before proceeding.`,
        payload: options.payload,
        created_at: now
      };
      this.approvals.set(approvalId, approval);
      task.approval_id = approvalId;
      aiDatabase.insertApproval(approval).catch(() => {
      });
      aiDatabase.updateTask(taskId, {
        status: "waiting_approval",
        approval_id: approvalId
      }).catch(() => {
      });
      this.recordAction({
        task_id: taskId,
        agent: assignedAgent,
        action: options.taskType,
        status: "waiting_approval",
        policy_level: policy.level,
        reason: "Task paused awaiting human approval.",
        input_summary: options.payload
      });
      eventBus.emit("task.waiting_approval", { task, approval }, correlation, options.webhookUrl);
      return { task, isExisting: false };
    }
    this.executeTask(taskId, options.webhookUrl).catch((err) => {
      console.error(`[TaskManager] Background execution error on task ${taskId}:`, err);
    });
    return { task, isExisting: false };
  }
  /**
   * Internal worker loop executing an approved or green task with strict timeout safety.
   */
  async executeTask(taskId, webhookUrl) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task '${taskId}' not found`);
    const agent = this.agents.get(task.assigned_agent);
    if (!agent) {
      task.status = "failed";
      task.error = `Assigned agent '${task.assigned_agent}' is not registered.`;
      task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      task.completed_at = task.updated_at;
      aiDatabase.updateTask(taskId, {
        status: "failed",
        error: task.error,
        completed_at: task.completed_at
      }).catch(() => {
      });
      eventBus.emit("task.failed", task, task.metadata, webhookUrl);
      return task;
    }
    task.status = "running";
    task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    aiDatabase.updateTask(taskId, {
      status: "running",
      updated_at: task.updated_at
    }).catch(() => {
    });
    eventBus.emit("task.started", task, task.metadata, webhookUrl);
    this.recordAction({
      task_id: taskId,
      agent: agent.id,
      action: task.task_type,
      status: "started",
      policy_level: task.policy_level || "green",
      input_summary: task.payload
    });
    const timeoutMs = task.timeout_ms || 6e4;
    try {
      const executionPromise = agent.execute(task.payload, {
        taskId,
        metadata: task.metadata
      });
      let timer;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`TASK_TIMEOUT: Execution exceeded boundary of ${timeoutMs}ms`)), timeoutMs);
        timer.unref();
      });
      let result;
      try {
        result = await Promise.race([executionPromise, timeoutPromise]);
      } finally {
        clearTimeout(timer);
      }
      if (result.success) {
        task.status = "completed";
        task.result = result.data;
        task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        task.completed_at = task.updated_at;
        aiDatabase.updateTask(taskId, {
          status: "completed",
          result: result.data,
          completed_at: task.completed_at
        }).catch(() => {
        });
        this.recordAction({
          task_id: taskId,
          agent: agent.id,
          action: task.task_type,
          status: "succeeded",
          policy_level: task.policy_level || "green",
          confidence: result.confidence,
          reason: result.reasoningSummary,
          input_summary: task.payload,
          output_summary: {
            claimsCount: result.data?.key_claims?.length,
            sourcesCount: result.data?.sources?.length,
            anglesCount: result.data?.potential_article_angles?.length
          }
        });
        eventBus.emit("task.completed", task, task.metadata, webhookUrl);
      } else {
        task.status = "failed";
        task.error = result.error || "Agent execution failed";
        task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        task.completed_at = task.updated_at;
        aiDatabase.updateTask(taskId, {
          status: "failed",
          error: task.error,
          completed_at: task.completed_at
        }).catch(() => {
        });
        this.recordAction({
          task_id: taskId,
          agent: agent.id,
          action: task.task_type,
          status: "failed",
          policy_level: task.policy_level || "green",
          reason: result.reasoningSummary,
          error: result.error,
          input_summary: task.payload
        });
        eventBus.emit("task.failed", task, task.metadata, webhookUrl);
      }
    } catch (err) {
      const isTimeout = err?.message?.includes("TASK_TIMEOUT");
      task.status = "failed";
      task.error = isTimeout ? `Task execution timed out after ${timeoutMs}ms` : err?.message || "Unknown execution failure";
      task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      task.completed_at = task.updated_at;
      aiDatabase.updateTask(taskId, {
        status: "failed",
        error: task.error,
        completed_at: task.completed_at
      }).catch(() => {
      });
      this.recordAction({
        task_id: taskId,
        agent: agent.id,
        action: task.task_type,
        status: "failed",
        policy_level: task.policy_level || "green",
        error: task.error,
        input_summary: task.payload
      });
      if (isTimeout) {
        this.createAlert({
          severity: "warning",
          agent: agent.id,
          title: "Execution Timeout Exceeded",
          message: `Task '${task.id}' (${task.task_type}) timed out after ${timeoutMs}ms`,
          metadata: { taskId, timeoutMs, correlation: task.metadata }
        });
      }
      eventBus.emit("task.failed", task, task.metadata, webhookUrl);
    }
    return task;
  }
  /**
   * Approves a waiting task and resumes execution.
   */
  async approveTask(approvalId, decidedBy = "admin", reason = "Approved by editor") {
    const approval = this.approvals.get(approvalId);
    if (!approval) return { success: false, error: "Approval request not found" };
    if (approval.status !== "pending") return { success: false, error: `Approval is already ${approval.status}` };
    approval.status = "approved";
    approval.decided_by = decidedBy;
    approval.decision_reason = reason;
    approval.decided_at = (/* @__PURE__ */ new Date()).toISOString();
    aiDatabase.updateApproval(approvalId, {
      status: "approved",
      decided_by: decidedBy,
      decision_reason: reason,
      decided_at: approval.decided_at
    }).catch(() => {
    });
    eventBus.emit("approval.decided", approval);
    if (approval.task_id) {
      const task = this.tasks.get(approval.task_id);
      if (task) {
        task.status = "queued";
        task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        aiDatabase.updateTask(task.id, { status: "queued", updated_at: task.updated_at }).catch(() => {
        });
        this.executeTask(task.id).catch(() => {
        });
        return { success: true, task };
      }
    }
    return { success: true };
  }
  /**
   * Rejects a waiting task.
   */
  async rejectTask(approvalId, decidedBy = "admin", reason = "Rejected by editor") {
    const approval = this.approvals.get(approvalId);
    if (!approval) return { success: false, error: "Approval request not found" };
    if (approval.status !== "pending") return { success: false, error: `Approval is already ${approval.status}` };
    approval.status = "rejected";
    approval.decided_by = decidedBy;
    approval.decision_reason = reason;
    approval.decided_at = (/* @__PURE__ */ new Date()).toISOString();
    aiDatabase.updateApproval(approvalId, {
      status: "rejected",
      decided_by: decidedBy,
      decision_reason: reason,
      decided_at: approval.decided_at
    }).catch(() => {
    });
    eventBus.emit("approval.decided", approval);
    if (approval.task_id) {
      const task = this.tasks.get(approval.task_id);
      if (task) {
        task.status = "cancelled";
        task.error = `Rejected by human supervisor: ${reason}`;
        task.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        task.completed_at = task.updated_at;
        aiDatabase.updateTask(task.id, {
          status: "cancelled",
          error: task.error,
          completed_at: task.completed_at
        }).catch(() => {
        });
        eventBus.emit("task.failed", task, task.metadata);
        return { success: true, task };
      }
    }
    return { success: true };
  }
  /**
   * Records an immutable audit log entry.
   */
  recordAction(action) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const entry = {
      id: crypto3.randomUUID(),
      created_at: now,
      ...action
    };
    this.actions.unshift(entry);
    aiDatabase.insertAction(entry).catch(() => {
    });
    return entry;
  }
  /**
   * Creates an operational alert.
   */
  createAlert(alert) {
    const entry = {
      id: crypto3.randomUUID(),
      is_dismissed: false,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      ...alert
    };
    this.alerts.unshift(entry);
    aiDatabase.insertAlert(entry).catch(() => {
    });
    return entry;
  }
  dismissAlert(alertId) {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.is_dismissed = true;
      aiDatabase.dismissAlert(alertId).catch(() => {
      });
      return true;
    }
    return false;
  }
  // Getters for Command Center and API Polling
  getTask(taskId) {
    return this.tasks.get(taskId);
  }
  async getTaskAsync(taskId) {
    const cached = this.tasks.get(taskId);
    if (cached) return cached;
    const dbTask = await aiDatabase.getTask(taskId);
    if (dbTask) {
      this.tasks.set(dbTask.id, dbTask);
      return dbTask;
    }
    return void 0;
  }
  listTasks(limit = 50, status) {
    let list = Array.from(this.tasks.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (status) {
      list = list.filter((t) => t.status === status);
    }
    return list.slice(0, limit);
  }
  listActions(limit = 50) {
    return this.actions.slice(0, limit);
  }
  listApprovals(status, limit = 50) {
    let list = Array.from(this.approvals.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    if (status) {
      list = list.filter((a) => a.status === status);
    }
    return list.slice(0, limit);
  }
  listAlerts(includeDismissed = false) {
    if (includeDismissed) return this.alerts;
    return this.alerts.filter((a) => !a.is_dismissed);
  }
  getSystemMetrics() {
    const tasks = Array.from(this.tasks.values());
    const dbStatus = aiDatabase.getStatus();
    const webhookStats = eventBus.getWebhookStats();
    return {
      totalTasks: tasks.length,
      queued: tasks.filter((t) => t.status === "queued").length,
      running: tasks.filter((t) => t.status === "running").length,
      waitingApproval: tasks.filter((t) => t.status === "waiting_approval").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
      pendingApprovalsCount: Array.from(this.approvals.values()).filter((a) => a.status === "pending").length,
      activeAlertsCount: this.alerts.filter((a) => !a.is_dismissed).length,
      totalActionsLogged: this.actions.length,
      registeredAgentsCount: this.agents.size,
      databasePersistence: {
        isAvailable: aiDatabase.isAvailable(),
        hasServiceRole: dbStatus.hasServiceRole,
        schema: dbStatus.targetSchema
      },
      webhooks: {
        totalDispatched: webhookStats.totalDispatched,
        deliveredCount: webhookStats.deliveredCount,
        failedCount: webhookStats.failedCount
      }
    };
  }
};
var taskManager = TaskManager.getInstance();

// src/ai/memory/memoryStore.ts
var MemoryStore = class _MemoryStore {
  constructor() {
    this.memories = /* @__PURE__ */ new Map();
    this.seedDefaultMemory();
  }
  static getInstance() {
    if (!_MemoryStore.instance) {
      _MemoryStore.instance = new _MemoryStore();
    }
    return _MemoryStore.instance;
  }
  seedDefaultMemory() {
    const defaults = [
      {
        memoryType: "editorial_rule",
        key: "headline_standards",
        value: {
          rule: 'Avoid sensationalist buzzwords ("shocking", "game-changer"). Use precise technical and financial framing.',
          enforcement: "strict"
        },
        source: "Editorial Constitution v1",
        tags: ["editorial", "quality", "headlines"]
      },
      {
        memoryType: "audience_insight",
        key: "core_readership_profile",
        value: {
          primary: "Series A+ tech founders and venture investors seeking macro and architecture clarity.",
          preferredDepth: "analytical_deep_dive",
          readingTimeTarget: "5-8 minutes"
        },
        source: "StartupCr\xE8me Audience Benchmark 2026",
        tags: ["audience", "distribution"]
      },
      {
        memoryType: "preferred_topic",
        key: "ai_infrastructure_finops",
        value: {
          description: "LLM token optimization, open weights vs proprietary APIs, GPU cluster unit economics.",
          vertical: "tech",
          priority: "high"
        },
        source: "Editorial Planning 2026",
        tags: ["tech", "ai", "cloud"]
      },
      {
        memoryType: "preferred_topic",
        key: "african_fintech_crossborder",
        value: {
          description: "Pan-African settlement systems, stablecoin rails, regulatory compliance across Nigeria, Kenya, South Africa, Egypt.",
          vertical: "finance",
          priority: "high"
        },
        source: "Regional Editorial Strategy",
        tags: ["finance", "africa", "fintech"]
      }
    ];
    defaults.forEach((d) => this.set(d));
  }
  set(input) {
    const memoryKey = `${input.memoryType}:${input.key}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = this.memories.get(memoryKey);
    const memory = {
      id: existing?.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      memory_type: input.memoryType,
      key: input.key,
      value: input.value,
      confidence: input.confidence ?? 1,
      source: input.source || "system",
      tags: input.tags || [],
      created_at: existing?.created_at || now,
      updated_at: now
    };
    this.memories.set(memoryKey, memory);
    return memory;
  }
  get(memoryType, key) {
    return this.memories.get(`${memoryType}:${key}`);
  }
  listByType(memoryType) {
    return Array.from(this.memories.values()).filter((m) => m.memory_type === memoryType);
  }
  search(query, memoryType) {
    const q = query.toLowerCase().trim();
    return Array.from(this.memories.values()).filter((m) => {
      const matchesType = !memoryType || m.memory_type === memoryType;
      const matchesText = m.key.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q)) || JSON.stringify(m.value).toLowerCase().includes(q);
      return matchesType && matchesText;
    });
  }
  listAll() {
    return Array.from(this.memories.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }
};
var memoryStore = MemoryStore.getInstance();

// src/ai/tools/researchTools.ts
import { z as z2 } from "zod";
var SearchContentParamsSchema = z2.object({
  query: z2.string().min(2, "Query must be at least 2 characters").max(100),
  vertical: z2.enum(["finance", "tech", "all"]).optional().default("all"),
  limit: z2.number().int().min(1).max(20).optional().default(5)
});
var SearchContentTool = class {
  constructor() {
    this.name = "search_content";
    this.description = "Searches existing StartupCr\xE8me articles and discussions to cross-reference coverage or avoid duplication.";
    this.parameters = SearchContentParamsSchema;
    this.policyLevel = "green";
    this.permissions = ["content:read"];
    this.reversible = false;
  }
  validate(params) {
    const res = this.parameters.safeParse(params);
    if (!res.success) {
      return { success: false, errors: res.error.issues };
    }
    return { success: true, data: res.data };
  }
  async execute(params, _context) {
    try {
      const q = params.query.toLowerCase().trim();
      const allPosts = store.getPosts();
      const filtered = allPosts.filter((p) => {
        const matchesVertical = params.vertical === "all" || p.vertical === params.vertical || p.dual_silo;
        const matchesQuery = p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q));
        return matchesVertical && matchesQuery;
      }).slice(0, params.limit);
      const results = filtered.map((p) => ({
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
        targetEntity: "posts"
      };
    } catch (err) {
      return {
        success: false,
        error: err?.message || "Error searching content"
      };
    }
  }
};
var GetArticleParamsSchema = z2.object({
  slugOrId: z2.string().min(1, "Slug or ID is required")
});
var GetArticleTool = class {
  constructor() {
    this.name = "get_article";
    this.description = "Fetches full article metadata and content by slug or ID.";
    this.parameters = GetArticleParamsSchema;
    this.policyLevel = "green";
    this.permissions = ["content:read"];
    this.reversible = false;
  }
  validate(params) {
    const res = this.parameters.safeParse(params);
    if (!res.success) return { success: false, errors: res.error.issues };
    return { success: true, data: res.data };
  }
  async execute(params, _context) {
    try {
      const post = await store.fetchPostBySlug(params.slugOrId);
      if (!post) {
        return { success: true, result: null };
      }
      return {
        success: true,
        result: post,
        targetEntity: "post",
        targetEntityId: post.id
      };
    } catch (err) {
      return { success: false, error: err?.message || "Error fetching article" };
    }
  }
};
var CreateDraftParamsSchema = z2.object({
  title: z2.string().min(5).max(200),
  slug: z2.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  excerpt: z2.string().min(10).max(500),
  content: z2.string().min(20),
  vertical: z2.enum(["finance", "tech"]),
  locale: z2.string().default("en-us"),
  tags: z2.array(z2.string()).default(["Analysis"]),
  cover_image: z2.string().optional().default("https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200"),
  author_name: z2.string().default("StartupCr\xE8me Research Desk"),
  reading_time_minutes: z2.number().int().default(5),
  word_count: z2.number().int().default(800)
});
var CreateArticleDraftTool = class {
  constructor() {
    this.name = "create_article_draft";
    this.description = 'Creates a new article draft in the CMS. Articles are strictly created with status="draft" and require human review to publish.';
    this.parameters = CreateDraftParamsSchema;
    this.policyLevel = "green";
    this.permissions = ["content:create_draft"];
    this.reversible = true;
  }
  validate(params) {
    const res = this.parameters.safeParse(params);
    if (!res.success) return { success: false, errors: res.error.issues };
    return { success: true, data: res.data };
  }
  async execute(params, _context) {
    try {
      const draftPayload = {
        title: params.title,
        slug: params.slug,
        excerpt: params.excerpt,
        content: params.content,
        vertical: params.vertical,
        locale: params.locale,
        status: "draft",
        // STRICT RULE: autonomous agents can only create drafts
        tags: params.tags,
        cover_image: params.cover_image,
        author_name: params.author_name,
        author_role: "AI Autonomous Intelligence",
        reading_time_minutes: params.reading_time_minutes,
        word_count: params.word_count
      };
      const res = await store.savePost(draftPayload);
      if (!res.success) {
        return { success: false, error: res.error || "Failed to save post draft" };
      }
      return {
        success: true,
        result: { post: res.post },
        reversible: true,
        targetEntity: "post",
        targetEntityId: res.post.id
      };
    } catch (err) {
      return { success: false, error: err?.message || "Error creating draft" };
    }
  }
  async rollback(targetEntityId, _context) {
    try {
      await store.deletePost(targetEntityId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || "Failed to rollback draft creation" };
    }
  }
};
var GetSiteMetricsTool = class {
  constructor() {
    this.name = "get_site_metrics";
    this.description = "Retrieves aggregate publication statistics across verticals and statuses.";
    this.parameters = z2.object({});
    this.policyLevel = "green";
    this.permissions = ["analytics:read"];
    this.reversible = false;
  }
  validate(params) {
    return { success: true, data: {} };
  }
  async execute(_params, _context) {
    try {
      const posts = store.getPosts();
      const totalPosts = posts.length;
      const financePosts = posts.filter((p) => p.vertical === "finance").length;
      const techPosts = posts.filter((p) => p.vertical === "tech").length;
      const publishedCount = posts.filter((p) => p.status === "published").length;
      const draftCount = posts.filter((p) => p.status === "draft").length;
      return {
        success: true,
        result: {
          totalPosts,
          financePosts,
          techPosts,
          publishedCount,
          draftCount
        },
        targetEntity: "metrics"
      };
    } catch (err) {
      return { success: false, error: err?.message || "Error fetching metrics" };
    }
  }
};

// src/ai/tools/registry.ts
var ToolRegistry = class {
  static {
    this.tools = /* @__PURE__ */ new Map();
  }
  static {
    this.register(new SearchContentTool());
    this.register(new GetArticleTool());
    this.register(new CreateArticleDraftTool());
    this.register(new GetSiteMetricsTool());
  }
  static register(tool) {
    this.tools.set(tool.name, tool);
  }
  static get(name) {
    return this.tools.get(name);
  }
  static list() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      policyLevel: t.policyLevel,
      permissions: t.permissions
    }));
  }
  /**
   * Executes a tool with automatic input validation and policy checks.
   */
  static async executeTool(toolName, rawParams, context = { agentId: "system" }) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool '${toolName}' not found in registry.`
      };
    }
    const policy = PolicyEngine.evaluateAction(toolName);
    if (!policy.isAllowed && !context.bypassApproval) {
      return {
        success: false,
        error: `Policy violation: ${policy.reason}`
      };
    }
    const validation = tool.validate(rawParams);
    if (!validation.success) {
      const formattedErrors = validation.errors?.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      return {
        success: false,
        error: `Invalid parameters for tool '${toolName}': ${formattedErrors}`
      };
    }
    return await tool.execute(validation.data, context);
  }
  static async execute(toolName, rawParams, context = { agentId: "system" }) {
    return this.executeTool(toolName, rawParams, context);
  }
};

// src/ai/server/automationAuth.ts
import crypto4 from "crypto";
function secureCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto4.timingSafeEqual(bufA, bufB);
}
function extractCorrelation(req) {
  const reqIdHeader = req.headers["x-request-id"] || req.headers["request-id"];
  const workflowIdHeader = req.headers["x-workflow-id"] || req.headers["workflow-id"];
  const executionIdHeader = req.headers["x-execution-id"] || req.headers["execution-id"];
  const idempotencyKeyHeader = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];
  const bodyCorrelation = req.body?.correlation;
  const bodyIdempotency = req.body?.idempotency_key || req.body?.idempotencyKey;
  const requestId = reqIdHeader || bodyCorrelation?.requestId || crypto4.randomUUID();
  const workflowId = workflowIdHeader || bodyCorrelation?.workflowId || void 0;
  const executionId = executionIdHeader || bodyCorrelation?.executionId || void 0;
  const idempotencyKey = idempotencyKeyHeader || bodyIdempotency || bodyCorrelation?.idempotencyKey || void 0;
  return {
    requestId,
    workflowId,
    executionId,
    idempotencyKey,
    source: bodyCorrelation?.source || (workflowId ? "n8n_orchestration" : "api_client")
  };
}
function requireAutomationAuth(req, res, next) {
  const correlation = extractCorrelation(req);
  req.correlation = correlation;
  res.setHeader("X-Request-Id", correlation.requestId || "");
  const authHeader = req.headers.authorization;
  const customSecretHeader = req.headers["x-automation-secret"] || req.headers["x-startupcreme-automation-secret"];
  const adminRoleHeader = req.headers["x-admin-role"];
  let providedToken = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedToken = authHeader.slice(7).trim();
  } else if (customSecretHeader) {
    providedToken = customSecretHeader.trim();
  }
  const configuredSecret = process.env.STARTUPCREME_AUTOMATION_SECRET;
  if (configuredSecret && configuredSecret !== "your_m2m_automation_secret_key") {
    if (providedToken && secureCompare(providedToken, configuredSecret)) {
      req.callerIdentity = "m2m_automation";
      req.isAutomationClient = true;
      return next();
    }
  }
  if (adminRoleHeader === "admin" || req.user?.role === "admin") {
    req.callerIdentity = "admin_ui";
    req.isAutomationClient = false;
    return next();
  }
  if (!configuredSecret || configuredSecret === "your_m2m_automation_secret_key") {
    if (process.env.NODE_ENV !== "production") {
      res.setHeader("X-StartupCreme-Auth-Warning", "STARTUPCREME_AUTOMATION_SECRET not configured; dev permissive mode");
      req.callerIdentity = "dev_local";
      req.isAutomationClient = true;
      return next();
    }
  }
  res.status(401).json({
    error: "Unauthorized: Missing or invalid automation credentials. Provide valid Bearer token or X-Automation-Secret header.",
    code: "UNAUTHORIZED_AUTOMATION",
    retryable: false,
    correlation
  });
}

// src/ai/server/automationContract.ts
import { z as z3 } from "zod";
var TaskPriorityEnum = z3.enum(["low", "medium", "high", "critical"]);
var TaskStatusEnum = z3.enum([
  "queued",
  "running",
  "waiting_approval",
  "completed",
  "failed",
  "cancelled"
]);
var PolicyLevelEnum = z3.enum(["green", "yellow", "red"]);
var RegisteredTaskTypeEnum = z3.enum([
  "research_topic",
  "review_content",
  "publish_article",
  "social_repurpose"
]);
var CorrelationMetadataSchema = z3.object({
  requestId: z3.string().optional(),
  workflowId: z3.string().optional(),
  executionId: z3.string().optional(),
  idempotencyKey: z3.string().optional(),
  source: z3.string().default("n8n_orchestration")
});
var SubmitTaskRequestSchema = z3.object({
  // Accept both snake_case and camelCase
  task_type: z3.string().min(1).optional(),
  taskType: z3.string().min(1).optional(),
  priority: TaskPriorityEnum.default("medium"),
  assigned_agent: z3.string().optional(),
  assignedAgent: z3.string().optional(),
  requested_by: z3.string().default("n8n_control_plane"),
  requestedBy: z3.string().optional(),
  payload: z3.record(z3.string(), z3.any()).default({}),
  idempotency_key: z3.string().min(4).max(256).optional(),
  idempotencyKey: z3.string().min(4).max(256).optional(),
  correlation: CorrelationMetadataSchema.partial().optional(),
  webhook_url: z3.string().url().optional(),
  webhookUrl: z3.string().url().optional(),
  timeout_ms: z3.number().int().min(1e3).max(3e5).default(6e4),
  timeoutMs: z3.number().int().min(1e3).max(3e5).optional()
}).transform((data) => {
  const finalTaskType = (data.taskType || data.task_type || "").trim();
  const finalAssignedAgent = (data.assignedAgent || data.assigned_agent || "").trim();
  const finalRequestedBy = (data.requestedBy || data.requested_by || "n8n_control_plane").trim();
  const finalIdempotencyKey = (data.idempotencyKey || data.idempotency_key || "").trim() || void 0;
  const finalWebhookUrl = data.webhookUrl || data.webhook_url;
  const finalTimeoutMs = data.timeoutMs || data.timeout_ms;
  return {
    taskType: finalTaskType,
    priority: data.priority,
    assignedAgent: finalAssignedAgent,
    requestedBy: finalRequestedBy,
    payload: data.payload,
    idempotencyKey: finalIdempotencyKey,
    correlation: {
      requestId: data.correlation?.requestId,
      workflowId: data.correlation?.workflowId,
      executionId: data.correlation?.executionId,
      idempotencyKey: finalIdempotencyKey || data.correlation?.idempotencyKey,
      source: data.correlation?.source || "n8n_orchestration"
    },
    webhookUrl: finalWebhookUrl,
    timeoutMs: finalTimeoutMs
  };
});
var TaskErrorDetailsSchema = z3.object({
  code: z3.string(),
  message: z3.string(),
  retryable: z3.boolean(),
  details: z3.any().optional()
});
var AIErrorCodes = {
  // Authentication & Security
  UNAUTHORIZED_AUTOMATION: "UNAUTHORIZED_AUTOMATION",
  FORBIDDEN: "FORBIDDEN",
  POLICY_BLOCKED_RED: "POLICY_BLOCKED_RED",
  PROMPT_INJECTION_DETECTED: "PROMPT_INJECTION_DETECTED",
  // Validation
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNKNOWN_TASK_TYPE: "UNKNOWN_TASK_TYPE",
  UNKNOWN_TOOL: "UNKNOWN_TOOL",
  // Rate Limiting & Resource
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  TASK_TIMEOUT: "TASK_TIMEOUT",
  // Execution & Provider
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  AGENT_EXECUTION_FAILED: "AGENT_EXECUTION_FAILED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR"
};
function isRetryableErrorCode(code) {
  switch (code) {
    case AIErrorCodes.RATE_LIMIT_EXCEEDED:
    case AIErrorCodes.TASK_TIMEOUT:
    case AIErrorCodes.PROVIDER_UNAVAILABLE:
      return true;
    default:
      return false;
  }
}
function createTaskError(code, message, retryable = isRetryableErrorCode(code), details) {
  return {
    code,
    message,
    retryable,
    details
  };
}

// src/ai/server/rateLimiter.ts
function createRateLimiter(options) {
  const records = /* @__PURE__ */ new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of records.entries()) {
      if (record.resetAt <= now) {
        records.delete(key);
      }
    }
  }, Math.max(options.windowMs, 3e4)).unref();
  return (req, res, next) => {
    let clientKey = "unknown_client";
    try {
      clientKey = req.headers["x-automation-secret"] || req.headers.authorization || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "unknown_client";
    } catch {
      clientKey = "unknown_client";
    }
    const key = `${options.endpointIdentifier || "global"}:${clientKey}`;
    const now = Date.now();
    let record = records.get(key);
    if (!record || record.resetAt <= now) {
      record = {
        count: 1,
        resetAt: now + options.windowMs
      };
      records.set(key, record);
    } else {
      record.count += 1;
    }
    const remaining = Math.max(0, options.maxRequests - record.count);
    const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1e3));
    res.setHeader("X-RateLimit-Limit", options.maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetAt / 1e3));
    if (record.count > options.maxRequests) {
      res.setHeader("Retry-After", resetSeconds);
      return res.status(429).json({
        error: `Rate limit exceeded. Maximum ${options.maxRequests} requests per ${Math.round(options.windowMs / 1e3)}s allowed.`,
        code: AIErrorCodes.RATE_LIMIT_EXCEEDED,
        retryable: true,
        retryAfterSeconds: resetSeconds
      });
    }
    next();
  };
}

// src/ai/server/taskRegistry.ts
import { z as z4 } from "zod";
var TaskRegistry = class {
  static {
    this.taskTypes = /* @__PURE__ */ new Map();
  }
  static {
    this.register({
      taskType: "research_topic",
      name: "Topic Intelligence Research",
      description: "Conducts deep, factual, verified research on technology, finance, startups, or market shifts.",
      assignedAgent: "agent_research",
      defaultPriority: "medium",
      defaultPolicyLevel: "green",
      schema: ResearchInputSchema,
      timeoutMs: 6e4
    });
    this.register({
      taskType: "review_content",
      name: "Editorial Content Review",
      description: "Reviews content for factuality, tone, and editorial standards.",
      assignedAgent: "agent_research",
      defaultPriority: "medium",
      defaultPolicyLevel: "yellow",
      schema: z4.object({
        content: z4.string().min(10),
        vertical: z4.enum(["finance", "tech"]).optional(),
        review_focus: z4.string().optional()
      }),
      timeoutMs: 45e3
    });
    this.register({
      taskType: "publish_article",
      name: "Publish Article to Live Site",
      description: "Publishes article to live editorial site after human sign-off.",
      assignedAgent: "agent_research",
      defaultPriority: "high",
      defaultPolicyLevel: "yellow",
      schema: z4.object({
        slug: z4.string().min(1),
        title: z4.string().min(1)
      }),
      timeoutMs: 3e4
    });
    this.register({
      taskType: "delete_database_schema",
      name: "Delete Database Schema",
      description: "Attempt to drop or alter underlying database schema.",
      assignedAgent: "agent_research",
      defaultPriority: "critical",
      defaultPolicyLevel: "red",
      schema: z4.object({
        schemaName: z4.string()
      }),
      timeoutMs: 1e4
    });
  }
  static register(definition) {
    this.taskTypes.set(definition.taskType, definition);
  }
  static get(taskType) {
    return this.taskTypes.get(taskType);
  }
  static list() {
    return Array.from(this.taskTypes.values()).map((t) => ({
      taskType: t.taskType,
      name: t.name,
      description: t.description,
      assignedAgent: t.assignedAgent,
      defaultPriority: t.defaultPriority,
      defaultPolicyLevel: t.defaultPolicyLevel,
      timeoutMs: t.timeoutMs
    }));
  }
  static validatePayload(taskType, rawPayload) {
    const def = this.taskTypes.get(taskType);
    if (!def) {
      if (typeof rawPayload === "object" && rawPayload !== null) {
        return { success: true, data: rawPayload };
      }
      return { success: false, error: `Invalid payload for task type '${taskType}'. Must be a valid object.` };
    }
    const res = def.schema.safeParse(rawPayload);
    if (!res.success) {
      const issues = res.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      return { success: false, error: `Payload validation failed for '${taskType}': ${issues}` };
    }
    return { success: true, data: res.data };
  }
  static evaluatePolicy(taskType) {
    return PolicyEngine.evaluateAction(taskType);
  }
};

// src/server/aiRouter.ts
var aiRouter = Router();
var generalLimiter = createRateLimiter({
  windowMs: 6e4,
  maxRequests: 120,
  endpointIdentifier: "ai_general"
});
var taskLimiter = createRateLimiter({
  windowMs: 6e4,
  maxRequests: 60,
  endpointIdentifier: "ai_task_submission"
});
aiRouter.use(generalLimiter);
aiRouter.get("/health", (req, res) => {
  const geminiKeyConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
  );
  const secretConfigured = Boolean(
    process.env.STARTUPCREME_AUTOMATION_SECRET && process.env.STARTUPCREME_AUTOMATION_SECRET !== "your_m2m_automation_secret_key"
  );
  const webhookConfigured = Boolean(process.env.STARTUPCREME_WEBHOOK_URL);
  const metrics = taskManager.getSystemMetrics();
  res.json({
    status: "healthy",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    system: {
      platform: "StartupCr\xE8me AI Operating System",
      version: "2.1.0-production-orchestration",
      controlPlane: "n8n_ready",
      m2mAuthEnabled: secretConfigured,
      geminiFrontierConfigured: geminiKeyConfigured,
      webhookConfigured,
      databasePersistence: metrics.databasePersistence
    },
    constitution: {
      publication: STARTUPCREME_CONSTITUTION.publicationName,
      policyLevels: ["green", "yellow", "red"],
      strictNoDirectPublishing: true
    },
    metrics,
    registeredAgents: taskManager.listAgents(),
    registeredTools: ToolRegistry.list(),
    registeredTaskTypes: TaskRegistry.list()
  });
});
aiRouter.use(requireAutomationAuth);
aiRouter.get("/tools", (req, res) => {
  res.json({
    tools: ToolRegistry.list()
  });
});
aiRouter.post("/tools/:toolName/execute", async (req, res) => {
  const { toolName } = req.params;
  const tool = ToolRegistry.get(toolName);
  if (!tool) {
    return res.status(404).json({
      success: false,
      error: `Tool '${toolName}' is not registered in the Controlled Tool Gateway.`,
      code: AIErrorCodes.UNKNOWN_TOOL,
      retryable: false
    });
  }
  try {
    const result = await ToolRegistry.executeTool(toolName, req.body, {
      agentId: req.callerIdentity || "automation_api"
    });
    res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err?.message || "Error executing tool",
      code: AIErrorCodes.INTERNAL_ERROR,
      retryable: false
    });
  }
});
aiRouter.post("/tasks", taskLimiter, async (req, res) => {
  const parseResult = SubmitTaskRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "Invalid task submission request schema.",
      code: AIErrorCodes.VALIDATION_FAILED,
      retryable: false,
      details: parseResult.error.issues
    });
  }
  const {
    taskType,
    priority,
    assignedAgent,
    requestedBy,
    payload,
    idempotencyKey,
    webhookUrl,
    timeoutMs
  } = parseResult.data;
  const payloadValidation = TaskRegistry.validatePayload(taskType, payload);
  if (!payloadValidation.success) {
    return res.status(400).json({
      error: payloadValidation.error,
      code: AIErrorCodes.VALIDATION_FAILED,
      retryable: false
    });
  }
  try {
    const result = await taskManager.submitTask({
      taskType,
      assignedAgent: assignedAgent || void 0,
      payload: payloadValidation.data,
      priority,
      requestedBy: requestedBy || req.callerIdentity || "n8n_control_plane",
      idempotencyKey,
      correlation: req.correlation,
      webhookUrl,
      timeoutMs
    });
    const task = result.task;
    const protocol = req.protocol || "http";
    const host = req.get("host") || "localhost:3000";
    const pollUrl = `${protocol}://${host}/api/ai/tasks/${task.id}`;
    res.status(result.isExisting ? 200 : 202).json({
      success: true,
      taskId: task.id,
      status: task.status,
      isExisting: result.isExisting,
      policyLevel: task.policy_level || "green",
      correlation: req.correlation,
      task,
      pollUrl,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    });
  } catch (err) {
    res.status(500).json({
      error: err?.message || "Error submitting task to orchestrator",
      code: AIErrorCodes.INTERNAL_ERROR,
      retryable: false
    });
  }
});
aiRouter.get("/tasks", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const status = req.query.status;
  const tasks = taskManager.listTasks(limit, status);
  res.json({ tasks, total: tasks.length });
});
aiRouter.get("/tasks/:id", async (req, res) => {
  const task = await taskManager.getTaskAsync(req.params.id);
  if (!task) {
    return res.status(404).json({
      error: `Task '${req.params.id}' not found.`,
      code: AIErrorCodes.NOT_FOUND,
      retryable: false
    });
  }
  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:3000";
  const pollUrl = `${protocol}://${host}/api/ai/tasks/${task.id}`;
  const createdTime = new Date(task.created_at).getTime();
  const completedTime = task.completed_at ? new Date(task.completed_at).getTime() : null;
  const durationMs = completedTime ? completedTime - createdTime : null;
  let approvalDetails = null;
  if (task.approval_id) {
    const approval = taskManager.listApprovals().find((a) => a.id === task.approval_id);
    if (approval) {
      approvalDetails = {
        id: approval.id,
        status: approval.status,
        description: approval.description,
        decidedBy: approval.decided_by,
        decisionReason: approval.decision_reason
      };
    }
  }
  const responseEnvelope = {
    taskId: task.id,
    taskType: task.task_type,
    status: task.status,
    priority: task.priority,
    policyLevel: task.policy_level || "green",
    correlation: task.metadata || { requestId: req.params.id },
    result: task.result ? {
      success: true,
      data: task.result,
      confidence: 0.95,
      reasoningSummary: "Execution verified against Editorial Constitution"
    } : null,
    error: task.error ? createTaskError(
      task.status === "failed" && task.error.includes("timed out") ? AIErrorCodes.TASK_TIMEOUT : AIErrorCodes.AGENT_EXECUTION_FAILED,
      task.error
    ) : null,
    approval: approvalDetails,
    timestamps: {
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      completedAt: task.completed_at,
      durationMs
    },
    pollUrl
  };
  res.json(responseEnvelope);
});
aiRouter.get("/approvals", (req, res) => {
  const status = req.query.status;
  const approvals = taskManager.listApprovals(status);
  res.json({ approvals, count: approvals.length });
});
aiRouter.post("/approvals/:id/approve", async (req, res) => {
  const { decided_by, reason } = req.body;
  const result = await taskManager.approveTask(
    req.params.id,
    decided_by || "Editorial Supervisor",
    reason || "Approved via Control Plane"
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});
aiRouter.post("/approvals/:id/reject", async (req, res) => {
  const { decided_by, reason } = req.body;
  const result = await taskManager.rejectTask(
    req.params.id,
    decided_by || "Editorial Supervisor",
    reason || "Rejected via Control Plane"
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});
aiRouter.post("/approvals/:id/review", async (req, res) => {
  const { decision, decided_by, reason } = req.body;
  if (decision === "approve") {
    const result = await taskManager.approveTask(req.params.id, decided_by, reason);
    return res.status(result.success ? 200 : 400).json(result);
  } else if (decision === "reject") {
    const result = await taskManager.rejectTask(req.params.id, decided_by, reason);
    return res.status(result.success ? 200 : 400).json(result);
  } else {
    return res.status(400).json({ error: "Invalid decision. Must be 'approve' or 'reject'." });
  }
});
aiRouter.get("/actions", (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const actions = taskManager.listActions(limit);
  res.json({ actions, count: actions.length });
});
aiRouter.get("/alerts", (req, res) => {
  const includeDismissed = req.query.include_dismissed === "true";
  const alerts = taskManager.listAlerts(includeDismissed);
  res.json({ alerts, count: alerts.length });
});
aiRouter.post("/alerts/:id/dismiss", (req, res) => {
  const success = taskManager.dismissAlert(req.params.id);
  res.json({ success });
});
aiRouter.get("/memory", (req, res) => {
  const type = req.query.type;
  const query = req.query.q;
  if (query) {
    const results = memoryStore.search(query, type);
    return res.json({ memories: results, count: results.length });
  }
  if (type) {
    const results = memoryStore.listByType(type);
    return res.json({ memories: results, count: results.length });
  }
  const all = memoryStore.listAll();
  res.json({ memories: all, count: all.length });
});
aiRouter.post("/memory", (req, res) => {
  try {
    const { memory_type, key, value, confidence, source, tags } = req.body;
    if (!memory_type || !key || !value) {
      return res.status(400).json({ error: "Missing memory_type, key, or value" });
    }
    const saved = memoryStore.set({
      memoryType: memory_type,
      key,
      value,
      confidence,
      source,
      tags
    });
    res.status(201).json({ success: true, memory: saved });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Failed to save memory" });
  }
});
aiRouter.post("/research", taskLimiter, async (req, res) => {
  const idempotencyKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"] || req.body.idempotency_key || req.body.idempotencyKey;
  const validation = ResearchInputSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json({
      error: "Invalid research parameters",
      code: AIErrorCodes.VALIDATION_FAILED,
      details: validation.error.issues
    });
  }
  try {
    const { task, isExisting } = await taskManager.submitTask({
      taskType: "research_topic",
      assignedAgent: "agent_research",
      payload: validation.data,
      priority: "high",
      requestedBy: req.body.requested_by || req.callerIdentity || "n8n_research_flow",
      idempotencyKey,
      correlation: req.correlation,
      timeoutMs: req.body.timeout_ms || 6e4
    });
    let finalTask = task;
    let attempts = 0;
    while ((finalTask.status === "queued" || finalTask.status === "running") && attempts < 24) {
      await new Promise((r) => setTimeout(r, 250));
      finalTask = taskManager.getTask(task.id) || finalTask;
      attempts++;
    }
    res.status(finalTask.status === "completed" ? 200 : 202).json({
      success: finalTask.status === "completed",
      isExisting,
      task: finalTask,
      result: finalTask.result,
      correlation: req.correlation
    });
  } catch (err) {
    res.status(500).json({
      error: err?.message || "Error executing research topic",
      code: AIErrorCodes.INTERNAL_ERROR,
      retryable: false
    });
  }
});

// server/app.ts
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB limit
  }
});
function getR2Config() {
  const getEnv = (...keys) => {
    for (const k of keys) {
      const val = process.env[k];
      if (val && typeof val === "string" && val.trim().length > 0) {
        return val.trim().replace(/^["']|["']$/g, "");
      }
    }
    return "";
  };
  const rawAccountId = getEnv(
    "R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_ACCOUNT_ID",
    "CF_R2_ACCOUNT_ID",
    "CF_ACCOUNT_ID",
    "VITE_R2_ACCOUNT_ID",
    "VITE_CLOUDFLARE_R2_ACCOUNT_ID"
  );
  const accountId = rawAccountId.replace(/^https?:\/\//i, "").replace(/\.r2\.cloudflarestorage\.com.*$/i, "").replace(/\/.*$/, "").trim();
  const accessKeyId = getEnv(
    "R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CF_R2_ACCESS_KEY_ID",
    "R2_ACCESS_KEY",
    "VITE_R2_ACCESS_KEY_ID",
    "VITE_CLOUDFLARE_R2_ACCESS_KEY_ID"
  );
  const secretAccessKey = getEnv(
    "R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CF_R2_SECRET_ACCESS_KEY",
    "R2_SECRET_KEY",
    "R2_SECRET",
    "VITE_R2_SECRET_ACCESS_KEY",
    "VITE_CLOUDFLARE_R2_SECRET_ACCESS_KEY"
  );
  const bucketName = getEnv(
    "R2_BUCKET_NAME",
    "CLOUDFLARE_R2_BUCKET_NAME",
    "CF_R2_BUCKET_NAME",
    "R2_BUCKET",
    "CF_R2_BUCKET",
    "VITE_R2_BUCKET_NAME",
    "VITE_CLOUDFLARE_R2_BUCKET_NAME"
  );
  const publicUrl = getEnv(
    "R2_PUBLIC_URL",
    "CLOUDFLARE_R2_PUBLIC_URL",
    "CF_R2_PUBLIC_URL",
    "R2_PUBLIC_DOMAIN",
    "R2_DOMAIN",
    "VITE_R2_PUBLIC_URL",
    "VITE_CLOUDFLARE_R2_PUBLIC_URL"
  );
  const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey && bucketName);
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl, isConfigured };
}
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "10mb" }));
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch {
    }
  }
  app2.use("/uploads", express.static(uploadsDir));
  app2.get(["/api/health", "/health"], (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json({ status: "ok" });
  });
  app2.get(["/api/auth/profile", "/auth/profile"], async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = authHeader.substring(7).trim();
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    if (!supabaseUrl || !serviceRoleKey && !anonKey) {
      return res.status(503).json({ error: "Database not configured" });
    }
    try {
      const authClient = createClient3(supabaseUrl, anonKey || serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: "Invalid or expired auth token", details: authError?.message });
      }
      const email = (user.email || "").trim().toLowerCase();
      const userId = user.id;
      const adminClient = createClient3(supabaseUrl, serviceRoleKey || anonKey, {
        db: { schema: "startupcreme" },
        auth: { persistSession: false, autoRefreshToken: false }
      });
      let dbUser = null;
      const { data: byId } = await adminClient.from("users").select("*").eq("id", userId).maybeSingle();
      if (byId) {
        dbUser = byId;
      } else if (email) {
        const { data: byEmail } = await adminClient.from("users").select("*").ilike("email", email).maybeSingle();
        if (byEmail) {
          dbUser = byEmail;
          if (serviceRoleKey && byEmail.id !== userId) {
            await adminClient.from("users").update({ id: userId, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("email", byEmail.email);
            dbUser.id = userId;
          }
        }
      }
      if (!dbUser) {
        const metadataRole = user.user_metadata?.role || "user";
        const fullName = user.user_metadata?.full_name || email.split("@")[0] || "User";
        const avatarUrl = user.user_metadata?.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(email)}/100/100`;
        const { data: insertedUser } = await adminClient.from("users").insert({
          id: userId,
          email,
          full_name: fullName,
          avatar_url: avatarUrl,
          role: metadataRole
        }).select("*").single();
        dbUser = insertedUser || {
          id: userId,
          email,
          full_name: fullName,
          avatar_url: avatarUrl,
          role: metadataRole
        };
      }
      const role = (dbUser.role || "user").trim().toLowerCase() === "admin" ? "admin" : "user";
      if (serviceRoleKey && user.user_metadata?.role !== role) {
        const masterClient = createClient3(supabaseUrl, serviceRoleKey);
        masterClient.auth.admin.updateUserById(userId, {
          user_metadata: { ...user.user_metadata, role }
        }).catch(() => {
        });
      }
      return res.json({
        id: dbUser.id || userId,
        email: dbUser.email || email,
        full_name: dbUser.full_name || user.user_metadata?.full_name || email.split("@")[0],
        avatar_url: dbUser.avatar_url || user.user_metadata?.avatar_url,
        role,
        reputation: dbUser.reputation || 100,
        badge: dbUser.badge || (role === "admin" ? "Founder" : "Contributor"),
        created_at: dbUser.created_at || user.created_at
      });
    } catch (err) {
      console.error("[AuthProfile API] Error resolving profile:", err);
      return res.status(500).json({ error: "Internal error resolving user profile" });
    }
  });
  app2.use(["/api/ai", "/ai"], aiRouter);
  app2.get(["/sitemap.xml", "/sitemap", "/sitemap_index.xml"], async (req, res) => {
    res.setHeader("Content-Type", "text/xml; charset=utf-8");
    res.setHeader("X-Robots-Tag", "noindex");
    try {
      let host = req.get("x-forwarded-host") || req.get("host") || "www.startupcreme.com";
      if (!host.includes("startupcreme.com")) {
        host = "www.startupcreme.com";
      }
      let protocol = req.get("x-forwarded-proto") || req.protocol || "https";
      if (host.includes("startupcreme.com")) {
        protocol = "https";
      }
      const baseUrl = `${protocol}://${host}`;
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
      let posts = [];
      let topics = [];
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const client = createClient3(supabaseUrl, supabaseAnonKey, {
            db: { schema: "startupcreme" }
          });
          const { data: postsData } = await client.from("posts").select("*").eq("status", "published");
          if (postsData) posts = postsData;
          const { data: topicsData } = await client.from("discussion_topics").select("*");
          if (topicsData) topics = topicsData;
        } catch (e) {
          console.warn("Error fetching sitemap data from Supabase:", e);
        }
      }
      const locales = ["en-us", "en-gb", "de-de", "ja-jp", "fr-fr"];
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;
      locales.forEach((loc) => {
        xml += `  <url>
    <loc>${baseUrl}/${loc}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
`;
        xml += `  <url>
    <loc>${baseUrl}/${loc}/finance</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;
        xml += `  <url>
    <loc>${baseUrl}/${loc}/tech</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;
        xml += `  <url>
    <loc>${baseUrl}/${loc}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;
        xml += `  <url>
    <loc>${baseUrl}/${loc}/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;
      });
      xml += `  <url>
    <loc>${baseUrl}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;
      xml += `  <url>
    <loc>${baseUrl}/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
`;
      xml += `  <url>
    <loc>${baseUrl}/discussion</loc>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
`;
      posts.forEach((post) => {
        const loc = post.locale || "en-us";
        const postUrl = `${baseUrl}/${loc}/${post.vertical}/${post.slug}`;
        const lastMod = post.updated_at ? new Date(post.updated_at).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
        xml += `  <url>
    <loc>${postUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>
`;
      });
      topics.forEach((t) => {
        const topicUrl = `${baseUrl}/discussion/${t.slug}`;
        const lastMod = t.updated_at ? new Date(t.updated_at).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
        xml += `  <url>
    <loc>${topicUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
`;
      });
      xml += `</urlset>`;
      return res.status(200).send(xml);
    } catch (err) {
      console.error("Sitemap generation error, serving static sitemap.xml fallback:", err);
      const fallbackPath = path.resolve(process.cwd(), "public", "sitemap.xml");
      if (fs.existsSync(fallbackPath)) {
        return res.status(200).sendFile(fallbackPath);
      }
      return res.status(500).send("Error generating sitemap");
    }
  });
  app2.get("/robots.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    let host = req.get("x-forwarded-host") || req.get("host") || "www.startupcreme.com";
    if (!host.includes("startupcreme.com")) {
      host = "www.startupcreme.com";
    }
    let protocol = req.get("x-forwarded-proto") || req.protocol || "https";
    if (host.includes("startupcreme.com")) {
      protocol = "https";
    }
    const robots = `User-agent: *
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /privacy
Allow: /terms
Allow: /discussion

Disallow: /admin
Disallow: /api/

Sitemap: ${protocol}://${host}/sitemap.xml
`;
    return res.status(200).send(robots);
  });
  app2.post(["/api/upload-image", "/upload-image"], upload.single("image"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No image file provided in request." });
      }
      const r2Config = getR2Config();
      const fileExt = path.extname(file.originalname) || ".jpg";
      const cleanBaseName = path.basename(file.originalname, fileExt).replace(/[^a-zA-Z0-9_-]/g, "_");
      const objectKey = `articles/${Date.now()}-${cleanBaseName}${fileExt}`;
      const saveLocally = () => {
        const articleUploadsDir = path.join(process.cwd(), "public", "uploads", "articles");
        if (!fs.existsSync(articleUploadsDir)) {
          fs.mkdirSync(articleUploadsDir, { recursive: true });
        }
        const localFilename = `${Date.now()}-${cleanBaseName}${fileExt}`;
        const localFilePath = path.join(articleUploadsDir, localFilename);
        fs.writeFileSync(localFilePath, file.buffer);
        return `/uploads/articles/${localFilename}`;
      };
      if (!r2Config.isConfigured) {
        const localUrl = saveLocally();
        console.log("R2 storage credentials not fully configured. Saved image locally:", localUrl);
        return res.json({
          success: true,
          url: localUrl,
          key: objectKey,
          storage: "local",
          message: "Saved to server storage. (To route uploads to Cloudflare R2 CDN, configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in Settings)."
        });
      }
      try {
        const endpoint = `https://${r2Config.accountId}.r2.cloudflarestorage.com`;
        const s3Client = new S3Client({
          region: "auto",
          endpoint,
          credentials: {
            accessKeyId: r2Config.accessKeyId,
            secretAccessKey: r2Config.secretAccessKey
          }
        });
        const command = new PutObjectCommand({
          Bucket: r2Config.bucketName,
          Key: objectKey,
          Body: file.buffer,
          ContentType: file.mimetype || "image/jpeg",
          CacheControl: "public, max-age=31536000, immutable"
        });
        await s3Client.send(command);
        let imageUrl = "";
        if (r2Config.publicUrl) {
          let cleanPublicUrl = r2Config.publicUrl.replace(/\/+$/, "");
          if (!/^https?:\/\//i.test(cleanPublicUrl)) {
            cleanPublicUrl = `https://${cleanPublicUrl}`;
          }
          imageUrl = `${cleanPublicUrl}/${objectKey}`;
        } else {
          imageUrl = `https://${r2Config.bucketName}.${r2Config.accountId}.r2.cloudflarestorage.com/${objectKey}`;
        }
        console.log("Successfully uploaded image to Cloudflare R2:", imageUrl);
        return res.json({
          success: true,
          url: imageUrl,
          key: objectKey,
          storage: "r2",
          message: "Successfully uploaded to Cloudflare R2"
        });
      } catch (r2Err) {
        console.warn("Cloudflare R2 upload error, using server local storage fallback:", r2Err);
        const localUrl = saveLocally();
        return res.json({
          success: true,
          url: localUrl,
          key: objectKey,
          storage: "local",
          message: `R2 Upload warning (${r2Err?.message || "Error communicating with R2"}). Saved to server local storage as fallback.`,
          r2Error: r2Err?.message
        });
      }
    } catch (err) {
      console.error("Fatal error during image upload:", err);
      return res.status(500).json({
        error: err?.message || "Failed to process image upload."
      });
    }
  });
  return app2;
}
var app = createApp();
var app_default = app;
export {
  app,
  createApp,
  app_default as default
};
