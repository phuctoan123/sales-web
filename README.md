# Sales Web Portfolio

## Vercel deployment

The site is now a static, multi-page website designed for Vercel:

- Vietnamese pages use root paths such as `/`, `/dich-vu/` and `/tu-van/`.
- English pages use `/en/` and matching paths such as `/en/services/`.
- `/api/consultation` is a Vercel Node.js Function that stores leads in Supabase.
- `/admin/` is a static HTML/JS admin app that uses Supabase Auth and the anon key;
  the service role key is never sent to the browser.
- The final domain is intentionally not hard-coded yet. Add the production domain
  to `SITE_ORIGIN`, then add the absolute sitemap URL to `robots.txt` after the
  domain is connected.

## Architecture

- Public site: static HTML, `css/site.css` and `js/site.js`, with Vietnamese pages
  at the root and English pages under `/en/`.
- Lead API: `api/consultation.js` remains a CommonJS Vercel Function. It validates
  input, applies a small phone-based rate limit and writes to Supabase with the
  service role key. The admin app is the only lead destination.
- Admin: `admin/index.html`, `admin/admin.css`, `admin/admin.js` and
  `admin/config.js`. Supabase JS `2.49.8` is loaded from jsDelivr and all lead
  access is enforced by Supabase Auth + RLS.
- Database: `supabase/schema.sql` creates `leads`, `admins`, the lead status type,
  the `updated_at` trigger, admin check function, indexes and RLS policies.

### Form environment variables

Configure these variables in the Vercel project before enabling the form:

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `SITE_ORIGIN`.

The service role key is server-only and must not be included in frontend files.
The consultation flow does not send email; leads are stored in Supabase and read
from `/admin/`.

For the admin browser app, fill `admin/config.js` with the public Supabase values:

```js
export const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

The anon key is intended for the browser. Never place
`SUPABASE_SERVICE_ROLE_KEY` in `admin/config.js`, HTML, CSS or any other file
served to visitors. Local secrets belong in `.env`/`.env.local`; `.env` is ignored
by Git and `.env.example` contains only empty placeholders.

### Supabase schema

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor. It
creates the `leads` and `admins` tables, the lead status type, the updated-at
trigger, indexes and RLS policies. There are no anonymous client policies; the
Vercel API uses the service role key to insert leads.

After creating an administrator in Supabase Auth, add the Auth user ID to the
`admins` table from the SQL Editor:

```sql
insert into public.admins (user_id) values ('AUTH-USER-UUID-HERE');
```

The admin app checks the `is_admin()` database function after login. If the schema
was already run before the latest security update, rerun the function privilege
section from `supabase/schema.sql` so only authenticated users can execute it.

### Rate limiting

When Supabase is configured, the API allows at most three submissions for the same
phone value in a rolling ten-minute window. The check is performed server-side
with the service role and the indexed `phone, created_at` columns. It returns HTTP
429 when the limit is reached. If the lookup itself fails, the API logs only the
database error code and fails open so a temporary rate-limit query issue does not
discard a legitimate lead. This is a basic abuse guard, not a replacement for a
full IP/fingerprint-based WAF or CAPTCHA.

## Security notes

- `leads` has RLS enabled. Client roles have no INSERT/DELETE permission; only
  authenticated users confirmed by `admins` can SELECT or update the three admin
  fields: `status`, `internal_note` and `contacted_at`.
- The API origin check is enforced when `SITE_ORIGIN` is configured.
- Admin responses render lead data with DOM text nodes, not `innerHTML`.
- CSV cells beginning with `=`, `+`, `-` or `@` are prefixed before export.
- Admin responses receive `no-store`, `X-Robots-Tag` and a restrictive CSP from
  `vercel.json`; `robots.txt` also disallows `/admin/`.
- API logs contain operation/error codes only, not names, phone numbers or message
  content.

## Verification before go-live

Run the local checks from the project root:

```bash
node --check api/consultation.js
node --check admin/admin.js
node --check scripts/test-consultation.js
node scripts/test-consultation.js
node scripts/check-i18n.js
```

For a static UI smoke test, run `python -m http.server 4173` and open
`http://localhost:4173/admin/`. This serves the admin page but does not emulate
the Vercel API function; test the real form against a Vercel Preview deployment.

## Production checklist

- Create the Supabase project and configure Auth email/password sign-in.
- Run the complete `supabase/schema.sql` in the SQL Editor.
- Create the first Auth user and insert its UUID into `public.admins`.
- Fill `admin/config.js` with the project URL and anon key.
- Add Vercel variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
  `SITE_ORIGIN` without a trailing slash.
- Redeploy after changing environment variables.
- Enable 2FA for the Supabase/Vercel accounts and use a strong unique password.
- Test the real consultation form, DB row creation, admin login, RLS denial for a
  non-admin, status/note updates, `contacted_at`, CSV export and the 375px mobile
  layout.
- Confirm backups, domain/DNS, privacy-policy details and monitoring before
  accepting production leads.

## Adding or editing translations

Translations live in `js/lang/en.js` and `js/lang/vi.js`. Keep both dictionaries
with exactly the same nested key structure. Use section-based keys such as
`home.description`, `contact.title`, and `blog.cardTitle01`.

Use these HTML attributes for new content:

- `data-i18n` for plain text
- `data-i18n-html` for trusted HTML containing nested elements or line breaks
- `data-i18n-placeholder` for form placeholders
- `data-i18n-alt` for image alt text
- `data-i18n-title` for title attributes
- `data-i18n-aria` for accessible labels
- `data-i18n-meta` for metadata `content` values

Keep the English text in the HTML as the no-JavaScript fallback. After changing
keys, run:

```bash
node scripts/check-i18n.js
```

## Adding a new language

1. Add a dictionary file such as `js/lang/fr.js` using the same key set.
2. Register the language in `js/i18n.js` and load the dictionary on both pages.
3. Add a language button with `data-language="fr"` to both language controls.
4. Add the translated language labels and accessible switch descriptions.
5. Run the validator and test both `file://` and HTTP loading.
