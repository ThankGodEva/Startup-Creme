# System Architecture & Design Overview

StartupCrème is an enterprise-grade financial and tech intelligence publishing platform. This document outlines the system architecture, state management layer, and fallback security mechanisms.

---

## 🏗️ High-Level Topology

```
[ Web Browser / Client ]
       │
       ├───> [ React 19 Frontend + Tailwind v4 ]
       │            │
       │            ├───> [ Local State Engine (store.ts) ] (Offline Fallback)
       │            │
       │            └───> [ Supabase JS SDK ]
       │                        │
       ▼                        ▼
[ Dev / Prod Server ]     [ Supabase Cloud PostgreSQL ]
  (Express / Vite)          ├── RLS Security Engine
                            ├── Indexing & Query Optimizers
                            └── Newsletter & Editorial Storage
```

---

## ⚡ Dual-Layer Persistence Engine

To guarantee zero downtime and graceful offline operation:

1. **Cloud Persistence (Primary)**: Connected to Supabase Cloud PostgreSQL. Executes parameterized queries with strict RLS enforcement.
2. **Local Storage Fallback (Secondary)**: In the event of network disruption or missing Supabase credentials, the store seamlessly falls back to `localStorage` key-value collections.

---

## 🛡️ Role-Based Access Control (RBAC)

- **Admin**: Complete CRUD over articles, dual-silo management, sitemap generation, and newsletter subscriber access.
- **Moderator**: Forum topic removal, discussion thread cleanup, and community reputation oversight.
- **User**: Forum topic creation, nested commenting, thread upvoting, and bookmarking.
