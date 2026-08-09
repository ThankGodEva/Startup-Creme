# API Schemas & Input Validation

All data mutations in StartupCrème undergo validation using Zod schemas located in [`/src/lib/validation.ts`](../src/lib/validation.ts) and sanitization through character entity escaping.

---

## 📩 Newsletter Subscription Payload Schema

### Zod Definition
```typescript
import { z } from 'zod';

export const NewsletterSubscriptionSchema = z.object({
  email: z.string().email('Please enter a valid email address').toLowerCase().trim(),
  source: z.string().optional().default('footer'),
  vertical: z.enum(['all', 'finance', 'tech']).optional().default('all'),
  locale: z.string().optional().default('en-us'),
});
```

### JSON Example
```json
{
  "email": "subscriber@vc-fund.com",
  "source": "footer",
  "vertical": "all",
  "locale": "en-us"
}
```

---

## ✍️ Editorial Post Schema

### Zod Definition
```typescript
export const PostSchema = z.object({
  title: z.string().min(5).max(200),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().min(10).max(500),
  content: z.string().min(20),
  vertical: z.enum(['finance', 'tech']),
  locale: z.string().min(2).max(10),
  cover_image: z.string().url().or(z.literal('')),
  status: z.enum(['draft', 'published', 'archived']),
  dual_silo: z.boolean().optional().default(false),
});
```

---

## 🧹 Sanitization Logic

All string fields rendered in public views pass through `sanitizeHtmlText()` to neutralize potential XSS vectors:

```typescript
export function sanitizeHtmlText(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
```
