# Troubleshooting & FAQ

---

## ❓ Common Issues & Resolutions

### 1. Newsletter Form Submissions Not Appearing in Supabase
- **Cause**: Supabase credentials (`SUPABASE_URL` and `SUPABASE_ANON_KEY`) are missing or invalid.
- **Resolution**: Check `.env` and run `/supabase/schema.sql` in Supabase SQL Editor. The store will fallback to `localStorage` key `startupcreme_newsletter_subscribers` while unconfigured.

### 2. Admin Dashboard Displaying "Access Restricted"
- **Cause**: Current logged-in active user does not have the `admin` role.
- **Resolution**: In demo mode, click **"Switch Active Role to Admin (Demo)"** or assign `role = 'admin'` in the `users` database table.

### 3. Build or TypeScript Compile Failure
- **Resolution**: Run `npm run lint` or `compile_applet` to check for type mismatch errors.
