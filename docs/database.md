# Database Reference & Schema Migrations

This document details the PostgreSQL database schema, indexes, triggers, and Row Level Security (RLS) policies for StartupCrème, hosted on Supabase.

---

## 📋 SQL Script: Newsletter Table (`newsletter_subscribers`)

Below is the standalone SQL DDL script to create the database table for newsletter subscriptions in the `startupcreme` schema:

```sql
-- Create UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Custom Database Schema
CREATE SCHEMA IF NOT EXISTS startupcreme;

-- Table: newsletter_subscribers
CREATE TABLE IF NOT EXISTS startupcreme.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    source TEXT DEFAULT 'footer',
    vertical TEXT DEFAULT 'all',
    locale TEXT DEFAULT 'en-us',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for speedy filtering and uniqueness
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON startupcreme.newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON startupcreme.newsletter_subscribers(status);

-- Enable Row Level Security (RLS)
ALTER TABLE startupcreme.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow public & authenticated users to subscribe
CREATE POLICY "Allow public newsletter subscription"
    ON startupcreme.newsletter_subscribers
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

-- Allow admins full access to subscriber lists
CREATE POLICY "Allow admin full access to newsletter subscribers"
    ON startupcreme.newsletter_subscribers
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM startupcreme.users
            WHERE startupcreme.users.id = auth.uid()
            AND startupcreme.users.role = 'admin'
        )
    );
```

---

## 🗄️ Full Database Schema

The full application migration script is stored in [`/supabase/schema.sql`](../supabase/schema.sql) and includes:

1. **`newsletter_subscribers`**: Email subscriptions with source tracking and locale filters.
2. **`users`**: RBAC user accounts (`admin`, `moderator`, `user`) with reputation scoring and custom badges.
3. **`posts`**: Editorial articles categorized into `finance` or `tech` silos with `dual_silo` flags and localization parameters.
4. **`discussion_topics`**: Community forum topics with category tags, upvote metrics, and author references.
5. **`discussion_comments`**: Nested discussion thread comments supporting parent-child hierarchy.
6. **`topic_votes`**: Unique user votes enforced by unique compound constraints `(topic_id, user_id)`.

---

## 🔐 Row Level Security (RLS) Summary

| Table | Operation | Target Role | Policy Condition |
| :--- | :--- | :--- | :--- |
| `newsletter_subscribers` | INSERT | anon, authenticated | Open insert with email format validation |
| `newsletter_subscribers` | ALL | admin | Admin role check on `users` table |
| `posts` | SELECT | anon, authenticated | `status = 'published'` |
| `posts` | ALL | admin | Admin role check |
| `discussion_topics` | INSERT | authenticated | `auth.uid() = author_id` |
| `discussion_topics` | DELETE | author, moderator, admin | Author check or moderator/admin role check |
| `topic_votes` | ALL | authenticated | `auth.uid() = user_id` |
