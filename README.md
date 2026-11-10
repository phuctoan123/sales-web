# Sales Web Portfolio

## Vercel deployment

The site is now a static, multi-page website designed for Vercel:

- Vietnamese pages use root paths such as `/`, `/dich-vu/` and `/tu-van/`.
- English pages use `/en/` and matching paths such as `/en/services/`.
- `/api/consultation` is a Vercel Node.js Function that sends leads through Resend.
- The final domain is intentionally not hard-coded yet. Add the production domain
  to `SITE_ORIGIN`, then add the absolute sitemap URL to `robots.txt` after the
  domain is connected.

### Form environment variables

Configure these variables in the Vercel project before enabling the form:

`RESEND_API_KEY`, `LEAD_EMAIL`, `FROM_EMAIL`, and optionally `SITE_ORIGIN`.

To store consultation leads in Supabase, also configure `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The service role key is server-only and must not be
included in frontend files.

`FROM_EMAIL` must be an address allowed by the email provider. Preview deployments
remain suitable for QA; configure the production domain and email sender before
accepting real leads.

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
