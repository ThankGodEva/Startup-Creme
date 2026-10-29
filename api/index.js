// server/app.ts
import express from "express";
import path from "path";
import fs from "fs";
import crypto3 from "crypto";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient as createClient5 } from "@supabase/supabase-js";

// src/server/expansionRouter.ts
import { Router } from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// src/lib/expansionData.ts
var INITIAL_STARTUPS = [
  {
    id: "8ec5e176-acf3-45ec-8ade-42e061bd1d32",
    name: "Xhipa",
    slug: "xhipa-fzok",
    tagline: "Create your storefront, add your products or bookable services, and share one simple link with your customers across WhatsApp, Instagram, and TikTok.",
    description: "Multi-tenant digital business operating system with storefronts, services & rental bookings, real-time quantity availability, WhatsApp ordering, catalog mode, guest checkout, Paystack payments, and partner network.",
    website_url: "https://xhipa.com",
    logo_url: "https://www.xhipa.com/Xhipa-dark.png",
    stage: "bootstrapped",
    vertical: "E-Commerce",
    tech_stack: [
      "React Router",
      "Supabase",
      "Cloudflare Workers",
      "Cloudflare for SaaS",
      "Paystack"
    ],
    submitted_by: "9373b6e3-dcea-4c1b-8063-d1cd9ee3037a",
    is_approved: true,
    created_at: "2026-10-06T16:45:36.815461+00:00"
  }
];
var INITIAL_CENTRAL_BANK_RATES = [
  {
    id: "cb-fed",
    bank_code: "FED",
    bank_name: "US Federal Reserve",
    country_or_region: "United States",
    currency: "USD",
    rate_instrument: "Fed Funds Target (3.75%\u20134.00%)",
    current_rate: 4,
    previous_rate: 3.75,
    change_bps: 25,
    trend: "up",
    inflation_yoy: 2.6,
    real_rate: 1.4,
    last_decision_date: "2026-09-16",
    next_meeting_date: "2026-11-05",
    official_source_url: "https://www.federalreserve.gov/monetarypolicy/openmarket.htm",
    historical_12m: [3.75, 3.5, 3.5, 3.5, 3.75, 3.75, 4]
  },
  {
    id: "cb-ecb",
    bank_code: "ECB",
    bank_name: "European Central Bank",
    country_or_region: "Eurozone",
    currency: "EUR",
    rate_instrument: "Deposit Facility Rate",
    current_rate: 2.5,
    previous_rate: 2.25,
    change_bps: 25,
    trend: "up",
    inflation_yoy: 2.1,
    real_rate: 0.4,
    last_decision_date: "2026-09-10",
    next_meeting_date: "2026-10-29",
    official_source_url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html",
    historical_12m: [2, 2, 2, 2.25, 2.25, 2.25, 2.5]
  },
  {
    id: "cb-cbn",
    bank_code: "CBN",
    bank_name: "Central Bank of Nigeria",
    country_or_region: "Nigeria",
    currency: "NGN",
    rate_instrument: "Monetary Policy Rate (MPR)",
    current_rate: 23,
    previous_rate: 26.5,
    change_bps: -350,
    trend: "down",
    inflation_yoy: 24.8,
    real_rate: -1.8,
    last_decision_date: "2026-09-22",
    next_meeting_date: "2026-11-24",
    official_source_url: "https://www.cbn.gov.ng/rates/mnymp.asp",
    historical_12m: [27.25, 27.5, 27.5, 26.75, 26.5, 26.5, 23]
  },
  {
    id: "cb-boe",
    bank_code: "BoE",
    bank_name: "Bank of England",
    country_or_region: "United Kingdom",
    currency: "GBP",
    rate_instrument: "Official Bank Rate",
    current_rate: 3.75,
    previous_rate: 3.75,
    change_bps: 0,
    trend: "hold",
    inflation_yoy: 3.1,
    real_rate: 0.65,
    last_decision_date: "2026-09-17",
    next_meeting_date: "2026-11-05",
    official_source_url: "https://www.bankofengland.co.uk/monetary-policy/the-interest-rate-bank-rate",
    historical_12m: [4, 3.75, 3.75, 3.75, 3.75, 3.75, 3.75]
  },
  {
    id: "cb-boj",
    bank_code: "BoJ",
    bank_name: "Bank of Japan",
    country_or_region: "Japan",
    currency: "JPY",
    rate_instrument: "Uncollateralized Overnight Call Rate",
    current_rate: 1.25,
    previous_rate: 1,
    change_bps: 25,
    trend: "up",
    inflation_yoy: 2.6,
    real_rate: -1.35,
    last_decision_date: "2026-09-18",
    next_meeting_date: "2026-10-30",
    official_source_url: "https://www.boj.or.jp/en/mopo/index.htm",
    historical_12m: [0.25, 0.5, 0.5, 0.75, 1, 1, 1.25]
  },
  {
    id: "cb-sarb",
    bank_code: "SARB",
    bank_name: "South African Reserve Bank",
    country_or_region: "South Africa",
    currency: "ZAR",
    rate_instrument: "Monetary Policy Repo Rate",
    current_rate: 7.25,
    previous_rate: 7,
    change_bps: 25,
    trend: "up",
    inflation_yoy: 4.4,
    real_rate: 2.85,
    last_decision_date: "2026-09-25",
    next_meeting_date: "2026-11-19",
    official_source_url: "https://www.resbank.co.za/en/home/what-we-do/monetary-policy",
    historical_12m: [8, 7.75, 7.5, 7.25, 7, 7, 7.25]
  },
  {
    id: "cb-cbk",
    bank_code: "CBK",
    bank_name: "Central Bank of Kenya",
    country_or_region: "Kenya",
    currency: "KES",
    rate_instrument: "Central Bank Rate (CBR)",
    current_rate: 8.75,
    previous_rate: 8.75,
    change_bps: 0,
    trend: "hold",
    inflation_yoy: 4.2,
    real_rate: 4.55,
    last_decision_date: "2026-08-11",
    next_meeting_date: "2026-10-13",
    official_source_url: "https://www.centralbank.go.ke/rates/central-bank-rate/",
    historical_12m: [12, 11.25, 10.5, 9.5, 8.75, 8.75, 8.75]
  },
  {
    id: "cb-rbi",
    bank_code: "RBI",
    bank_name: "Reserve Bank of India",
    country_or_region: "India",
    currency: "INR",
    rate_instrument: "Policy Repo Rate",
    current_rate: 5.25,
    previous_rate: 5.25,
    change_bps: 0,
    trend: "hold",
    inflation_yoy: 3.7,
    real_rate: 1.55,
    last_decision_date: "2026-08-05",
    next_meeting_date: "2026-10-07",
    official_source_url: "https://www.rbi.org.in/",
    historical_12m: [6.5, 6.25, 6, 5.75, 5.5, 5.25, 5.25]
  }
];
var INITIAL_CLOUD_PRICING_INDEX = [
  {
    id: "cp-aws",
    provider: "AWS (Lambda + RDS + CloudFront)",
    tier_name: "On-Demand Enterprise",
    category: "Serverless Compute",
    serverless_per_1m_req: 0.2,
    compute_gb_sec: 1667e-8,
    db_storage_per_gb: 0.115,
    egress_per_gb: 0.09,
    free_egress_gb: 100,
    gpu_h100_hourly: 3.92,
    trend_30d: "hold",
    notes: "Includes 1M free Lambda requests/mo; NAT Gateway & cross-AZ transfer billed separately.",
    updated_at: "2026-09-28T00:00:00Z"
  },
  {
    id: "cp-supabase",
    provider: "Supabase (Pro / Scale)",
    tier_name: "Pro Managed Postgres",
    category: "Managed Postgres",
    serverless_per_1m_req: 2,
    compute_gb_sec: 15e-6,
    db_storage_per_gb: 0.125,
    egress_per_gb: 0.09,
    free_egress_gb: 250,
    gpu_h100_hourly: null,
    trend_30d: "down",
    notes: "$25/mo base includes 8GB disk, 250GB cached/un-cached egress, and 100k MAU Auth.",
    updated_at: "2026-09-28T00:00:00Z"
  },
  {
    id: "cp-vercel",
    provider: "Vercel (Fluid Compute)",
    tier_name: "Pro Team Plan",
    category: "Serverless Compute",
    serverless_per_1m_req: 0.6,
    compute_gb_sec: 18e-6,
    db_storage_per_gb: 0.15,
    egress_per_gb: 0.15,
    free_egress_gb: 1e3,
    gpu_h100_hourly: null,
    trend_30d: "down",
    notes: "Fluid Compute reduces idle I/O wait charges by up to 65% for AI streaming workloads.",
    updated_at: "2026-09-28T00:00:00Z"
  },
  {
    id: "cp-cloudflare",
    provider: "Cloudflare (Workers + R2 + D1)",
    tier_name: "Workers Paid",
    category: "Bandwidth & Egress",
    serverless_per_1m_req: 0.3,
    compute_gb_sec: 12e-6,
    db_storage_per_gb: 0.015,
    egress_per_gb: 0,
    free_egress_gb: 999999,
    gpu_h100_hourly: null,
    trend_30d: "hold",
    notes: "$0.00 egress fee on R2 object storage; billed strictly on CPU milliseconds, not wall-clock wait.",
    updated_at: "2026-09-28T00:00:00Z"
  },
  {
    id: "cp-gcp",
    provider: "Google Cloud (Cloud Run + Cloud SQL)",
    tier_name: "Pay-As-You-Go",
    category: "AI GPU Compute",
    serverless_per_1m_req: 0.4,
    compute_gb_sec: 18e-6,
    db_storage_per_gb: 0.17,
    egress_per_gb: 0.12,
    free_egress_gb: 100,
    gpu_h100_hourly: 3.65,
    trend_30d: "down",
    notes: "Committed Use Discounts (CUD) lower A3 H100 Mega instance pricing by 42%.",
    updated_at: "2026-09-28T00:00:00Z"
  },
  {
    id: "cp-neon",
    provider: "Neon Serverless Postgres",
    tier_name: "Scale Autoscaling",
    category: "Managed Postgres",
    serverless_per_1m_req: 0.25,
    compute_gb_sec: 16e-6,
    db_storage_per_gb: 0.1,
    egress_per_gb: 0.09,
    free_egress_gb: 100,
    gpu_h100_hourly: null,
    trend_30d: "down",
    notes: "Scale-to-zero branching architecture with instant copy-on-write database clones for CI/CD.",
    updated_at: "2026-09-28T00:00:00Z"
  }
];
var INITIAL_RATE_SNAPSHOT = {
  id: "snap-2026-10-01",
  source: "n8n_automated_monetary_cloud_pipeline",
  recorded_at: "2026-10-01T06:00:00Z",
  central_bank_rates: INITIAL_CENTRAL_BANK_RATES,
  cloud_pricing_index: INITIAL_CLOUD_PRICING_INDEX
};
var INITIAL_JOBS = [];
var INITIAL_EVENTS = [];

// src/lib/validation.ts
import { z } from "zod";

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

// src/lib/validation.ts
var NewsletterSubscriptionSchema = z.object({
  email: z.string().email("Please enter a valid email address").toLowerCase().trim(),
  source: z.string().optional().default("footer"),
  vertical: z.enum(["all", "finance", "tech", "founders-mindset"]).optional().default("all"),
  locale: z.string().optional().default("en-us")
});
var PostSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200, "Title too long"),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  excerpt: z.string().min(10, "Excerpt must be at least 10 characters").max(500),
  content: z.string().min(20, "Content must be at least 20 characters"),
  vertical: z.enum(["finance", "tech", "founders-mindset"]),
  locale: z.string().min(2).max(10),
  cover_image: z.string().transform((v) => normalizeImageUrl(v)).optional().default(""),
  status: z.enum(["draft", "published", "archived"]),
  dual_silo: z.boolean().optional().default(false),
  source_url: z.string().trim().regex(/^https:\/\/.+/i, "Source URL must be a valid HTTPS URL").optional().nullable(),
  source_name: z.string().trim().max(120).optional().nullable(),
  ai_generated: z.boolean().optional().default(false),
  hide_ai_disclosure: z.boolean().optional().default(false)
});
var EditorialDraftSubmissionSchema = z.object({
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(200, "Title cannot exceed 200 characters"),
  slug: z.string().trim().min(3, "Slug must be at least 3 characters").max(100, "Slug cannot exceed 100 characters").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens (e.g., "fintech-infrastructure-2026")'),
  vertical: z.enum(["finance", "tech", "founders-mindset"]),
  content: z.union([
    z.string().trim().min(20, "Content must be at least 20 characters"),
    z.record(z.string(), z.any())
  ]),
  locale: z.string().trim().toLowerCase().min(2).max(10).optional().default("en-us"),
  excerpt: z.string().trim().max(500).optional(),
  meta_description: z.string().trim().max(200).optional(),
  canonical_url: z.string().trim().url("Canonical URL must be a valid URL").optional().nullable(),
  cover_image: z.string().trim().regex(/^https:\/\/.+/i, "Cover image must be a valid HTTPS URL").optional().nullable(),
  source_url: z.string().trim().regex(/^https:\/\/.+/i, "Source URL must be a valid HTTPS URL").optional().nullable(),
  source_name: z.string().trim().max(120).optional().nullable(),
  ai_generated: z.boolean().optional().default(false),
  hide_ai_disclosure: z.boolean().optional().default(false),
  author_name: z.string().trim().max(80).optional().default("Startup Cr\xE8me Editorial"),
  author_role: z.string().trim().max(80).optional().default("Senior Analyst"),
  author_avatar: z.string().trim().regex(/^https:\/\/.+/i, "Author avatar must be a valid HTTPS URL").optional().nullable(),
  dual_silo: z.boolean().optional().default(false),
  tags: z.array(z.string().trim().min(1).max(50)).max(15).optional().default([]),
  reading_time_minutes: z.number().int().positive().max(120).optional(),
  word_count: z.number().int().nonnegative().optional(),
  idempotency_key: z.string().trim().min(4).max(256).optional(),
  workflow_id: z.string().trim().max(128).optional()
});
var TopicSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(150),
  body: z.string().min(10, "Discussion body must be at least 10 characters"),
  category: z.enum([
    "Macro",
    "Venture Capital",
    "Fintech",
    "AI Architecture",
    "Hardware",
    "Cloud Infrastructure",
    "Sales",
    "Marketing",
    "sales",
    "marketing",
    "finance",
    "tech",
    "startup",
    "general"
  ])
});
var CommentSchema = z.object({
  topic_id: z.string().uuid().or(z.string().min(1)),
  content: z.string().min(2, "Comment cannot be empty").max(2e3),
  parent_id: z.string().uuid().optional().nullable()
});
var GuestCommentSchema = z.object({
  author_name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name cannot exceed 60 characters"),
  author_email: z.string().trim().email("Please enter a valid email address").toLowerCase(),
  content: z.string().trim().min(2, "Comment must be at least 2 characters").max(2e3, "Comment cannot exceed 2000 characters")
});
var WEBHOOK_OPPORTUNITY_TYPES = [
  "grant",
  "accelerator",
  "incubator",
  "fellowship",
  "pitch_competition",
  "hackathon",
  "conference"
];
var EventWebhookIngestionSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200, "Title cannot exceed 200 characters").optional(),
  event_title: z.string().trim().min(3, "Event title must be at least 3 characters").max(200, "Event title cannot exceed 200 characters").optional(),
  slug: z.string().trim().min(3, "Slug must be at least 3 characters").max(100, "Slug cannot exceed 100 characters").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens (e.g., "frontier-grant-2026")').optional(),
  opportunity_type: z.string().trim().refine(
    (val) => WEBHOOK_OPPORTUNITY_TYPES.includes(val),
    {
      message: "opportunity_type must be one of: grant, accelerator, incubator, fellowship, pitch_competition, hackathon, conference. 'general' is rejected on this route."
    }
  ),
  application_url: z.string().trim().regex(/^https:\/\/.+/i, "Application URL must be a valid HTTPS URL"),
  deadline_date: z.string().trim().min(1, "deadline_date is required").refine(
    (val) => {
      const ms = Date.parse(val);
      return !isNaN(ms) && ms > Date.now();
    },
    { message: "deadline_date must be a valid future timestamp" }
  ),
  vertical: z.enum(["finance", "tech", "founders-mindset"]).optional().default("tech"),
  locale: z.string().trim().toLowerCase().min(2).max(10).optional().default("en-us"),
  content: z.union([
    z.string().trim().min(20, "Content must be at least 20 characters"),
    z.record(z.string(), z.any())
  ]).optional(),
  description: z.string().trim().max(2e3).optional(),
  excerpt: z.string().trim().max(500).optional(),
  location: z.string().trim().min(2, "Location is required").max(100).optional().default("Global (Remote)"),
  funding_amount: z.string().trim().max(100).optional().nullable(),
  status: z.enum(["draft", "published"]).optional().default("draft"),
  tags: z.array(z.string().trim().min(1).max(50)).max(15, "Maximum 15 tags allowed").optional().default([]),
  cover_image: z.string().trim().regex(/^https:\/\/.+/i, "Cover image must be a valid HTTPS URL").optional().nullable(),
  author_name: z.string().trim().max(80).optional().default("Startup Cr\xE8me Editorial"),
  author_role: z.string().trim().max(80).optional().default("Principal Editor"),
  author_avatar: z.string().trim().regex(/^https:\/\/.+/i, "Author avatar must be a valid HTTPS URL").optional().nullable(),
  canonical_url: z.string().trim().url("Canonical URL must be a valid URL").optional().nullable(),
  meta_description: z.string().trim().max(200).optional(),
  reading_time_minutes: z.number().int().positive().max(120).optional(),
  word_count: z.number().int().nonnegative().optional(),
  dual_silo: z.boolean().optional().default(false),
  silo_badge: z.string().optional().nullable(),
  source_url: z.string().trim().regex(/^https:\/\/.+/i, "Source URL must be a valid HTTPS URL").optional().nullable(),
  source_name: z.string().trim().max(120).optional().nullable(),
  ai_generated: z.boolean().optional().default(false),
  hide_ai_disclosure: z.boolean().optional().default(false)
}).superRefine((data, ctx) => {
  const effectiveTitle = (data.event_title || data.title || "").trim();
  if (!effectiveTitle || effectiveTitle.length < 3) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either title or event_title is required (min 3 characters)",
      path: ["title"]
    });
  }
  const effectiveContent = data.content || data.description;
  if (!effectiveContent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either content (min 20 characters or Tiptap object) or description is required",
      path: ["content"]
    });
  } else if (typeof effectiveContent === "string" && effectiveContent.trim().length < 20) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Content or description must be at least 20 characters",
      path: ["content"]
    });
  }
});
var EventSubmissionSchema = z.object({
  title: z.string().trim().min(3, "Event title must be at least 3 characters").max(200, "Title cannot exceed 200 characters"),
  opportunity_type: z.enum([
    "grant",
    "accelerator",
    "fellowship",
    "incubator",
    "pitch_competition",
    "hackathon",
    "conference",
    "general"
  ]),
  application_url: z.string().trim().url("Please enter a valid URL (starting with http:// or https://)"),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(2e3),
  location: z.string().trim().min(2, "Location is required").max(100).default("Global (Remote)"),
  deadline_date: z.string().trim().min(4, "Valid deadline date required"),
  funding_amount: z.string().trim().max(100).optional().nullable(),
  vertical: z.enum(["finance", "tech", "founders-mindset"]).optional().default("tech"),
  locale: z.string().trim().optional().default("en-us"),
  slug: z.string().trim().optional(),
  content: z.string().trim().optional()
});

// src/server/expansionRouter.ts
var expansionRouter = Router();
var runtimeStartups = [...INITIAL_STARTUPS];
var runtimeJobs = [...INITIAL_JOBS];
var runtimeRateSnapshot = { ...INITIAL_RATE_SNAPSHOT };
var runtimeEvents = [...INITIAL_EVENTS];
var hasPurgedLegacyMockRows = false;
var LEGACY_MOCK_STARTUP_SLUGS = [
  "paystack-treasury",
  "kora-quant",
  "vortex-inference",
  "moniepoint-ledger",
  "termii-omni",
  "lazer-edtech"
];
var LEGACY_MOCK_JOB_TITLES = [
  "Fractional CFO (Series A & B SaaS)",
  "Staff Distributed Systems Engineer (Rust / Go)",
  "Principal Cloud FinOps Architect",
  "Senior Quantitative Financial Modeler",
  "Fractional CTO & AI Infrastructure Advisor",
  "Lead Full-Stack Engineer (React Router 7 + Supabase)"
];
var LEGACY_MOCK_EVENT_SLUGS = [
  "manual-admin-opportunity-test-2026"
];
async function purgeLegacyMockRowsIfNeeded(client) {
  if (hasPurgedLegacyMockRows || !client) return;
  hasPurgedLegacyMockRows = true;
  try {
    await client.from("startups").delete().in("slug", LEGACY_MOCK_STARTUP_SLUGS);
  } catch {
  }
  try {
    await client.from("jobs").delete().in("title", LEGACY_MOCK_JOB_TITLES);
  } catch {
  }
  try {
    const { data: mockEvents } = await client.from("events").select("id, linked_post_id").in("slug", LEGACY_MOCK_EVENT_SLUGS);
    if (mockEvents && mockEvents.length > 0) {
      const linkedPostIds = mockEvents.map((e) => e.linked_post_id).filter(Boolean);
      await client.from("events").delete().in("slug", LEGACY_MOCK_EVENT_SLUGS);
      if (linkedPostIds.length > 0) {
        await client.from("posts").delete().in("id", linkedPostIds);
      }
    }
    await client.from("posts").delete().in("slug", LEGACY_MOCK_EVENT_SLUGS);
  } catch {
  }
}
function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    db: { schema: "startupcreme" },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
async function resolveRequestUser(req) {
  if (req.user?.id) {
    const serverUser = req.user;
    const trustedRole = serverUser.role === "admin" ? "admin" : "user";
    return {
      id: String(serverUser.id),
      role: trustedRole,
      email: serverUser.email ? String(serverUser.email) : void 0
    };
  }
  const authHeader = req.headers.authorization;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (authHeader && authHeader.startsWith("Bearer ") && supabaseUrl && (anonKey || serviceRoleKey)) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const {
          data: { user },
          error
        } = await authClient.auth.getUser(token);
        if (!error && user && user.id) {
          let role = "user";
          const adminClient = getSupabaseAdminClient();
          if (adminClient && serviceRoleKey) {
            try {
              const { data: dbUser, error: dbError } = await adminClient.from("users").select("role").eq("id", user.id).maybeSingle();
              if (!dbError && dbUser?.role && String(dbUser.role).trim().toLowerCase() === "admin") {
                role = "admin";
              }
            } catch {
              role = "user";
            }
          }
          return { id: user.id, role, email: user.email };
        }
      } catch {
      }
    }
  }
  const fallbackUserId = req.body?.submitted_by || req.body?.userId || req.headers["x-user-id"];
  if (fallbackUserId && typeof fallbackUserId === "string" && fallbackUserId.trim().length > 0) {
    const cleanId = fallbackUserId.trim();
    return { id: cleanId, role: "user" };
  }
  return null;
}
async function requireRouteAdminAuth(req, res) {
  const reqUser = await resolveRequestUser(req);
  if (!reqUser || reqUser.role !== "admin") {
    res.status(403).json({
      error: "Forbidden: Admin privileges required for this action.",
      code: "ADMIN_PRIVILEGES_REQUIRED"
    });
    return null;
  }
  return reqUser;
}
expansionRouter.get(["/directory", "/startups"], async (req, res) => {
  const stageFilter = req.query.stage || "";
  const verticalFilter = req.query.vertical || "";
  const includePending = req.query.includePending === "true";
  const client = getSupabaseAdminClient();
  if (client) {
    await purgeLegacyMockRowsIfNeeded(client);
    try {
      let query = client.from("startups").select("*").order("created_at", { ascending: false });
      if (!includePending) {
        query = query.eq("is_approved", true);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        runtimeStartups = data.filter(
          (s) => !LEGACY_MOCK_STARTUP_SLUGS.includes(s.slug)
        );
      }
    } catch {
    }
  }
  let results = runtimeStartups.filter(
    (s) => !LEGACY_MOCK_STARTUP_SLUGS.includes(s.slug) && (includePending || s.is_approved)
  );
  if (stageFilter && stageFilter !== "all") {
    results = results.filter((s) => s.stage === stageFilter);
  }
  if (verticalFilter && verticalFilter !== "all") {
    const normFilter = verticalFilter.toLowerCase().replace(/[^a-z0-9]/g, "");
    results = results.filter(
      (s) => s.vertical.toLowerCase().replace(/[^a-z0-9]/g, "") === normFilter
    );
  }
  return res.json({
    startups: results,
    total: results.length
  });
});
expansionRouter.post(["/directory", "/startups"], async (req, res) => {
  const reqUser = await resolveRequestUser(req);
  if (!reqUser) {
    return res.status(401).json({
      error: "Authentication required. Only signed-in users can submit a startup."
    });
  }
  const {
    name,
    tagline,
    description,
    website_url,
    logo_url,
    stage = "mvp",
    vertical = "FinTech",
    tech_stack = []
  } = req.body || {};
  if (!name || !tagline || !description || !website_url) {
    return res.status(400).json({
      error: "Missing required fields: name, tagline, description, and website_url are required."
    });
  }
  const cleanSlug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).substring(2, 6);
  const isApproved = reqUser.role === "admin";
  const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reqUser.id) ? reqUser.id : null;
  const newStartup = {
    id: `st-${Date.now()}`,
    name: String(name).trim(),
    slug: cleanSlug,
    tagline: String(tagline).trim(),
    description: String(description).trim(),
    website_url: String(website_url).trim(),
    logo_url: logo_url ? String(logo_url).trim() : null,
    stage: ["idea", "mvp", "seed", "series_a", "bootstrapped"].includes(stage) ? stage : "mvp",
    vertical: String(vertical).trim() || "FinTech",
    tech_stack: Array.isArray(tech_stack) ? tech_stack.map((t) => String(t).trim()).filter(Boolean) : String(tech_stack).split(",").map((t) => t.trim()).filter(Boolean),
    submitted_by: validUuid,
    is_approved: isApproved,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client.from("startups").insert({
        name: newStartup.name,
        slug: newStartup.slug,
        tagline: newStartup.tagline,
        description: newStartup.description,
        website_url: newStartup.website_url,
        logo_url: newStartup.logo_url,
        stage: newStartup.stage,
        vertical: newStartup.vertical,
        tech_stack: newStartup.tech_stack,
        submitted_by: newStartup.submitted_by,
        is_approved: isApproved
      }).select("*").single();
      if (!error && data) {
        runtimeStartups = [data, ...runtimeStartups];
        return res.status(201).json({ success: true, startup: data, persisted: "supabase" });
      }
    } catch {
    }
  }
  runtimeStartups = [newStartup, ...runtimeStartups];
  return res.status(201).json({ success: true, startup: newStartup, persisted: "memory" });
});
expansionRouter.patch(["/directory/:id/approve", "/startups/:id/approve"], async (req, res) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;
  const { id } = req.params;
  const { is_approved = true } = req.body || {};
  runtimeStartups = runtimeStartups.map(
    (s) => s.id === id || s.slug === id ? { ...s, is_approved: Boolean(is_approved) } : s
  );
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client.from("startups").update({ is_approved: Boolean(is_approved) }).eq("id", id).select("*").maybeSingle();
      if (!error && data) {
        runtimeStartups = runtimeStartups.map((s) => s.id === id ? data : s);
        return res.json({ success: true, startup: data });
      }
    } catch {
    }
  }
  const updated = runtimeStartups.find((s) => s.id === id || s.slug === id);
  return res.json({ success: true, startup: updated });
});
expansionRouter.delete(["/directory/:id", "/startups/:id"], async (req, res) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;
  const { id } = req.params;
  runtimeStartups = runtimeStartups.filter((s) => s.id !== id && s.slug !== id);
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      await client.from("startups").delete().eq("id", id);
    } catch {
    }
  }
  return res.json({ success: true, deletedId: id });
});
function isMarketsFeatureEnabled() {
  const raw = String(process.env.ENABLE_MARKETS ?? process.env.VITE_ENABLE_MARKETS ?? "true").trim().toLowerCase().replace(/^["']|["']$/g, "");
  return !(raw === "false" || raw === "0" || raw === "no" || raw === "off");
}
expansionRouter.get(["/markets/rates", "/rates", "/markets"], async (req, res) => {
  if (!isMarketsFeatureEnabled()) {
    return res.status(404).json({ error: "Not found" });
  }
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client.from("rate_snapshots").select("*").order("recorded_at", { ascending: false }).limit(1).maybeSingle();
      if (!error && data) {
        runtimeRateSnapshot = {
          id: data.id,
          source: data.source || "supabase_cached_snapshot",
          recorded_at: data.recorded_at || data.created_at,
          central_bank_rates: Array.isArray(data.central_bank_rates) && data.central_bank_rates.length > 0 ? data.central_bank_rates : INITIAL_CENTRAL_BANK_RATES,
          cloud_pricing_index: Array.isArray(data.cloud_pricing_index) && data.cloud_pricing_index.length > 0 ? data.cloud_pricing_index : INITIAL_CLOUD_PRICING_INDEX
        };
      }
    } catch {
    }
  }
  return res.json(runtimeRateSnapshot);
});
expansionRouter.post(
  ["/webhooks/n8n/rates", "/markets/rates/webhook", "/markets/rates/sync"],
  async (req, res) => {
    if (!isMarketsFeatureEnabled()) {
      return res.status(404).json({ error: "Not found" });
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Missing or invalid Authorization Bearer header matching STARTUPCREME_AUTOMATION_SECRET.",
        code: "UNAUTHORIZED_RATES_WEBHOOK"
      });
    }
    const providedToken = authHeader.slice(7).trim();
    if (!providedToken) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Empty Bearer token provided.",
        code: "UNAUTHORIZED_RATES_WEBHOOK"
      });
    }
    const rawSecret = process.env.STARTUPCREME_AUTOMATION_SECRET?.trim();
    const configuredSecret = rawSecret && rawSecret !== "your_m2m_automation_secret_key" ? rawSecret : "";
    if (!configuredSecret) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Automation secret is not configured on the server. Access denied.",
        code: "UNAUTHORIZED_RATES_WEBHOOK"
      });
    }
    if (!timingSafeCheck(providedToken, configuredSecret)) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Invalid automation secret token.",
        code: "UNAUTHORIZED_RATES_WEBHOOK"
      });
    }
    const {
      source = "n8n_webhook_job",
      central_bank_rates,
      cloud_pricing_index,
      metadata = {}
    } = req.body || {};
    const updatedCentralBanks = Array.isArray(central_bank_rates) && central_bank_rates.length > 0 ? central_bank_rates : runtimeRateSnapshot.central_bank_rates;
    const updatedCloudPricing = Array.isArray(cloud_pricing_index) && cloud_pricing_index.length > 0 ? cloud_pricing_index : runtimeRateSnapshot.cloud_pricing_index;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const nextSnapshot = {
      id: `snap-${Date.now()}`,
      source: String(source),
      recorded_at: nowIso,
      central_bank_rates: updatedCentralBanks,
      cloud_pricing_index: updatedCloudPricing
    };
    runtimeRateSnapshot = nextSnapshot;
    const client = getSupabaseAdminClient();
    if (client) {
      try {
        const { data, error } = await client.from("rate_snapshots").insert({
          snapshot_type: "combined",
          source: nextSnapshot.source,
          central_bank_rates: nextSnapshot.central_bank_rates,
          cloud_pricing_index: nextSnapshot.cloud_pricing_index,
          metadata,
          recorded_at: nowIso
        }).select("*").single();
        if (!error && data) {
          runtimeRateSnapshot.id = data.id;
          return res.status(201).json({
            success: true,
            persisted: "supabase",
            snapshot: runtimeRateSnapshot
          });
        }
      } catch {
      }
    }
    return res.status(200).json({
      success: true,
      persisted: "memory",
      snapshot: runtimeRateSnapshot
    });
  }
);
expansionRouter.get(["/careers", "/jobs"], async (req, res) => {
  const categoryFilter = req.query.category || "";
  const jobTypeFilter = req.query.job_type || "";
  const includePending = req.query.includePending === "true";
  const client = getSupabaseAdminClient();
  if (client) {
    await purgeLegacyMockRowsIfNeeded(client);
    try {
      let query = client.from("jobs").select("*").order("created_at", { ascending: false });
      if (!includePending) {
        query = query.eq("is_active", true);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        runtimeJobs = data.filter(
          (j) => !LEGACY_MOCK_JOB_TITLES.includes(j.title)
        );
      }
    } catch {
    }
  }
  let results = runtimeJobs.filter(
    (j) => !LEGACY_MOCK_JOB_TITLES.includes(j.title) && (includePending || j.is_active)
  );
  if (categoryFilter && categoryFilter !== "all") {
    results = results.filter((j) => j.category.toLowerCase() === categoryFilter.toLowerCase());
  }
  if (jobTypeFilter && jobTypeFilter !== "all") {
    results = results.filter((j) => j.job_type.toLowerCase() === jobTypeFilter.toLowerCase());
  }
  return res.json({
    jobs: results,
    total: results.length
  });
});
expansionRouter.post(["/careers", "/jobs"], async (req, res) => {
  const reqUser = await resolveRequestUser(req);
  if (!reqUser) {
    return res.status(401).json({
      error: "Authentication required. Only signed-in users can post a job."
    });
  }
  const {
    title,
    company_name,
    company_logo,
    location = "Remote (Global)",
    job_type = "Full-time",
    category = "Engineering",
    apply_url,
    salary_range
  } = req.body || {};
  if (!title || !company_name || !apply_url) {
    return res.status(400).json({
      error: "Missing required fields: title, company_name, and apply_url are required."
    });
  }
  const isActive = reqUser.role === "admin";
  const newJob = {
    id: `job-${Date.now()}`,
    title: String(title).trim(),
    company_name: String(company_name).trim(),
    company_logo: company_logo ? String(company_logo).trim() : null,
    location: String(location).trim() || "Remote (Global)",
    job_type: String(job_type).trim() || "Full-time",
    category: String(category).trim() || "Engineering",
    apply_url: String(apply_url).trim(),
    salary_range: salary_range ? String(salary_range).trim() : null,
    is_active: isActive,
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client.from("jobs").insert({
        title: newJob.title,
        company_name: newJob.company_name,
        company_logo: newJob.company_logo,
        location: newJob.location,
        job_type: newJob.job_type,
        category: newJob.category,
        apply_url: newJob.apply_url,
        salary_range: newJob.salary_range,
        is_active: isActive
      }).select("*").single();
      if (!error && data) {
        runtimeJobs = [data, ...runtimeJobs];
        return res.status(201).json({ success: true, job: data, persisted: "supabase" });
      }
    } catch {
    }
  }
  runtimeJobs = [newJob, ...runtimeJobs];
  return res.status(201).json({ success: true, job: newJob, persisted: "memory" });
});
expansionRouter.patch(["/careers/:id/approve", "/jobs/:id/approve"], async (req, res) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;
  const { id } = req.params;
  const { is_active = true } = req.body || {};
  runtimeJobs = runtimeJobs.map(
    (j) => j.id === id ? { ...j, is_active: Boolean(is_active) } : j
  );
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client.from("jobs").update({ is_active: Boolean(is_active) }).eq("id", id).select("*").maybeSingle();
      if (!error && data) {
        runtimeJobs = runtimeJobs.map((j) => j.id === id ? data : j);
        return res.json({ success: true, job: data });
      }
    } catch {
    }
  }
  const updated = runtimeJobs.find((j) => j.id === id);
  return res.json({ success: true, job: updated });
});
expansionRouter.delete(["/careers/:id", "/jobs/:id"], async (req, res) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;
  const { id } = req.params;
  runtimeJobs = runtimeJobs.filter((j) => j.id !== id);
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      await client.from("jobs").delete().eq("id", id);
    } catch {
    }
  }
  return res.json({ success: true, deletedId: id });
});
function timingSafeCheck(provided, secret) {
  if (!provided || !secret) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
function isAuthorizedWebhookToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return false;
  const rawSecret = process.env.STARTUPCREME_AUTOMATION_SECRET?.trim();
  if (!rawSecret || rawSecret === "your_m2m_automation_secret_key") {
    return false;
  }
  return timingSafeCheck(token, rawSecret);
}
expansionRouter.post("/events/webhook", async (req, res) => {
  const isWebhookAuthorized = isAuthorizedWebhookToken(req);
  let isAdminAuthorized = false;
  if (!isWebhookAuthorized) {
    const reqUser = await resolveRequestUser(req);
    if (reqUser && reqUser.role === "admin") {
      isAdminAuthorized = true;
    }
  }
  if (!isWebhookAuthorized && !isAdminAuthorized) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Missing or invalid Bearer token. Please provide a valid Authorization: Bearer <token> matching STARTUPCREME_AUTOMATION_SECRET, or authenticate with an admin session."
    });
  }
  const rawBody = req.body || {};
  const rawTitle = String(rawBody.title || rawBody.event_title || "").trim();
  const rawEventTitle = String(rawBody.event_title || rawBody.title || "").trim();
  let candidateSlug = String(rawBody.slug || "").trim();
  if (!candidateSlug && (rawTitle || rawEventTitle)) {
    candidateSlug = (rawTitle || rawEventTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  const candidatePayload = {
    ...rawBody,
    title: rawTitle || void 0,
    event_title: rawEventTitle || void 0,
    slug: candidateSlug || void 0
  };
  const validationResult = EventWebhookIngestionSchema.safeParse(candidatePayload);
  if (!validationResult.success) {
    return res.status(400).json({
      success: false,
      error: "Payload validation failed",
      issues: validationResult.error.issues,
      message: validationResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    });
  }
  const validated = validationResult.data;
  const effectiveTitle = (validated.title || validated.event_title).trim();
  const effectiveEventTitle = (validated.event_title || validated.title).trim();
  const normSlug = validated.slug || candidateSlug;
  const normVertical = validated.vertical;
  const normLocale = validated.locale;
  const cleanAppUrl = validated.application_url;
  const rawContent = validated.content || validated.description || effectiveTitle;
  const description = (validated.description || validated.excerpt || effectiveTitle).trim();
  const resolvedStatus = rawBody.status === "published" ? "published" : "draft";
  let jsonbContent;
  if (typeof rawContent === "string") {
    try {
      jsonbContent = JSON.parse(rawContent);
    } catch {
      jsonbContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: rawContent }]
          }
        ]
      };
    }
  } else if (rawContent && typeof rawContent === "object") {
    jsonbContent = rawContent;
  } else {
    jsonbContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: effectiveTitle }]
        }
      ]
    };
  }
  const client = getSupabaseAdminClient();
  let existingPost = null;
  let existingEvent = null;
  try {
    if (client) {
      const postsTable = client.schema ? client.schema("startupcreme").from("posts") : client.from("posts");
      const eventsTable = client.schema ? client.schema("startupcreme").from("events") : client.from("events");
      const { data: foundPost } = await postsTable.select("id, title, excerpt, content, status, locale, vertical, slug").eq("locale", normLocale).eq("vertical", normVertical).eq("slug", normSlug).maybeSingle();
      if (foundPost) existingPost = foundPost;
      const { data: foundEvent } = await eventsTable.select("id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id").or(`application_url.eq.${cleanAppUrl},slug.eq.${normSlug}`).maybeSingle();
      if (foundEvent) existingEvent = foundEvent;
      if (!existingPost && existingEvent?.linked_post_id) {
        const { data: linkedP } = await postsTable.select("id, title, excerpt, content, status, locale, vertical, slug").eq("id", existingEvent.linked_post_id).maybeSingle();
        if (linkedP) existingPost = linkedP;
      }
    } else {
      existingEvent = runtimeEvents.find(
        (e) => e.application_url === cleanAppUrl || e.slug === normSlug
      );
      if (existingEvent?.linked_post) {
        existingPost = existingEvent.linked_post;
      }
    }
    if (existingPost && existingPost.status === "published") {
      return res.status(200).json({
        success: true,
        deduplicated: true,
        message: "Target post is already published. No mutations applied.",
        data: {
          post_id: existingPost.id,
          event_id: existingEvent?.id || null,
          status: existingPost.status
        }
      });
    }
    if (existingEvent && existingEvent.linked_post?.status === "published") {
      return res.status(200).json({
        success: true,
        deduplicated: true,
        message: "Target event and linked post are already published. No mutations applied.",
        data: {
          post_id: existingEvent.linked_post_id || existingEvent.linked_post?.id,
          event_id: existingEvent.id,
          status: "published"
        }
      });
    }
    let linkedPostId;
    if (existingPost) {
      linkedPostId = existingPost.id;
    } else {
      const postRow = {
        locale: normLocale,
        vertical: normVertical,
        slug: normSlug,
        title: effectiveTitle,
        excerpt: validated.excerpt ? validated.excerpt.trim() : description.slice(0, 240),
        content: jsonbContent,
        status: resolvedStatus,
        meta_description: validated.meta_description ? validated.meta_description.trim() : (validated.excerpt || description).slice(0, 160),
        canonical_url: validated.canonical_url ? validated.canonical_url.trim() : null,
        cover_image: validated.cover_image ? validated.cover_image.trim() : null,
        source_url: validated.source_url ? validated.source_url.trim() : null,
        source_name: validated.source_name ? validated.source_name.trim() : null,
        ai_generated: Boolean(validated.ai_generated),
        hide_ai_disclosure: Boolean(validated.hide_ai_disclosure),
        author_name: validated.author_name || "Startup Cr\xE8me Editorial",
        author_role: validated.author_role || "Principal Editor",
        author_avatar: validated.author_avatar || null,
        dual_silo: normVertical === "founders-mindset" ? false : Boolean(validated.dual_silo),
        silo_badge: validated.silo_badge || null,
        tags: validated.tags || [],
        reading_time_minutes: validated.reading_time_minutes || 5,
        word_count: validated.word_count || 800,
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (client) {
        const postsTable = client.schema ? client.schema("startupcreme").from("posts") : client.from("posts");
        let insertPostRes = await postsTable.insert(postRow).select("id, status").single();
        if (insertPostRes.error && (insertPostRes.error.code === "PGRST204" || String(insertPostRes.error.message || "").includes("column"))) {
          const { source_url, source_name, ai_generated, hide_ai_disclosure, ...legacyPostRow } = postRow;
          insertPostRes = await postsTable.insert(legacyPostRow).select("id, status").single();
        }
        if (insertPostRes.error && insertPostRes.error.code === "22P02" && String(insertPostRes.error.message || "").includes("vertical")) {
          const { source_url, source_name, ai_generated, hide_ai_disclosure, ...legacyPostRow } = postRow;
          insertPostRes = await postsTable.insert({ ...legacyPostRow, vertical: "tech" }).select("id, status").single();
        }
        if (insertPostRes.error) throw insertPostRes.error;
        linkedPostId = insertPostRes.data.id;
      } else {
        linkedPostId = `post-${Date.now()}`;
      }
    }
    let eventId;
    const eventRow = {
      title: effectiveEventTitle,
      slug: normSlug,
      description,
      opportunity_type: validated.opportunity_type,
      funding_amount: validated.funding_amount ? validated.funding_amount.trim() : null,
      location: (validated.location || "Global (Remote)").trim(),
      deadline_date: new Date(validated.deadline_date).toISOString(),
      application_url: cleanAppUrl,
      linked_post_id: linkedPostId
    };
    if (client) {
      const eventsTable = client.schema ? client.schema("startupcreme").from("events") : client.from("events");
      if (existingEvent) {
        eventId = existingEvent.id;
        if (!existingEvent.linked_post_id) {
          await eventsTable.update({ linked_post_id: linkedPostId }).eq("id", existingEvent.id);
        }
      } else {
        let insertRes = await eventsTable.insert(eventRow).select("id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at").maybeSingle();
        if (insertRes.error && insertRes.error.code === "22P02" && String(insertRes.error.message || "").includes("opportunity_type")) {
          const fallbackOpp = validated.opportunity_type === "fellowship" ? "grant" : "accelerator";
          insertRes = await eventsTable.insert({ ...eventRow, opportunity_type: fallbackOpp }).select("id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at").maybeSingle();
        }
        if (insertRes.error && String(insertRes.error.message || "").includes("events_slug_key")) {
          const fallbackRow = { ...eventRow, slug: `${normSlug}-${Date.now().toString(36)}` };
          insertRes = await eventsTable.insert(fallbackRow).select("id, title, slug, application_url, opportunity_type, funding_amount, location, deadline_date, linked_post_id, created_at").single();
        }
        if (insertRes.error) throw insertRes.error;
        eventId = insertRes.data?.id || `event-${Date.now()}`;
      }
    } else {
      eventId = existingEvent?.id || `event-${Date.now()}`;
    }
    const linkedPostSnapshot = {
      id: linkedPostId,
      locale: normLocale,
      vertical: normVertical,
      slug: normSlug,
      title: effectiveTitle,
      status: existingPost?.status || resolvedStatus,
      canonical_url: existingPost?.canonical_url || (validated.canonical_url ? validated.canonical_url.trim() : null),
      source_name: existingPost?.source_name || (validated.source_name ? validated.source_name.trim() : null),
      source_url: existingPost?.source_url || (validated.source_url ? validated.source_url.trim() : null),
      ai_generated: existingPost?.ai_generated !== void 0 ? Boolean(existingPost.ai_generated) : Boolean(validated.ai_generated),
      hide_ai_disclosure: existingPost?.hide_ai_disclosure !== void 0 ? Boolean(existingPost.hide_ai_disclosure) : Boolean(validated.hide_ai_disclosure)
    };
    const memoryEvent = {
      id: eventId,
      title: effectiveEventTitle,
      slug: normSlug,
      description,
      opportunity_type: validated.opportunity_type,
      funding_amount: validated.funding_amount || null,
      location: validated.location || "Global (Remote)",
      deadline_date: new Date(validated.deadline_date).toISOString(),
      application_url: cleanAppUrl,
      linked_post_id: linkedPostId,
      linked_post: linkedPostSnapshot,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    runtimeEvents = [
      memoryEvent,
      ...runtimeEvents.filter((e) => e.application_url !== cleanAppUrl && e.slug !== normSlug)
    ];
    return res.status(200).json({
      success: true,
      message: "Event and post successfully processed",
      post: linkedPostSnapshot,
      data: {
        post_id: linkedPostId,
        event_id: eventId,
        status: linkedPostSnapshot.status,
        event_title: effectiveEventTitle,
        application_url: cleanAppUrl,
        opportunity_type: validated.opportunity_type,
        funding_amount: memoryEvent.funding_amount,
        deadline_date: memoryEvent.deadline_date,
        linked_post_id: linkedPostId,
        post: linkedPostSnapshot
      }
    });
  } catch (err) {
    console.error("[Events Webhook Error]:", err);
    return res.status(500).json({
      success: false,
      error: "Database operation failed during event ingestion",
      message: err.message || "Unknown database error",
      details: err.details || err.hint || null
    });
  }
});
expansionRouter.get("/events", async (req, res) => {
  const typeFilter = req.query.type || "";
  const searchFilter = req.query.search || "";
  const mapOpportunityTypes = (raw) => {
    const tokens = raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    const result = [];
    for (const token of tokens) {
      if (token === "accelerator") {
        result.push("accelerator", "incubator");
      } else if (token === "pitch_competition") {
        result.push("pitch_competition", "hackathon");
      } else {
        result.push(token);
      }
    }
    return Array.from(new Set(result));
  };
  const client = getSupabaseAdminClient();
  const types = typeFilter && typeFilter !== "all" ? mapOpportunityTypes(typeFilter) : [];
  if (client) {
    await purgeLegacyMockRowsIfNeeded(client);
    try {
      let query = client.from("events").select("*, linked_post:posts!inner(*)").eq("linked_post.status", "published").order("deadline_date", { ascending: true });
      if (types.length === 1) {
        query = query.eq("opportunity_type", types[0]);
      } else if (types.length > 1) {
        query = query.in("opportunity_type", types);
      }
      if (searchFilter) {
        query = query.or(
          `title.ilike.%${searchFilter}%,description.ilike.%${searchFilter}%,location.ilike.%${searchFilter}%`
        );
      }
      let { data, error } = await query;
      if (error && error.code === "22P02" && types.length > 0) {
        const baseline = types.filter(
          (t) => ["grant", "accelerator", "pitch_competition", "conference"].includes(t)
        );
        if (baseline.length > 0) {
          let retryQ = client.from("events").select("*, linked_post:posts!inner(*)").eq("linked_post.status", "published").order("deadline_date", { ascending: true });
          if (baseline.length === 1) {
            retryQ = retryQ.eq("opportunity_type", baseline[0]);
          } else {
            retryQ = retryQ.in("opportunity_type", baseline);
          }
          const retryRes = await retryQ;
          if (!retryRes.error && Array.isArray(retryRes.data)) {
            data = retryRes.data;
            error = null;
          }
        }
      }
      if (!error && Array.isArray(data)) {
        const dbSlugs = new Set(data.map((d) => d.slug));
        const matchingMemory = runtimeEvents.filter((m) => {
          if (dbSlugs.has(m.slug)) return false;
          if (m.linked_post?.status !== "published") return false;
          if (types.length > 0) {
            return types.includes(String(m.opportunity_type || "").toLowerCase());
          }
          return true;
        });
        const combined = [...data, ...matchingMemory];
        return res.json({ success: true, count: combined.length, events: combined });
      }
    } catch {
    }
  }
  let filtered = runtimeEvents.filter((e) => e.linked_post?.status === "published");
  if (types.length > 0) {
    filtered = filtered.filter(
      (e) => types.includes(String(e.opportunity_type || "").toLowerCase())
    );
  }
  if (searchFilter) {
    const q = searchFilter.toLowerCase();
    filtered = filtered.filter(
      (e) => e.title.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.location.toLowerCase().includes(q)
    );
  }
  return res.json({ success: true, count: filtered.length, events: filtered });
});
expansionRouter.get("/events/:slug", async (req, res) => {
  const { slug } = req.params;
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data, error } = await client.from("events").select("*, linked_post:posts!inner(*)").eq("slug", slug).eq("linked_post.status", "published").maybeSingle();
      if (!error && data) {
        return res.json({ success: true, event: data });
      }
    } catch {
    }
  }
  const found = runtimeEvents.find(
    (e) => e.slug === slug && e.linked_post?.status === "published"
  );
  if (found) {
    return res.json({ success: true, event: found });
  }
  return res.status(404).json({ error: "Event not found" });
});
expansionRouter.delete("/events/:id", async (req, res) => {
  const adminUser = await requireRouteAdminAuth(req, res);
  if (!adminUser) return;
  const { id } = req.params;
  const existingMemory = runtimeEvents.find((e) => e.id === id);
  const memoryLinkedPostId = existingMemory?.linked_post_id;
  runtimeEvents = runtimeEvents.filter((e) => e.id !== id);
  const client = getSupabaseAdminClient();
  if (client) {
    try {
      const { data: dbEvent } = await client.from("events").select("id, linked_post_id").eq("id", id).maybeSingle();
      const linkedPostId = dbEvent?.linked_post_id || memoryLinkedPostId;
      await client.from("events").delete().eq("id", id);
      if (linkedPostId) {
        await client.from("posts").delete().eq("id", linkedPostId);
      }
    } catch {
    }
  }
  return res.json({ success: true, deletedId: id });
});

// src/server/editorialRouter.ts
import { Router as Router2 } from "express";
import crypto2 from "crypto";
import { createClient as createClient2 } from "@supabase/supabase-js";
var editorialRouter = Router2();
var memoryIdempotencyStore = /* @__PURE__ */ new Map();
var inFlightRequests = /* @__PURE__ */ new Map();
function secureCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto2.timingSafeEqual(bufA, bufB);
}
function computeRequestFingerprint(payload) {
  const contentStr = typeof payload.content === "object" ? JSON.stringify(payload.content) : String(payload.content || "").trim();
  const canonicalString = [
    payload.locale.toLowerCase().trim(),
    payload.vertical.toLowerCase().trim(),
    payload.slug.toLowerCase().trim(),
    payload.title.trim(),
    (payload.excerpt || "").trim(),
    contentStr
  ].join(":::");
  return crypto2.createHash("sha256").update(canonicalString).digest("hex");
}
function getSupabaseServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.includes("placeholder")) {
    return null;
  }
  return createClient2(supabaseUrl, serviceRoleKey, {
    db: { schema: "startupcreme" },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
function requireEditorialAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const customHeader = req.headers["x-editorial-secret"];
  let providedToken = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedToken = authHeader.slice(7).trim();
  } else if (customHeader) {
    providedToken = customHeader.trim();
  }
  if (!providedToken) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Missing Authorization Bearer token matching N8N_EDITORIAL_SECRET.",
      code: "UNAUTHORIZED_EDITORIAL"
    });
  }
  if (providedToken === "startupcreme-n8n-events-secret-2026") {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: The legacy events secret cannot be used for editorial draft submissions.",
      code: "UNAUTHORIZED_EDITORIAL"
    });
  }
  const rawConfiguredSecret = process.env.N8N_EDITORIAL_SECRET?.trim();
  const configuredSecret = rawConfiguredSecret && rawConfiguredSecret !== "your_n8n_editorial_secret_key" ? rawConfiguredSecret : "";
  if (!configuredSecret) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Editorial webhook secret is not configured on the server. Access denied.",
      code: "UNAUTHORIZED_EDITORIAL"
    });
  }
  if (!secureCompare(providedToken, configuredSecret)) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Invalid editorial token.",
      code: "UNAUTHORIZED_EDITORIAL"
    });
  }
  next();
}
editorialRouter.post("/drafts", requireEditorialAuth, async (req, res) => {
  if (req.body && "status" in req.body) {
    return res.status(400).json({
      success: false,
      error: "Forbidden: External workflows cannot specify or override publication status. All submissions must be drafts.",
      code: "STATUS_OVERRIDE_FORBIDDEN"
    });
  }
  const parseResult = EditorialDraftSubmissionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: "Validation failed: Invalid article payload.",
      code: "VALIDATION_ERROR",
      details: parseResult.error.flatten()
    });
  }
  const payload = parseResult.data;
  const idempotencyKey = req.headers["idempotency-key"]?.trim() || req.headers["x-idempotency-key"]?.trim() || payload.idempotency_key;
  const workflowId = req.headers["x-workflow-id"]?.trim() || payload.workflow_id;
  const currentFingerprint = computeRequestFingerprint({
    slug: payload.slug,
    vertical: payload.vertical,
    locale: payload.locale,
    title: payload.title,
    content: payload.content,
    excerpt: payload.excerpt
  });
  let calculatedWordCount = payload.word_count;
  if (!calculatedWordCount) {
    const rawText = typeof payload.content === "string" ? payload.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : JSON.stringify(payload.content);
    calculatedWordCount = Math.max(1, rawText.split(/\s+/).filter(Boolean).length);
  }
  const calculatedReadingTime = payload.reading_time_minutes || Math.max(1, Math.ceil(calculatedWordCount / 200));
  let jsonbContent;
  if (typeof payload.content === "string") {
    try {
      jsonbContent = JSON.parse(payload.content);
    } catch {
      jsonbContent = payload.content;
    }
  } else {
    jsonbContent = payload.content;
  }
  const lockKey = `${payload.locale}::${payload.vertical}::${payload.slug}`;
  if (inFlightRequests.has(lockKey)) {
    try {
      await inFlightRequests.get(lockKey);
    } catch {
    }
  }
  let resolveLock = () => {
  };
  const lockPromise = new Promise((resolve) => {
    resolveLock = resolve;
  });
  inFlightRequests.set(lockKey, lockPromise);
  try {
    const supabase = getSupabaseServiceClient();
    let existingIdempotency = null;
    if (idempotencyKey) {
      existingIdempotency = memoryIdempotencyStore.get(idempotencyKey) || null;
      if (!existingIdempotency && supabase) {
        try {
          const { data, error } = await supabase.from("editorial_idempotency").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
          if (!error && data) {
            existingIdempotency = data;
            memoryIdempotencyStore.set(idempotencyKey, existingIdempotency);
          }
        } catch {
        }
      }
    }
    if (existingIdempotency) {
      if (existingIdempotency.request_fingerprint !== currentFingerprint) {
        return res.status(409).json({
          success: false,
          error: `Conflict: Idempotency key '${idempotencyKey}' was already used with a different article payload.`,
          code: "IDEMPOTENCY_PAYLOAD_MISMATCH"
        });
      }
      let replayedPost = null;
      if (supabase) {
        try {
          const { data } = await supabase.from("posts").select("id, slug, vertical, locale, title, status, word_count, reading_time_minutes, created_at, updated_at").eq("id", existingIdempotency.post_id).maybeSingle();
          if (data) replayedPost = data;
        } catch {
        }
      }
      const host2 = req.get("x-forwarded-host") || req.get("host") || "www.startupcreme.com";
      const protocol2 = req.get("x-forwarded-proto") || req.protocol || "https";
      const baseUrl2 = `${protocol2}://${host2}`;
      return res.status(200).json({
        success: true,
        action: "replayed",
        post: replayedPost || {
          id: existingIdempotency.post_id,
          slug: existingIdempotency.slug,
          vertical: existingIdempotency.vertical,
          locale: existingIdempotency.locale,
          title: payload.title,
          status: "draft"
        },
        editorial_urls: {
          cms_editor_url: `${baseUrl2}/admin?tab=posts&edit=${encodeURIComponent(payload.slug)}`
        },
        idempotency: {
          key: idempotencyKey,
          replayed: true
        }
      });
    }
    if (supabase) {
      try {
        const { data: existingPost, error: postLookupError } = await supabase.from("posts").select("id, slug, vertical, locale, title, status, updated_at").eq("locale", payload.locale).eq("vertical", payload.vertical).eq("slug", payload.slug).maybeSingle();
        if (!postLookupError && existingPost) {
          if (existingPost.status === "published") {
            return res.status(409).json({
              success: false,
              error: `Conflict: An article with slug '${payload.slug}' is already published in the ${payload.vertical} vertical. Automated workflows cannot modify or overwrite published articles.`,
              code: "PUBLISHED_ARTICLE_COLLISION",
              existing_article: {
                id: existingPost.id,
                slug: existingPost.slug,
                vertical: existingPost.vertical,
                status: existingPost.status
              }
            });
          }
          return res.status(409).json({
            success: false,
            error: `Conflict: A draft with slug '${payload.slug}' already exists in the ${payload.vertical} vertical. To protect editorial revisions, existing drafts cannot be overwritten.`,
            code: "DRAFT_COLLISION",
            existing_draft: {
              id: existingPost.id,
              slug: existingPost.slug,
              vertical: existingPost.vertical,
              status: existingPost.status,
              updated_at: existingPost.updated_at
            }
          });
        }
      } catch (err) {
        console.error("[EditorialRouter] Error checking post collision:", err);
        return res.status(500).json({
          success: false,
          error: "Internal error checking post availability.",
          code: "DATABASE_ERROR"
        });
      }
    }
    const newPostId = crypto2.randomUUID();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const postRow = {
      id: newPostId,
      slug: payload.slug,
      locale: payload.locale,
      vertical: payload.vertical,
      title: payload.title,
      excerpt: payload.excerpt || payload.meta_description || payload.title.slice(0, 240),
      content: jsonbContent,
      status: "draft",
      // Strictly hardcoded server-side
      meta_description: payload.meta_description || payload.excerpt || payload.title.slice(0, 160),
      canonical_url: payload.canonical_url || null,
      cover_image: payload.cover_image || null,
      source_url: payload.source_url || null,
      source_name: payload.source_name || null,
      ai_generated: Boolean(payload.ai_generated),
      hide_ai_disclosure: Boolean(payload.hide_ai_disclosure),
      author_name: payload.author_name || "Startup Cr\xE8me Editorial",
      author_role: payload.author_role || "Senior Analyst",
      author_avatar: payload.author_avatar || null,
      dual_silo: payload.vertical === "founders-mindset" ? false : payload.dual_silo || false,
      silo_badge: payload.vertical === "founders-mindset" ? null : payload.dual_silo ? "Dual Silo Analysis" : null,
      tags: payload.tags && payload.tags.length > 0 ? payload.tags : ["Editorial"],
      reading_time_minutes: calculatedReadingTime,
      word_count: calculatedWordCount,
      created_at: nowIso,
      updated_at: nowIso
    };
    let persistedInDb = false;
    let savedPost = postRow;
    if (supabase) {
      try {
        let { data: insertedPost, error: insertError } = await supabase.from("posts").insert(postRow).select("id, slug, vertical, locale, title, status, word_count, reading_time_minutes, created_at, updated_at").single();
        if (insertError && (insertError.code === "PGRST204" || String(insertError.message || "").includes("column"))) {
          const { source_url, source_name, ai_generated, hide_ai_disclosure, ...legacyPostRow } = postRow;
          const retryRes = await supabase.from("posts").insert(legacyPostRow).select("id, slug, vertical, locale, title, status, word_count, reading_time_minutes, created_at, updated_at").single();
          insertedPost = retryRes.data;
          insertError = retryRes.error;
        }
        if (insertError && insertError.code === "22P02" && String(insertError.message || "").includes("vertical")) {
          const { source_url, source_name, ai_generated, hide_ai_disclosure, ...legacyPostRow } = postRow;
          const retryRes = await supabase.from("posts").insert({ ...legacyPostRow, vertical: "tech" }).select("id, slug, vertical, locale, title, status, word_count, reading_time_minutes, created_at, updated_at").single();
          insertedPost = retryRes.data;
          insertError = retryRes.error;
        }
        if (insertError) {
          console.error("[EditorialRouter] Supabase insert error:", insertError.message);
          if (insertError.code === "23505" || insertError.message.includes("unique")) {
            return res.status(409).json({
              success: false,
              error: `Conflict: An article with slug '${payload.slug}' already exists in the ${payload.vertical} vertical.`,
              code: "DUPLICATE_SLUG"
            });
          }
          return res.status(500).json({
            success: false,
            error: "Failed to persist article draft in database.",
            code: "DATABASE_ERROR"
          });
        }
        if (insertedPost) {
          savedPost = { ...postRow, ...insertedPost };
          persistedInDb = true;
        }
      } catch (err) {
        console.error("[EditorialRouter] Database exception on post insert:", err);
        return res.status(500).json({
          success: false,
          error: "Database connection failed while creating article draft.",
          code: "DATABASE_ERROR"
        });
      }
    }
    if (idempotencyKey) {
      const record = {
        idempotency_key: idempotencyKey,
        request_fingerprint: currentFingerprint,
        post_id: savedPost.id,
        slug: savedPost.slug,
        locale: savedPost.locale,
        vertical: savedPost.vertical,
        workflow_id: workflowId,
        created_at: nowIso
      };
      memoryIdempotencyStore.set(idempotencyKey, record);
      if (supabase) {
        try {
          await supabase.from("editorial_idempotency").insert({
            idempotency_key: idempotencyKey,
            request_fingerprint: currentFingerprint,
            post_id: savedPost.id,
            workflow_id: workflowId || null,
            created_at: nowIso,
            updated_at: nowIso
          });
        } catch {
        }
      }
    }
    const host = req.get("x-forwarded-host") || req.get("host") || "www.startupcreme.com";
    const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
    const baseUrl = `${protocol}://${host}`;
    return res.status(201).json({
      success: true,
      action: "created",
      persisted: persistedInDb ? "database" : "memory",
      post: {
        id: savedPost.id,
        slug: savedPost.slug,
        vertical: savedPost.vertical,
        locale: savedPost.locale,
        title: savedPost.title,
        status: "draft",
        canonical_url: savedPost.canonical_url || null,
        source_url: savedPost.source_url || null,
        source_name: savedPost.source_name || null,
        ai_generated: Boolean(savedPost.ai_generated),
        hide_ai_disclosure: Boolean(savedPost.hide_ai_disclosure),
        word_count: savedPost.word_count,
        reading_time_minutes: savedPost.reading_time_minutes,
        created_at: savedPost.created_at,
        updated_at: savedPost.updated_at
      },
      editorial_urls: {
        cms_editor_url: `${baseUrl}/admin?tab=posts&edit=${encodeURIComponent(savedPost.slug)}`
      },
      idempotency: {
        key: idempotencyKey || null,
        replayed: false
      }
    });
  } finally {
    resolveLock();
    inFlightRequests.delete(lockKey);
  }
});

// server/meta.ts
import { createClient as createClient3 } from "@supabase/supabase-js";
var DEFAULT_TITLE = "StartupCr\xE8me | Financial & Technology Intelligence";
var DEFAULT_DESCRIPTION = "StartupCr\xE8me is the premier digital publication for Finance, Macro-economics, and Deep Technology.";
var DEFAULT_IMAGE = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630";
function ensureAbsoluteUrl(url, baseUrl, postIdentifier) {
  if (!url) return DEFAULT_IMAGE;
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_IMAGE;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    if (postIdentifier) {
      return `${baseUrl.replace(/\/+$/, "")}/api/posts/${encodeURIComponent(postIdentifier)}/cover.png`;
    }
    return DEFAULT_IMAGE;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith("/")) {
    return `${baseUrl.replace(/\/+$/, "")}${trimmed}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}
async function uploadDataUrlToR2(dataUrl, slug) {
  try {
    const r2AccountId = (process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_R2_ACCOUNT_ID || process.env.VITE_R2_ACCOUNT_ID || "").replace(/^https?:\/\//i, "").replace(/\.r2\.cloudflarestorage\.com.*$/i, "").trim();
    const r2AccessKey = (process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.CF_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY || process.env.VITE_R2_ACCESS_KEY_ID || "").trim();
    const r2Secret = (process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.CF_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_KEY || process.env.VITE_R2_SECRET_ACCESS_KEY || "").trim();
    const r2Bucket = (process.env.R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.CF_R2_BUCKET_NAME || process.env.VITE_R2_BUCKET_NAME || "startupcreme").trim();
    const r2PublicDomain = (process.env.R2_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.CF_R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || "asset.startupcreme.com").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!r2AccountId || !r2AccessKey || !r2Secret) {
      return null;
    }
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return null;
    const mimeType = match[1];
    const buffer = Buffer.from(match[2], "base64");
    let ext = "jpg";
    let outputBuffer = buffer;
    let outputMime = "image/jpeg";
    try {
      const sharp = (await import("sharp")).default;
      if (mimeType.includes("webp") || mimeType.includes("avif") || !mimeType.includes("png") && !mimeType.includes("gif")) {
        outputBuffer = await sharp(buffer).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
        ext = "jpg";
        outputMime = "image/jpeg";
      } else if (mimeType.includes("png")) {
        ext = "png";
        outputMime = "image/png";
      }
    } catch (sharpErr) {
      console.warn("[Sharp] Image conversion fallback:", sharpErr);
    }
    const cleanSlug = (slug || "article").toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 50);
    const objectKey = `articles/${Date.now()}-${cleanSlug}.${ext}`;
    const { S3Client: S3Client2, PutObjectCommand: PutObjectCommand2 } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client2({
      region: "auto",
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKey,
        secretAccessKey: r2Secret
      }
    });
    await s3.send(new PutObjectCommand2({
      Bucket: r2Bucket,
      Key: objectKey,
      Body: outputBuffer,
      ContentType: outputMime,
      CacheControl: "public, max-age=31536000, immutable"
    }));
    return `https://${r2PublicDomain}/${objectKey}`;
  } catch (err) {
    console.warn("[R2 Upload Helper] Failed to upload data URL to R2:", err);
    return null;
  }
}
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function resolveArticleDescription(post) {
  if (post.excerpt && typeof post.excerpt === "string" && post.excerpt.trim().length > 10) {
    return post.excerpt.trim();
  }
  if (post.meta_description && typeof post.meta_description === "string" && post.meta_description.trim().length > 10) {
    return post.meta_description.trim();
  }
  if (post.excerpt && typeof post.excerpt === "string" && post.excerpt.trim().length > 0) {
    return post.excerpt.trim();
  }
  if (post.meta_description && typeof post.meta_description === "string" && post.meta_description.trim().length > 0) {
    return post.meta_description.trim();
  }
  try {
    if (post.content && typeof post.content === "object" && Array.isArray(post.content.content)) {
      const texts = [];
      for (const node of post.content.content) {
        if (node.type === "paragraph" && Array.isArray(node.content)) {
          for (const child of node.content) {
            if (child.text && typeof child.text === "string") {
              texts.push(child.text.trim());
            }
          }
        }
        if (texts.join(" ").length >= 140) break;
      }
      const combined = texts.join(" ").trim();
      if (combined.length > 20) {
        return combined.length > 200 ? `${combined.substring(0, 197)}...` : combined;
      }
    }
  } catch {
  }
  return DEFAULT_DESCRIPTION;
}
async function resolvePageMetadata(reqPath, host, protocol) {
  let normalizedHost = host || "www.startupcreme.com";
  if (!normalizedHost.includes("startupcreme.com") && !normalizedHost.includes("localhost") && !normalizedHost.includes("127.0.0.1")) {
    if (normalizedHost.includes("run.app")) {
    } else {
      normalizedHost = "www.startupcreme.com";
    }
  }
  let normalizedProtocol = protocol || "https";
  if (normalizedHost.includes("startupcreme.com")) {
    normalizedProtocol = "https";
  }
  const baseUrl = `${normalizedProtocol}://${normalizedHost}`;
  const cleanPath = reqPath.split("?")[0].split("#")[0];
  const fullUrl = `${baseUrl}${cleanPath.startsWith("/") ? cleanPath : "/" + cleanPath}`;
  const segments = cleanPath.split("/").filter(Boolean);
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  let coverImage = DEFAULT_IMAGE;
  let pageType = "website";
  let authorName;
  let publishedTime;
  let modifiedTime;
  let section;
  let tags;
  let ssrPayloadScript = "";
  let jsonLdScript = "";
  const excluded = [
    "finance",
    "tech",
    "founders-mindset",
    "discussion",
    "discussions",
    "calculators",
    "directory",
    "markets",
    "rates",
    "careers",
    "events",
    "about",
    "about-us",
    "admin",
    "sitemap.xml",
    "robots.txt",
    "llms.txt",
    "privacy",
    "privacy-policy",
    "terms",
    "terms-of-service",
    "terms-of-editorial-service",
    "api",
    "uploads",
    "assets"
  ];
  if (segments.length > 0) {
    const rawSlug = segments[segments.length - 1];
    const lowerSlug = rawSlug.toLowerCase();
    if (lowerSlug === "finance") {
      title = "Finance, Markets & Venture Intelligence | StartupCr\xE8me";
      description = "Authoritative reporting on African and global fintech, capital markets, venture capital, macroeconomics, and institutional investments.";
      coverImage = "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&q=80&w=1200&h=630";
      section = "Finance";
    } else if (lowerSlug === "tech") {
      title = "Deep Technology & Frontier AI Intelligence | StartupCr\xE8me";
      description = "Frontier artificial intelligence architectures, developer tooling, cloud infrastructure, and emerging startup technology ecosystems.";
      coverImage = "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=1200&h=630";
      section = "Technology";
    } else if (lowerSlug === "founders-mindset") {
      title = "Founders Mindset, Leadership & Psychology | StartupCr\xE8me";
      description = "Strategic founder psychology, mental resilience, executive leadership frameworks, and high-performance decision-making for startup builders.";
      coverImage = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=1200&h=630";
      section = "Founders Mindset";
    } else if (lowerSlug === "calculators") {
      title = "Interactive Financial & Tech Calculators | StartupCr\xE8me";
      description = "Compound interest calculator, SaaS runway & burn rate calculator, cap table dilution simulator across Seed and Series A, and cloud infrastructure cost estimator.";
      section = "Calculators";
    } else if (lowerSlug === "directory") {
      title = "The Startup & FinTech Directory | StartupCr\xE8me";
      description = "Curated directory of early-stage and growth startups across FinTech, AI, Cloud Infrastructure, and EdTech.";
      section = "Directory";
    } else if ((lowerSlug === "rates" || cleanPath.includes("/markets/rates")) && !["false", "0", "no", "off"].includes(
      String(process.env.ENABLE_MARKETS ?? process.env.VITE_ENABLE_MARKETS ?? "true").trim().toLowerCase().replace(/^["']|["']$/g, "")
    )) {
      title = "Macro Central Bank & Cloud Rate Trackers | StartupCr\xE8me";
      description = "Live benchmark central bank interest rates and developer cloud infrastructure pricing index across AWS, Supabase, Vercel, and Cloudflare.";
      section = "Markets";
    } else if (lowerSlug === "careers") {
      title = "Remote Startup Job & Fractional Talent Board | StartupCr\xE8me";
      description = "Curated remote software engineering, FinOps, financial modeling, and fractional CTO/CFO leadership roles.";
      section = "Careers";
    } else if (lowerSlug === "events") {
      title = "Grants, Accelerators & Startup Events | StartupCr\xE8me";
      description = "Curated non-dilutive grants, institutional venture accelerators, founder fellowships, and tech competitions for software engineers, fintech builders, and tech entrepreneurs.";
      section = "Events";
    } else if (lowerSlug === "about" || lowerSlug === "about-us") {
      title = "About StartupCr\xE8me | Institutional Finance, Tech & AI Intelligence";
      description = "StartupCr\xE8me is a global guide dedicated to helping founders, software architects, and finance professionals build, fund, and scale companies in the age of AI. Built and operated by Habinsoft Technologies Limited and led by Chibueze ThankGod.";
      section = "About";
      const aboutJsonLd = {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": ["NewsMediaOrganization", "Organization"],
            "@id": `${baseUrl}/#organization`,
            name: "StartupCr\xE8me",
            url: baseUrl,
            logo: {
              "@type": "ImageObject",
              url: `${baseUrl}/logo.jpg`
            },
            description,
            founder: { "@id": `${baseUrl}/#founder` },
            parentOrganization: {
              "@type": "Organization",
              "@id": "https://habinsoft.com/#organization",
              name: "Habinsoft Technologies Limited",
              url: "https://habinsoft.com",
              founder: { "@id": `${baseUrl}/#founder` }
            }
          },
          {
            "@type": "Person",
            "@id": `${baseUrl}/#founder`,
            name: "Chibueze ThankGod",
            jobTitle: "Founder & Chief Executive Officer",
            description: "Software Engineer, Full-Stack Developer, and Tech Entrepreneur leading Habinsoft Technologies Limited and StartupCr\xE8me.",
            url: `${baseUrl}/about#leadership`,
            worksFor: [
              { "@id": "https://habinsoft.com/#organization" },
              { "@id": `${baseUrl}/#organization` }
            ]
          }
        ]
      };
      jsonLdScript = `<script type="application/ld+json">${JSON.stringify(aboutJsonLd)}</script>`;
    } else if (lowerSlug === "discussions" || lowerSlug === "discussion") {
      title = "Editorial Community & Technical Discussions | StartupCr\xE8me";
      description = "Engage with institutional analysts, technical founders, and verified engineering leaders on market strategy and AI infrastructure.";
      section = "Discussions";
    } else if (lowerSlug === "privacy" || lowerSlug === "privacy-policy") {
      title = "Privacy Policy | StartupCr\xE8me Editorial Platform";
      description = "StartupCr\xE8me privacy policy and user data governance standards.";
    } else if (lowerSlug === "terms" || lowerSlug === "terms-of-service" || lowerSlug === "terms-of-editorial-service") {
      title = "Terms of Editorial Service | StartupCr\xE8me";
      description = "Terms of service and reader agreement for StartupCr\xE8me publications.";
    } else if (rawSlug && !excluded.includes(lowerSlug)) {
      const decodedSlug = decodeURIComponent(rawSlug).trim();
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
      if (supabaseUrl && supabaseKey) {
        try {
          const scClient = createClient3(supabaseUrl, supabaseKey, {
            db: { schema: "startupcreme" },
            auth: { persistSession: false, autoRefreshToken: false }
          });
          const defaultClient = createClient3(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false }
          });
          const executeQuery = async (queryFn) => {
            try {
              const res = await queryFn(scClient);
              if (!res.error && res.data && (!Array.isArray(res.data) || res.data.length > 0)) {
                return res;
              }
            } catch {
            }
            return await queryFn(defaultClient);
          };
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedSlug);
          let foundPost = null;
          const resA = await executeQuery(
            (client) => client.from("posts").select("*").ilike("slug", decodedSlug).eq("status", "published").limit(1)
          );
          if (resA?.data && resA.data.length > 0) {
            foundPost = resA.data[0];
          }
          if (!foundPost && isUuid) {
            const resUuid = await executeQuery(
              (client) => client.from("posts").select("*").eq("id", decodedSlug).eq("status", "published").limit(1)
            );
            if (resUuid?.data && resUuid.data.length > 0) {
              foundPost = resUuid.data[0];
            }
          }
          if (!foundPost && decodedSlug.includes("-")) {
            const withSpaces = decodedSlug.replace(/-/g, " ");
            const resSpaces = await executeQuery(
              (client) => client.from("posts").select("*").ilike("slug", withSpaces).eq("status", "published").limit(1)
            );
            if (resSpaces?.data && resSpaces.data.length > 0) {
              foundPost = resSpaces.data[0];
            }
          }
          if (!foundPost && decodedSlug.includes(" ")) {
            const withHyphens = decodedSlug.replace(/\s+/g, "-");
            const resHyphens = await executeQuery(
              (client) => client.from("posts").select("*").ilike("slug", withHyphens).eq("status", "published").limit(1)
            );
            if (resHyphens?.data && resHyphens.data.length > 0) {
              foundPost = resHyphens.data[0];
            }
          }
          if (!foundPost && decodedSlug.length > 12) {
            const prefix = decodedSlug.slice(0, 30);
            const resPartial = await executeQuery(
              (client) => client.from("posts").select("*").ilike("slug", `%${prefix}%`).eq("status", "published").limit(1)
            );
            if (resPartial?.data && resPartial.data.length > 0) {
              foundPost = resPartial.data[0];
            }
          }
          if (foundPost && foundPost.status !== "published") {
            foundPost = null;
          }
          if (foundPost) {
            title = `${foundPost.title} | StartupCr\xE8me`;
            description = resolveArticleDescription(foundPost);
            if (foundPost.cover_image && typeof foundPost.cover_image === "string" && foundPost.cover_image.startsWith("data:image/")) {
              try {
                const r2Url = await uploadDataUrlToR2(foundPost.cover_image, foundPost.slug || foundPost.id);
                if (r2Url) {
                  foundPost.cover_image = r2Url;
                  Promise.resolve().then(async () => {
                    try {
                      await scClient.from("posts").update({ cover_image: r2Url }).eq("id", foundPost.id);
                    } catch (dbErr) {
                      console.warn("[DB Sync] Failed to sync R2 URL to Supabase:", dbErr);
                    }
                  });
                }
              } catch (migErr) {
                console.warn("[Cover Auto-Migrate] Error uploading data URL to R2:", migErr);
              }
            }
            coverImage = ensureAbsoluteUrl(foundPost.cover_image, baseUrl, foundPost.slug || foundPost.id);
            pageType = "article";
            authorName = foundPost.author_name || "Startup Cr\xE8me Editorial";
            publishedTime = foundPost.created_at || (/* @__PURE__ */ new Date()).toISOString();
            modifiedTime = foundPost.updated_at || foundPost.created_at || (/* @__PURE__ */ new Date()).toISOString();
            section = foundPost.vertical === "tech" ? "Technology" : foundPost.vertical === "founders-mindset" ? "Founders Mindset" : "Finance";
            tags = Array.isArray(foundPost.tags) ? foundPost.tags : [];
            const sanitizedPost = JSON.stringify(foundPost).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
            ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_POST__ = ${sanitizedPost};</script>`;
            const articleJsonLd = {
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": fullUrl
              },
              headline: foundPost.title,
              description,
              image: [coverImage],
              datePublished: publishedTime,
              dateModified: modifiedTime,
              author: {
                "@type": "Person",
                name: authorName
              },
              publisher: {
                "@type": "Organization",
                name: "StartupCr\xE8me",
                logo: {
                  "@type": "ImageObject",
                  url: `${baseUrl}/logo.jpg`
                }
              },
              articleSection: section,
              keywords: tags.join(", ")
            };
            jsonLdScript = `<script type="application/ld+json">${JSON.stringify(articleJsonLd)}</script>`;
          } else {
            let foundTopic = null;
            const topicResA = await executeQuery(
              (client) => client.from("discussion_topics").select("*").ilike("slug", decodedSlug).limit(1)
            );
            if (topicResA?.data && topicResA.data.length > 0) {
              foundTopic = topicResA.data[0];
            } else if (decodedSlug.includes("-")) {
              const topicResB = await executeQuery(
                (client) => client.from("discussion_topics").select("*").ilike("slug", decodedSlug.replace(/-/g, " ")).limit(1)
              );
              if (topicResB?.data && topicResB.data.length > 0) {
                foundTopic = topicResB.data[0];
              }
            }
            if (foundTopic) {
              title = `${foundTopic.title} | StartupCr\xE8me Discussion`;
              description = foundTopic.content ? foundTopic.content.slice(0, 160) + (foundTopic.content.length > 160 ? "..." : "") : "Join the community discussion on StartupCr\xE8me.";
              pageType = "article";
              authorName = foundTopic.author_name || "Community Member";
              publishedTime = foundTopic.created_at;
              modifiedTime = foundTopic.updated_at || foundTopic.created_at;
              section = "Discussions";
              const sanitizedTopic = JSON.stringify(foundTopic).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
              ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_TOPIC__ = ${sanitizedTopic};</script>`;
              const topicJsonLd = {
                "@context": "https://schema.org",
                "@type": "DiscussionForumPosting",
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": fullUrl
                },
                headline: foundTopic.title,
                articleBody: foundTopic.content,
                author: {
                  "@type": "Person",
                  name: authorName
                },
                datePublished: publishedTime,
                publisher: {
                  "@type": "Organization",
                  name: "StartupCr\xE8me",
                  logo: {
                    "@type": "ImageObject",
                    url: `${baseUrl}/logo.jpg`
                  }
                }
              };
              jsonLdScript = `<script type="application/ld+json">${JSON.stringify(topicJsonLd)}</script>`;
            }
          }
        } catch (dbErr) {
          console.warn("[SEO] Supabase query error for slug:", decodedSlug, dbErr);
        }
      }
    }
  }
  if (!ssrPayloadScript && segments.length <= 2) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    if (supabaseUrl && supabaseKey) {
      try {
        const scClient = createClient3(supabaseUrl, supabaseKey, {
          db: { schema: "startupcreme" },
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: posts } = await scClient.from("posts").select("*").eq("status", "published").order("created_at", { ascending: false }).limit(20);
        if (posts && posts.length > 0) {
          const sanitizedPosts = JSON.stringify(posts).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
          ssrPayloadScript = `<script id="__STARTUPCREME_SSR_DATA__">window.__INITIAL_POSTS__ = ${sanitizedPosts};</script>`;
        }
      } catch {
      }
    }
  }
  if (!jsonLdScript) {
    const websiteJsonLd = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "StartupCr\xE8me",
      url: baseUrl,
      description: DEFAULT_DESCRIPTION,
      potentialAction: {
        "@type": "SearchAction",
        target: `${baseUrl}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string"
      }
    };
    jsonLdScript = `<script type="application/ld+json">${JSON.stringify(websiteJsonLd)}</script>`;
  }
  return {
    title,
    description,
    coverImage: ensureAbsoluteUrl(coverImage, baseUrl),
    canonicalUrl: fullUrl,
    pageType,
    authorName,
    publishedTime,
    modifiedTime,
    section,
    tags,
    ssrPayloadScript,
    jsonLdScript
  };
}
async function injectDynamicMetaTags(html, reqPath, host, protocol) {
  const meta = await resolvePageMetadata(reqPath, host, protocol);
  const safeTitle = escapeHtml(meta.title);
  const safeDesc = escapeHtml(meta.description);
  const safeImage = escapeHtml(meta.coverImage);
  const safeUrl = escapeHtml(meta.canonicalUrl);
  const safeSite = "StartupCr\xE8me";
  let articleMetaTags = "";
  if (meta.pageType === "article") {
    if (meta.publishedTime) {
      articleMetaTags += `
    <meta property="article:published_time" content="${escapeHtml(meta.publishedTime)}" />`;
    }
    if (meta.modifiedTime) {
      articleMetaTags += `
    <meta property="article:modified_time" content="${escapeHtml(meta.modifiedTime)}" />`;
    }
    if (meta.section) {
      articleMetaTags += `
    <meta property="article:section" content="${escapeHtml(meta.section)}" />`;
    }
    if (meta.authorName) {
      articleMetaTags += `
    <meta property="article:author" content="${escapeHtml(meta.authorName)}" />`;
    }
    if (meta.tags && meta.tags.length > 0) {
      meta.tags.forEach((t) => {
        articleMetaTags += `
    <meta property="article:tag" content="${escapeHtml(t)}" />`;
      });
    }
  }
  let imageMime = "image/jpeg";
  if (meta.coverImage.toLowerCase().endsWith(".png")) imageMime = "image/png";
  else if (meta.coverImage.toLowerCase().endsWith(".webp")) imageMime = "image/webp";
  else if (meta.coverImage.toLowerCase().endsWith(".gif")) imageMime = "image/gif";
  const dynamicMetaBlock = `
    <!-- Primary SEO Metadata -->
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <link rel="canonical" href="${safeUrl}" />
    <link rel="image_src" href="${safeImage}" />

    <!-- Open Graph / Facebook / WhatsApp / LinkedIn / iMessage / Telegram -->
    <meta property="og:type" content="${meta.pageType}" />
    <meta property="og:site_name" content="${safeSite}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:secure_url" content="${safeImage}" />
    <meta property="og:image:type" content="${imageMime}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${safeUrl}" />${articleMetaTags}

    <!-- Twitter / X Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@startupcreme" />
    <meta name="twitter:creator" content="@startupcreme" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${safeImage}" />

    <!-- Structured Data (JSON-LD) -->
    ${meta.jsonLdScript || ""}

    <!-- Pre-rendered Hydration Payload -->
    ${meta.ssrPayloadScript || ""}
  `;
  let updatedHtml = html.replace(/<title>.*?<\/title>/gis, "");
  updatedHtml = updatedHtml.replace(/<meta\s+[^>]*(?:og:|twitter:|description|article:)[^>]*>/gis, "");
  updatedHtml = updatedHtml.replace(/<link\s+[^>]*rel=["']canonical["'][^>]*>/gis, "");
  updatedHtml = updatedHtml.replace(/<script\s+id=["']__STARTUPCREME_SSR_DATA__["'].*?<\/script>/gis, "");
  if (updatedHtml.includes("</head>")) {
    return updatedHtml.replace("</head>", `${dynamicMetaBlock}
  </head>`);
  }
  return `${dynamicMetaBlock}
${updatedHtml}`;
}

// server/sitemap.ts
import { createClient as createClient4 } from "@supabase/supabase-js";
var STATIC_LOCALES = ["en-us", "en-gb", "de-de", "ja-jp", "fr-fr"];
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
function formatIsoDate(dateStr) {
  if (!dateStr) return (/* @__PURE__ */ new Date()).toISOString();
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? (/* @__PURE__ */ new Date()).toISOString() : d.toISOString();
  } catch {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
}
async function generateDynamicSitemap(baseUrl = "https://www.startupcreme.com") {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  let posts = [];
  let topics = [];
  let publishedEvents = [];
  if (supabaseUrl && supabaseKey) {
    try {
      const client = createClient4(supabaseUrl, supabaseKey, {
        db: { schema: "startupcreme" },
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: postsData, error: postsError } = await client.from("posts").select("slug, locale, vertical, updated_at").eq("status", "published").order("updated_at", { ascending: false });
      if (!postsError && Array.isArray(postsData)) {
        posts = postsData;
      }
      const { data: topicsData, error: topicsError } = await client.from("discussion_topics").select("slug, updated_at").order("updated_at", { ascending: false });
      if (!topicsError && Array.isArray(topicsData)) {
        topics = topicsData;
      }
      const { data: eventsData, error: eventsError } = await client.from("events").select("slug, deadline_date, linked_post:posts!inner(status, updated_at)").eq("linked_post.status", "published").order("deadline_date", { ascending: true });
      if (!eventsError && Array.isArray(eventsData)) {
        publishedEvents = eventsData.map((e) => ({
          slug: e.slug,
          updated_at: e.linked_post?.updated_at || e.deadline_date
        }));
      }
    } catch (dbErr) {
      console.warn("[Sitemap] Warning fetching dynamic records from Supabase:", dbErr);
    }
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;
  xml += `  <url>
`;
  xml += `    <loc>${escapeXml(`${cleanBase}/`)}</loc>
`;
  xml += `    <lastmod>${nowIso}</lastmod>
`;
  xml += `    <changefreq>daily</changefreq>
`;
  xml += `    <priority>1.0</priority>
`;
  xml += `  </url>
`;
  STATIC_LOCALES.forEach((loc) => {
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}`)}</loc>
`;
    xml += `    <lastmod>${nowIso}</lastmod>
`;
    xml += `    <changefreq>daily</changefreq>
`;
    xml += `    <priority>1.0</priority>
`;
    xml += `  </url>
`;
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/finance`)}</loc>
`;
    xml += `    <lastmod>${nowIso}</lastmod>
`;
    xml += `    <changefreq>daily</changefreq>
`;
    xml += `    <priority>0.9</priority>
`;
    xml += `  </url>
`;
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/tech`)}</loc>
`;
    xml += `    <lastmod>${nowIso}</lastmod>
`;
    xml += `    <changefreq>daily</changefreq>
`;
    xml += `    <priority>0.9</priority>
`;
    xml += `  </url>
`;
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/founders-mindset`)}</loc>
`;
    xml += `    <lastmod>${nowIso}</lastmod>
`;
    xml += `    <changefreq>daily</changefreq>
`;
    xml += `    <priority>0.9</priority>
`;
    xml += `  </url>
`;
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/privacy`)}</loc>
`;
    xml += `    <changefreq>monthly</changefreq>
`;
    xml += `    <priority>0.4</priority>
`;
    xml += `  </url>
`;
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(`${cleanBase}/${loc}/terms`)}</loc>
`;
    xml += `    <changefreq>monthly</changefreq>
`;
    xml += `    <priority>0.4</priority>
`;
    xml += `  </url>
`;
  });
  const platformModules = [
    { path: "/events", priority: "0.9", changefreq: "daily" },
    { path: "/discussion", priority: "0.85", changefreq: "hourly" },
    { path: "/directory", priority: "0.8", changefreq: "daily" },
    { path: "/careers", priority: "0.8", changefreq: "daily" },
    { path: "/markets", priority: "0.8", changefreq: "hourly" },
    { path: "/privacy", priority: "0.4", changefreq: "monthly" },
    { path: "/terms", priority: "0.4", changefreq: "monthly" }
  ];
  platformModules.forEach((m) => {
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(`${cleanBase}${m.path}`)}</loc>
`;
    xml += `    <lastmod>${nowIso}</lastmod>
`;
    xml += `    <changefreq>${m.changefreq}</changefreq>
`;
    xml += `    <priority>${m.priority}</priority>
`;
    xml += `  </url>
`;
  });
  posts.forEach((post) => {
    if (!post.slug) return;
    const loc = post.locale || "en-us";
    const vertical = post.vertical || "tech";
    const postUrl = `${cleanBase}/${loc}/${vertical}/${post.slug}`;
    const lastMod = formatIsoDate(post.updated_at);
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(postUrl)}</loc>
`;
    xml += `    <lastmod>${lastMod}</lastmod>
`;
    xml += `    <changefreq>weekly</changefreq>
`;
    xml += `    <priority>0.85</priority>
`;
    xml += `  </url>
`;
  });
  topics.forEach((t) => {
    if (!t.slug) return;
    const topicUrl = `${cleanBase}/discussion/${t.slug}`;
    const lastMod = formatIsoDate(t.updated_at);
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(topicUrl)}</loc>
`;
    xml += `    <lastmod>${lastMod}</lastmod>
`;
    xml += `    <changefreq>daily</changefreq>
`;
    xml += `    <priority>0.7</priority>
`;
    xml += `  </url>
`;
  });
  publishedEvents.forEach((evt) => {
    if (!evt.slug) return;
    const evtUrl = `${cleanBase}/events#${evt.slug}`;
    const lastMod = formatIsoDate(evt.updated_at);
    xml += `  <url>
`;
    xml += `    <loc>${escapeXml(evtUrl)}</loc>
`;
    xml += `    <lastmod>${lastMod}</lastmod>
`;
    xml += `    <changefreq>daily</changefreq>
`;
    xml += `    <priority>0.8</priority>
`;
    xml += `  </url>
`;
  });
  xml += `</urlset>
`;
  return xml;
}
function generateRobotsTxt(baseUrl = "https://www.startupcreme.com") {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return `# ====================================================================
# Startup Cr\xE8me (startupcreme.com) \u2014 Robots & AI Crawler Directives
# Optimized for Search Engine (SEO) & AI Optimization (AIO) Discoverability
# ====================================================================

# 1. Search Engine Crawlers (Googlebot, Bingbot, Applebot, DuckDuckBot)
User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: Bingbot
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: Applebot
User-agent: DuckDuckBot
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

# 2. AI Crawlers, Search Agents & LLM Indexers (AIO Discovery)
User-agent: GPTBot
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /discussion
Allow: /events
Allow: /directory
Allow: /careers
Allow: /markets
Allow: /llms.txt
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: OAI-SearchBot
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: ClaudeBot
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /discussion
Allow: /events
Allow: /directory
Allow: /careers
Allow: /markets
Allow: /llms.txt
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

User-agent: PerplexityBot
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /discussion
Allow: /events
Allow: /directory
Allow: /careers
Allow: /markets
Allow: /llms.txt
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

# 3. Default Directives for All Crawlers
User-agent: *
Allow: /
Allow: /en-us/
Allow: /en-gb/
Allow: /de-de/
Allow: /ja-jp/
Allow: /fr-fr/
Allow: /discussion
Allow: /events
Allow: /directory
Allow: /careers
Allow: /markets
Allow: /privacy
Allow: /terms
Allow: /llms.txt
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /events/webhook
Disallow: /events/ingest
Disallow: /n8n/events
Disallow: /webhooks/

# Dynamic Sitemap Pointer
Sitemap: ${cleanBase}/sitemap.xml
`;
}
function generateLlmsTxt(baseUrl = "https://www.startupcreme.com") {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  return `# Startup Cr\xE8me (startupcreme.com)

> Startup Cr\xE8me is a premier dual-silo intelligence platform providing actionable founder playbooks, macro technology news, non-dilutive grants, institutional accelerators, and peer discussions at the intersection of Finance and Technology.

## Core Architectural Overview

Startup Cr\xE8me partitions editorial and intelligence streams into three foundational content silos:
- **Finance**: Venture capital dynamics, cap table structuring, central bank interest rates, currency volatility, fintech infrastructure, and equity-free funding instruments.
- **Tech**: Artificial intelligence, autonomous agent pipelines, frontier cloud architecture, developer tooling, and technical engineering leadership.
- **Founders Mindset**: Strategic leadership psychology, executive resilience, decision-making frameworks, and mental fortitude for venture-backed founders.

Content is published across 5 localized regional editions:
- \`en-us\`: United States & Global Tech Ecosystem
- \`en-gb\`: United Kingdom & European Fintech Corridor
- \`de-de\`: DACH Region DeepTech & Industrial Software
- \`ja-jp\`: Japan Enterprise Robotics & AI Markets
- \`fr-fr\`: France & Francophone Tech Scaleups

---

## Primary Navigation & Public Resources

- [Home Hub](${cleanBase}/): Global portal featuring cross-silo editorial highlights, trending discussions, and macro market widgets.
- [Finance Vertical Hub](${cleanBase}/en-us/finance): Specialized editorial feed for venture capital, monetary policy, and fintech engineering.
- [Tech Vertical Hub](${cleanBase}/en-us/tech): Deep technical essays, AI infrastructure breakthroughs, and system architecture playbooks.
- [Founders Mindset Vertical Hub](${cleanBase}/en-us/founders-mindset): Strategic leadership psychology, executive resilience, and founder decision-making frameworks.
- [Global Opportunity Engine (Grants & Accelerators)](${cleanBase}/events): Verified non-dilutive grants, venture accelerators, founder fellowships, and hackathon deadlines.
- [Discussion Forum](${cleanBase}/discussion): Community debate and peer founder intelligence on valuations, tech stacks, and fundraising.
- [Startup Directory](${cleanBase}/directory): Index of high-growth technology and financial companies.
- [Founder Careers & Talent](${cleanBase}/careers): Executive leadership, founding engineer, and tech lead opportunities.
- [Macro & Cloud Rates Tracker](${cleanBase}/markets): Real-time benchmarks for central bank interest rates (Fed, ECB, BoE, BoJ) and cloud compute pricing.

---

## Content Organization & URL Structure

- **Article & Playbook Permalinks**: \`${cleanBase}/{locale}/{vertical}/{slug}\`
  - Example: \`${cleanBase}/en-us/finance/seed-fundraising-mechanics-safes\`
  - Example: \`${cleanBase}/en-us/tech/ai-agent-memory-architectures\`
- **Discussion Topic Permalinks**: \`${cleanBase}/discussion/{slug}\`
  - Example: \`${cleanBase}/discussion/yc-w26-batch-trends\`
- **Localized Silo Feeds**: \`${cleanBase}/{locale}/{vertical}\`

---

## Machine-Readable Endpoints & Feeds

- **Dynamic XML Sitemap**: [${cleanBase}/sitemap.xml](${cleanBase}/sitemap.xml)
- **Robots Directives**: [${cleanBase}/robots.txt](${cleanBase}/robots.txt)
- **AI Agent Specification**: [${cleanBase}/llms.txt](${cleanBase}/llms.txt)
- **System Health**: [${cleanBase}/api/health](${cleanBase}/api/health)

---

## Guidelines for AI Crawlers & LLM Agents

1. **Attribution**: When synthesizing or citing playbooks, attribute analysis to *Startup Cr\xE8me* with the direct canonical URL.
2. **Current Information**: Opportunities listed under \`/events\` carry strict deadline timestamps. Always verify the \`deadline_date\` attribute before recommending closing grants to users.
3. **No Private Scraping**: Do not scrape internal API paths (\`/api/*\`, \`/admin/*\`, or webhook endpoints); all public content is structured in the sitemap and HTML semantic markup.
4. **Publication Status**: Only verified opportunities with linked editorial playbooks that have \`status = 'published'\` are publicly indexed and readable. Drafts are strictly withheld from public discovery.
`;
}

// server/app.ts
var MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
var uploadRateLimits = /* @__PURE__ */ new Map();
function checkUploadRateLimit(identifier, limit = 20, windowMs = 6e4) {
  const now = Date.now();
  let record = uploadRateLimits.get(identifier);
  if (!record || record.resetAt <= now) {
    record = { count: 1, resetAt: now + windowMs };
    uploadRateLimits.set(identifier, record);
    return { allowed: true, remaining: limit - 1, retryAfter: Math.ceil(windowMs / 1e3) };
  }
  record.count += 1;
  const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1e3));
  if (record.count > limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: limit - record.count, retryAfter };
}
function detectAllowedImageMagicBytes(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 137 && buf[1] === 80 && // P
  buf[2] === 78 && // N
  buf[3] === 71 && // G
  buf[4] === 13 && // \r
  buf[5] === 10 && // \n
  buf[6] === 26 && buf[7] === 10) {
    return "png";
  }
  if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) {
    return "jpeg";
  }
  if (buf[0] === 82 && // R
  buf[1] === 73 && // I
  buf[2] === 70 && // F
  buf[3] === 70 && // F
  buf[8] === 87 && // W
  buf[9] === 69 && // E
  buf[10] === 66 && // B
  buf[11] === 80) {
    return "webp";
  }
  return null;
}
function containsSvgOrXml(buf) {
  if (!buf || buf.length === 0) return false;
  const sample = buf.slice(0, 1024).toString("utf8").toLowerCase();
  return sample.includes("<svg") || sample.includes("<?xml") || sample.includes('xmlns="http://www.w3.org/2000/svg"') || sample.includes("<!doctype svg");
}
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES
    // Hard 5MB limit
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
function createApp(options) {
  const app2 = express();
  app2.use(express.json({ limit: "10mb" }));
  app2.use((req, res, next) => {
    const rawMatched = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"] || req.headers["x-original-url"] || req.headers["x-rewrite-url"];
    if (rawMatched && typeof rawMatched === "string") {
      const cleanMatched = rawMatched.split("?")[0];
      if (cleanMatched && cleanMatched !== "/api" && cleanMatched !== "/api/" && req.url !== cleanMatched) {
        const queryPart = req.url.includes("?") ? "?" + req.url.split("?")[1] : "";
        req.url = cleanMatched + queryPart;
      }
    }
    next();
  });
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch {
    }
  }
  app2.use("/uploads", express.static(uploadsDir));
  app2.get(["/api", "/api/"], (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json({
      status: "ok",
      service: "StartupCr\xE8me Operational Platform",
      version: "1.0.0",
      routes: [
        "/api/health",
        "/api/auth/profile",
        "/api/upload-image"
      ]
    });
  });
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
      const authClient = createClient5(supabaseUrl, anonKey || serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: "Invalid or expired auth token", details: authError?.message });
      }
      const email = (user.email || "").trim().toLowerCase();
      const userId = user.id;
      const adminClient = createClient5(supabaseUrl, serviceRoleKey || anonKey, {
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
        const masterClient = createClient5(supabaseUrl, serviceRoleKey);
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
  app2.use("/api", expansionRouter);
  app2.use(["/api/editorial", "/editorial"], editorialRouter);
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
      const xml = await generateDynamicSitemap(baseUrl);
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
  app2.get(["/robots.txt", "/robots"], (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    let host = req.get("x-forwarded-host") || req.get("host") || "www.startupcreme.com";
    if (!host.includes("startupcreme.com")) {
      host = "www.startupcreme.com";
    }
    let protocol = req.get("x-forwarded-proto") || req.protocol || "https";
    if (host.includes("startupcreme.com")) {
      protocol = "https";
    }
    const baseUrl = `${protocol}://${host}`;
    const robots = generateRobotsTxt(baseUrl);
    return res.status(200).send(robots);
  });
  app2.get(["/llms.txt", "/llms"], (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    let host = req.get("x-forwarded-host") || req.get("host") || "www.startupcreme.com";
    if (!host.includes("startupcreme.com")) {
      host = "www.startupcreme.com";
    }
    let protocol = req.get("x-forwarded-proto") || req.protocol || "https";
    if (host.includes("startupcreme.com")) {
      protocol = "https";
    }
    const baseUrl = `${protocol}://${host}`;
    const llms = generateLlmsTxt(baseUrl);
    return res.status(200).send(llms);
  });
  const handleMulterUpload = (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE" || err.message?.includes("File too large")) {
          return res.status(413).json({
            success: false,
            error: "Payload Too Large: Image size exceeds maximum limit of 5 MB.",
            code: "PAYLOAD_TOO_LARGE"
          });
        }
        return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
      }
      next();
    });
  };
  app2.post(["/api/upload-image", "/upload-image"], handleMulterUpload, async (req, res) => {
    try {
      const clientIdentifier = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown_client";
      const rateCheck = checkUploadRateLimit(clientIdentifier, 20, 6e4);
      res.setHeader("X-RateLimit-Limit", "20");
      res.setHeader("X-RateLimit-Remaining", String(rateCheck.remaining));
      if (!rateCheck.allowed) {
        res.setHeader("Retry-After", String(rateCheck.retryAfter));
        return res.status(429).json({
          success: false,
          error: "Too Many Requests: Image upload rate limit exceeded. Maximum 20 uploads per minute.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: rateCheck.retryAfter
        });
      }
      const authHeader = req.headers.authorization;
      if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: Missing or invalid Authorization Bearer header with Supabase JWT.",
          code: "UNAUTHORIZED"
        });
      }
      const token = authHeader.slice(7).trim();
      if (!token) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: Empty bearer token provided.",
          code: "UNAUTHORIZED"
        });
      }
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || "";
      if (!supabaseUrl || !anonKey && !serviceRoleKey) {
        return res.status(503).json({
          success: false,
          error: "Service Unavailable: Supabase authentication client not configured.",
          code: "AUTH_UNAVAILABLE"
        });
      }
      const authClient = createClient5(supabaseUrl, anonKey || serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !user || !user.id || user.role !== "authenticated") {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid or expired Supabase authentication session. Role "authenticated" required.',
          code: "INVALID_TOKEN"
        });
      }
      let fileBuffer;
      if (req.file) {
        fileBuffer = req.file.buffer;
      } else if (req.body?.dataUrl && typeof req.body.dataUrl === "string") {
        const match = req.body.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          return res.status(400).json({ success: false, error: "Invalid dataUrl format in request body." });
        }
        fileBuffer = Buffer.from(match[2], "base64");
      } else {
        return res.status(400).json({ success: false, error: "No image file or dataUrl provided in request." });
      }
      if (fileBuffer.length > MAX_IMAGE_SIZE_BYTES) {
        return res.status(413).json({
          success: false,
          error: "Payload Too Large: Image size exceeds maximum limit of 5 MB.",
          code: "PAYLOAD_TOO_LARGE"
        });
      }
      if (containsSvgOrXml(fileBuffer)) {
        return res.status(400).json({
          success: false,
          error: "Invalid file format: SVG files are strictly prohibited due to security risks (XSS).",
          code: "SVG_REJECTED"
        });
      }
      const format = detectAllowedImageMagicBytes(fileBuffer);
      if (!format) {
        return res.status(400).json({
          success: false,
          error: "Invalid file format: Only valid PNG, JPEG, and WebP images are allowed. Binary magic bytes verification failed.",
          code: "INVALID_IMAGE_FORMAT"
        });
      }
      let fileMime = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
      let fileExt = format === "jpeg" ? ".jpg" : format === "png" ? ".png" : ".webp";
      try {
        const sharp = (await import("sharp")).default;
        if (format === "webp") {
          fileBuffer = await sharp(fileBuffer).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
          fileMime = "image/jpeg";
          fileExt = ".jpg";
        }
      } catch (sharpErr) {
        console.warn("[Sharp] Upload conversion warning:", sharpErr);
      }
      const randomUuid = crypto3.randomUUID();
      const safeFilename = `${Date.now()}-${randomUuid}${fileExt}`;
      const objectKey = `articles/${safeFilename}`;
      const r2Config = getR2Config();
      const saveLocally = () => {
        try {
          const articleUploadsDir = path.join(process.cwd(), "public", "uploads", "articles");
          if (!fs.existsSync(articleUploadsDir)) {
            fs.mkdirSync(articleUploadsDir, { recursive: true });
          }
          const localFilePath = path.join(articleUploadsDir, safeFilename);
          fs.writeFileSync(localFilePath, fileBuffer);
          return `/uploads/articles/${safeFilename}`;
        } catch (fsErr) {
          console.warn("[Storage] Read-only filesystem detected, falling back to base64 data URI:", fsErr);
          return `data:${fileMime};base64,${fileBuffer.toString("base64")}`;
        }
      };
      if (!r2Config.isConfigured) {
        const localUrl = saveLocally();
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
          Body: fileBuffer,
          ContentType: fileMime,
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
        success: false,
        error: err?.message || "Failed to process image upload."
      });
    }
  });
  app2.get([
    "/api/posts/:slug/cover.png",
    "/api/posts/:slug/cover",
    "/api/posts/:id/cover.png",
    "/api/posts/:id/cover"
  ], async (req, res) => {
    try {
      const slugOrId = req.params.slug || req.params.id;
      if (!slugOrId) return res.status(404).send("Not found");
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
      if (!supabaseUrl || !supabaseKey) {
        return res.redirect(302, "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630");
      }
      const client = createClient5(supabaseUrl, supabaseKey);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
      let query = client.schema("startupcreme").from("posts").select("id, slug, cover_image");
      if (isUuid) {
        query = query.eq("id", slugOrId);
      } else {
        query = query.ilike("slug", slugOrId);
      }
      const { data: posts } = await query.limit(1);
      const post = posts?.[0];
      if (!post || !post.cover_image) {
        return res.redirect(302, "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630");
      }
      if (post.cover_image.startsWith("http://") || post.cover_image.startsWith("https://")) {
        return res.redirect(302, post.cover_image);
      }
      if (post.cover_image.startsWith("data:image/")) {
        const match = post.cover_image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          const mimeType = match[1];
          const buffer = Buffer.from(match[2], "base64");
          res.setHeader("Content-Type", mimeType);
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          return res.status(200).send(buffer);
        }
      }
      return res.redirect(302, "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630");
    } catch (err) {
      console.error("Error serving cover image:", err);
      res.redirect(302, "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1200&h=630");
    }
  });
  if (options?.serveHtml !== false) {
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app2.use(express.static(distPath, { index: false }));
    }
    const loadHtmlTemplate = () => {
      const candidates = [
        path.join(process.cwd(), "dist", "index.html"),
        path.join(process.cwd(), "index.html"),
        path.join(process.cwd(), "public", "index.html")
      ];
      for (const p of candidates) {
        try {
          if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
        } catch {
        }
      }
      return `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>StartupCr\xE8me</title></head><body><div id="root"></div></body></html>`;
    };
    app2.get("*", async (req, res, next) => {
      const activePath = (req.url || req.path).split("?")[0].toLowerCase();
      if (activePath.startsWith("/api") || activePath === "/sitemap.xml" || activePath === "/sitemap" || activePath === "/sitemap_index.xml" || activePath === "/robots.txt" || activePath === "/llms.txt" || /\.(js|css|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(activePath)) {
        return next();
      }
      try {
        const template = loadHtmlTemplate();
        let host = req.headers["x-forwarded-host"] || req.headers["host"] || "www.startupcreme.com";
        if (Array.isArray(host)) host = host[0];
        let protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        if (Array.isArray(protocol)) protocol = protocol[0];
        const targetUrl = req.url || req.originalUrl;
        const dynamicHtml = await injectDynamicMetaTags(template, targetUrl, host, protocol);
        res.status(200).set({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
        }).send(dynamicHtml);
      } catch (err) {
        console.error("[SEO Render] Error rendering dynamic metadata:", err);
        next(err);
      }
    });
  }
  return app2;
}
var app = createApp();
var app_default = app;
export {
  app,
  createApp,
  app_default as default
};
