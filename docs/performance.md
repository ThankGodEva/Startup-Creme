# Performance & Optimization Guidelines

---

## ⚡ Indexing Strategy

1. **`idx_posts_vertical_locale_status`**: Composite index on `(vertical, locale, status)` for fast filtering in vertical pages.
2. **`idx_discussion_topics_category_created`**: Index on `(category, created_at DESC)` for forum category sorting.
3. **`idx_discussion_comments_topic_parent`**: Index on `(topic_id, parent_id)` for nested comment tree retrieval.
4. **`idx_newsletter_email`**: Unique index on `newsletter_subscribers(email)` for upsert query execution.

---

## 🖼️ Visual Asset & Font Optimization

- High-contrast typography paired with Playfair Display for headings and Plus Jakarta Sans for body copy.
- Unsplash CDN images with explicit width/height boundaries to prevent Layout Shifts (CLS).
- Tailwind CSS v4 utility classes compiled via Vite for minimal CSS bundle payload.
