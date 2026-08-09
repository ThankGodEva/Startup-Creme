# StartupCrème Media & Intelligence Platform

Production-grade, high-performance financial and technology publication platform engineered with React, TypeScript, Tailwind CSS, and Supabase. Features topical siloing for search engine optimization, regional localization (`/en-us`, `/en-gb`), instant peer discussion forums, and an administrative CMS for editorial content management.

---

## 🚀 Key Features

- **Topical Authority Siloing**: Isolated vertical architectures for **Finance** (`/[locale]/finance`) and **Tech** (`/[locale]/tech`) with dual-silo publication capabilities.
- **Regional Localization**: Full support for internationalization across `en-us`, `en-gb`, `en-eu`, and `en-asia`.
- **Newsletter Subscription System**: Real-time subscriber ingestion with Supabase database synchronization and offline state fallbacks.
- **Editorial CMS Admin Dashboard**: Article drafting, publication status toggles, localized metadata controls, and XML sitemap generator (`/admin`).
- **Discussion Community**: Moderated forums with thread voting, nested comment trees, reputation badges, and real-time community engagement.
- **Security & Authorization**: Row Level Security (RLS) policies, Zod input validation, HTML sanitization, and Role-Based Access Control (RBAC: `admin`, `moderator`, `user`).
- **Resilient Fallback Storage**: Dual-layer architecture combining Supabase Cloud PostgreSQL with local client state persistence.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion
- **Database & Auth**: Supabase PostgreSQL, Row Level Security (RLS)
- **Icons**: Lucide React
- **Validation**: Zod & Sanitization Helpers
- **Build Tooling**: Vite 6, TSX, esbuild

---

## 📦 Getting Started

### 1. Installation

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file based on `.env.example`:

```env
GEMINI_API_KEY="your-gemini-key"
APP_URL="http://localhost:3000"
SUPABASE_URL="https://your-supabase-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"
```

### 3. Database Migration

Run the provided SQL script in `/supabase/schema.sql` inside your Supabase SQL Editor to provision the newsletter table and core schema:

```sql
-- See /supabase/schema.sql for the complete DDL script
```

### 4. Running Local Development

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

---

## 📚 Documentation Index

Detailed architectural and technical guides are available in the [`/docs`](/docs) directory:

1. [**Database Reference & SQL Migrations**](docs/database.md) - Complete PostgreSQL DDL for newsletter subscribers, posts, discussions, and RLS policies.
2. [**Architecture & System Design**](docs/architecture.md) - System topology, state management, dual-layer storage fallbacks, and RBAC security model.
3. [**API Schemas & Input Validation**](docs/api.md) - Zod schemas, payload structures, and sanitization rules.
4. [**SEO & Topical Siloing Guide**](docs/seo.md) - SEO architecture, canonical URL formatting, and XML sitemap generation.
5. [**Performance & Optimization**](docs/performance.md) - Database indexing, asset rendering, and component memoization techniques.
6. [**Troubleshooting & FAQ**](docs/troubleshooting.md) - Solutions for common development and deployment issues.

---

## 🛡️ License

© StartupCrème Media Group. Proprietary Enterprise Codebase.
