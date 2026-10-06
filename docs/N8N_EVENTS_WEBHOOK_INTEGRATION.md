# n8n Scraper Webhook & Dual-Table PostgreSQL Ingestion Specification

This document provides the complete technical specification for integrating automated data pipelines (n8n workflows, Python scrapers, cron daemons) with StartupCrème's **Events & Grants Opportunity Engine**.

---

## 1. Overview & Architecture

When an external n8n scraper captures grant or accelerator information from the web, it sends a single authenticated `POST` request to StartupCrème.

The backend securely validates the request and performs an atomic dual-table upsert into two PostgreSQL tables inside the `startupcreme` schema:

1. **`startupcreme.posts`**: Creates or updates an editorial article matching on the unique constraint `(locale, vertical, slug)`.
2. **`startupcreme.events`**: Creates or updates the opportunity record matching on the unique constraint `(application_url)`, linking `linked_post_id` to the post UUID returned in step 1.

```
┌─────────────────────────────────┐
│     n8n Workflow / Scraper      │
└────────────────┬────────────────┘
                 │ POST /api/events/webhook
                 │ Authorization: Bearer <N8N_WEBHOOK_SECRET>
                 ▼
┌─────────────────────────────────┐
│   StartupCrème Ingestion API    │
│  (1. Bearer Token Auth Check)   │
│  (2. Strict Payload Validation) │
└────────┬───────────────┬────────┘
         │               │
         ▼               ▼
┌─────────────────┐  ┌──────────────────┐
│startupcreme.    │  │startupcreme.     │
│posts            │  │events            │
│(locale, vertical│  │(application_url) │
│ slug)           │  │linked_post_id FK │
└─────────────────┘  └──────────────────┘
```

---

## 2. API Endpoints

The ingestion endpoint is accessible at:
- `POST /api/events/webhook` (Recommended)
- `POST /api/events`
- `POST /api/n8n/events`
- `POST /events/webhook` (Direct root path)
- `POST /n8n/events` (Direct root path)

---

## 3. Authentication & Security

All incoming requests must include a Bearer token in the `Authorization` header:

```http
Authorization: Bearer <YOUR_N8N_WEBHOOK_SECRET>
```

The server verifies this token in constant time using `crypto.timingSafeEqual` against the following environment variables (in priority order):
1. `N8N_WEBHOOK_SECRET`
2. `EVENT_WEBHOOK_SECRET`
3. `N8N_BEARER_TOKEN`
4. `EVENTS_API_BEARER_TOKEN`
5. `STARTUPCREME_AUTOMATION_SECRET`

If the header is missing, improperly formatted, or the token does not match, the endpoint returns **`401 Unauthorized`**:

```json
{
  "success": false,
  "error": "Unauthorized: Missing or invalid Bearer token. Please provide a valid Authorization: Bearer <token> header matching N8N_WEBHOOK_SECRET or EVENT_WEBHOOK_SECRET."
}
```

---

## 4. Payload Validation (Required & Optional Fields)

### Required Fields (All 7 Must Be Present and Non-Empty):
| Field | Type | Description |
|---|---|---|
| `event_title` | `string` | Display title of the event/grant opportunity |
| `application_url` | `string` | Unique direct link to the application portal |
| `slug` | `string` | URL-safe slug for the article and event (e.g. `google-ai-accelerator-2026`) |
| `vertical` | `string` | Content vertical: `"tech"` or `"finance"` |
| `locale` | `string` | Subpath locale: `"en-us"`, `"en-gb"`, `"de-de"`, etc. |
| `title` | `string` | Headline title for the editorial article |
| `content` | `object` or `string` | Full article content (Tiptap JSON doc or text) |

If any of these 7 fields are missing or empty, the server returns **`400 Bad Request`**:

```json
{
  "success": false,
  "error": "Payload validation failed: Missing required fields: vertical, locale",
  "missing_fields": ["vertical", "locale"]
}
```

### Optional Fields:
| Field | Type | Default | Description |
|---|---|---|---|
| `opportunity_type` | `string` | `"grant"` | `"grant"`, `"accelerator"`, `"fellowship"`, `"incubator"`, `"pitch_competition"`, `"hackathon"`, `"conference"`, `"general"` |
| `funding_amount` | `string` | `null` | Funding text, e.g. `"$350,000 Equity-Free Cloud Capital"` |
| `location` | `string` | `"Global (Remote)"` | Physical location or `"Global (Remote)"` |
| `deadline_date` | `string` (ISO 8601) | `now + 30 days` | Application deadline, e.g. `"2026-11-30T23:59:59Z"` |
| `excerpt` | `string` | auto-generated | 1-2 sentence article summary (max 240 chars) |
| `meta_description` | `string` | auto-generated | SEO meta description (max 160 chars) |
| `cover_image` | `string` | `null` | Absolute HTTPS image URL for banner |
| `author_name` | `string` | `"Startup Crème Editorial"` | Article author byline |
| `author_role` | `string` | `"Principal Editor"` | Author editorial title |
| `tags` | `string[]` | `[]` | Topical tags (e.g. `["AI", "Grants"]`) |
| `status` | `string` | `"published"` | Publication status (`"published"` or `"draft"`) |

---

## 5. PostgreSQL Database Schema

### Table 1: `startupcreme.posts`
```sql
create table startupcreme.posts (
  id uuid not null default gen_random_uuid (),
  slug text not null,
  locale text not null default 'en-us'::text,
  vertical startupcreme.content_vertical not null,
  title text not null,
  excerpt text null,
  content jsonb not null,
  status startupcreme.publication_status not null default 'draft'::startupcreme.publication_status,
  meta_description text null,
  canonical_url text null,
  cover_image text null,
  author_name text null default 'Startup Crème Editorial'::text,
  author_role text null default 'Principal Editor'::text,
  author_avatar text null,
  dual_silo boolean null default false,
  silo_badge text null,
  tags text[] null default '{}'::text[],
  reading_time_minutes integer null default 5,
  word_count integer null default 800,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint posts_pkey primary key (id),
  constraint unique_locale_vertical_slug unique (locale, vertical, slug)
) TABLESPACE pg_default;
```

### Table 2: `startupcreme.events`
```sql
create table startupcreme.events (
  id uuid not null default gen_random_uuid (),
  title text not null,
  slug text not null,
  description text not null,
  opportunity_type public.opportunity_type not null,
  funding_amount text null,
  location text not null,
  deadline_date timestamp with time zone not null,
  application_url text not null,
  linked_post_id uuid null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint events_pkey primary key (id),
  constraint events_application_url_key unique (application_url),
  constraint events_slug_key unique (slug),
  constraint events_linked_post_id_fkey foreign KEY (linked_post_id) references startupcreme.posts (id) on delete set null
) TABLESPACE pg_default;
```

---

## 6. Success Response (HTTP 200)

When both tables are successfully upserted, the endpoint responds with HTTP 200:

```json
{
  "success": true,
  "message": "Event and post successfully upserted into startupcreme schema",
  "data": {
    "post_id": "df6c27e3-4483-43dc-a851-90843b012ddf",
    "event_id": "cc732059-0c58-4abe-81ab-d4d48d86547c",
    "event_title": "Google for Startups Accelerator: AI First",
    "application_url": "https://startup.google.com/accelerator/ai",
    "opportunity_type": "accelerator",
    "funding_amount": "$350,000 Equity-Free Cloud Credits",
    "deadline_date": "2026-11-30T23:59:59.000Z",
    "linked_post_id": "df6c27e3-4483-43dc-a851-90843b012ddf",
    "post": {
      "id": "df6c27e3-4483-43dc-a851-90843b012ddf",
      "locale": "en-us",
      "vertical": "tech",
      "slug": "google-ai-accelerator-2026",
      "title": "Google for Startups Accelerator Launches 2026 AI Cohort"
    }
  }
}
```

---

## 7. Sample cURL Request

```bash
curl -X POST "https://www.startupcreme.com/api/events/webhook" \
  -H "Authorization: Bearer YOUR_N8N_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "event_title": "Google for Startups Accelerator: AI First",
    "application_url": "https://startup.google.com/accelerator/ai",
    "slug": "google-ai-accelerator-2026",
    "vertical": "tech",
    "locale": "en-us",
    "title": "Google for Startups Accelerator Launches 2026 AI Cohort",
    "content": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "type": "text",
              "text": "Google has announced applications for its flagship AI-First founder cohort."
            }
          ]
        }
      ]
    },
    "opportunity_type": "accelerator",
    "funding_amount": "$350,000 Equity-Free Cloud Credits",
    "location": "Global (Remote & Hybrid)",
    "deadline_date": "2026-11-30T23:59:59Z"
  }'
```

---

## 8. n8n Workflow Node Setup

1. Add an **HTTP Request** node to your n8n workflow.
2. Configure settings:
   - **Method**: `POST`
   - **URL**: `https://www.startupcreme.com/api/events/webhook`
   - **Authentication**: `Generic Credential Type` -> `Header Auth`
     - **Name**: `Authorization`
     - **Value**: `Bearer {{ $env.N8N_WEBHOOK_SECRET }}`
   - **Send Body**: `JSON`
   - **Specify Body**: Map the scraped attributes to the JSON structure above.
3. Add an **IF** node checking `{{ $json.success }} === true`.
