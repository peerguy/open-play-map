# Deployment Readiness

## Recommended Launch Shape

Use `play.scooppickleball.com` or `map.scooppickleball.com` for Open Play Map, keep `scooppickleball.com` on Shopify, and link the two properties both ways.

Recommended stack:

- Frontend hosting: Cloudflare Pages
- Backend/auth/database/storage: Supabase
- Storefront: existing Shopify site at `scooppickleball.com`

This keeps the store stable while giving the map room to behave like a real app with accounts, submissions, moderation, rewards, and uploaded photos.

## Why Not Ship The Current Prototype As-Is

The current app is a strong static prototype, but it is not production-trustworthy yet. Accounts, admin status, submissions, reviews, reports, suggested edits, credits, and monthly winners are stored in each browser's `localStorage`. That means users can edit their own data, fake credits, bypass moderation, or lose everything by clearing browser data.

For a public launch, the browser should only render UI and call authenticated backend APIs. The backend/database must own identity, permissions, credits, moderation state, and public location data.

## Shopify Tie-In

- Add a Shopify navigation item pointing to `play.scooppickleball.com`.
- Keep a visible `Scoop Store` link in the Open Play Map header back to `https://scooppickleball.com/`.
- Keep reward/prize copy branded as Scoop Pickleball, but make terms clear before launch.
- Consider a store landing section or blog page explaining the map and monthly paddle drawing.

## Required Before Live

1. Create a real backend data model.
   - `profiles`
   - `locations`
   - `open_play_slots`
   - `reviews`
   - `photos`
   - `reports`
   - `suggested_edits`
   - `credits`
   - `monthly_drawings`
   - `audit_events`

2. Replace local auth with real auth.
   - Status: first Supabase Auth migration is in place for signup, login, logout, session restore, profile rows, duplicate signup checks, and admin role checks.
   - Remaining: configure production redirect URLs, decide when to re-enable email confirmation for production, promote Alex's first real account to admin, and keep service-role/admin operations off the client.
   - Admin status is now a server-side `profiles.role`, not `username === "scoop"`.

3. Move permissions server-side.
   - Public users can read approved locations/reviews/photos.
   - Signed-in users can submit reviews, reports, photos, new locations, and suggested edits.
   - Admins can approve/reject/edit/delete.
   - Credits are only created by trusted backend actions after validation/moderation.

4. Add database security.
   - Enable Row Level Security.
   - Write policies for public reads, owner-scoped profile edits, user submissions, and admin-only moderation.
   - Keep service-role keys off the client.

5. Build moderation-safe contribution flows.
   - New locations should start pending.
   - Suggested edits should start pending.
   - Photo URLs should be replaced with real uploads or strict allowlisted URLs.
   - Reviews may be published immediately at first, but should be reportable and removable.

6. Lock down abuse controls.
   - Enforce daily limits on the backend.
   - Add rate limiting for submissions, reviews, reports, login, and place search.
   - Add bot protection for account creation and contribution forms.
   - Log suspicious/high-volume activity.

7. Make rewards legally and operationally clear.
   - Publish monthly drawing terms.
   - Define eligibility, geography, prize value, no-purchase language, odds, winner contact process, and reset rules.
   - Store immutable drawing/audit records.
   - Do the random draw server-side.

8. Replace prototype data loading.
   - Move `data/courts.json` into database seed/migration data.
   - Keep static JSON only as a fallback/demo fixture.
   - Add scripts for importing/exporting locations.

9. Add production configuration.
   - Use environment variables for Supabase URL/anon key and allowed origins.
   - Add separate dev/staging/prod projects or schemas.
   - Add `robots.txt`, sitemap, metadata, Open Graph images, and canonical URLs.

10. Add deploy/security headers.
   - HTTPS only.
   - Strict transport security.
   - Content security policy tuned for Leaflet, map tiles, Supabase, and image uploads.
   - `X-Content-Type-Options`, `Referrer-Policy`, and appropriate permissions policy.

11. Improve reliability and observability.
   - Add basic automated tests for auth state, submit/review/suggest-edit, admin approve/reject, leaderboard, and mobile layout.
   - Add error monitoring.
   - Add analytics for map searches, location views, submissions, and store clicks.
   - Add backup/restore plan for the database.

12. Deployment workflow.
   - Put app code in a GitHub repo.
   - Deploy previews for every branch/PR.
   - Require production deploys from `main`.
   - Add a staging URL before cutting over the custom subdomain.

## DNS / Launch Steps

1. Create the Cloudflare Pages project from the repo.
2. Set production branch to `main`.
3. Add custom domain `play.scooppickleball.com` or `map.scooppickleball.com`.
4. Add the required CNAME at the DNS provider.
5. Add the same URL to Supabase allowed redirect/site URLs.
6. Add a Shopify nav item linking to the app.
7. Smoke-test the public URL on desktop and phone.

## Minimum Acceptable Launch Scope

If speed matters, launch the map as read-only first:

- Static public map on Cloudflare Pages.
- Header link back to Scoop Store.
- No public account creation.
- No public credits/drawings.
- "Submit a location" routes to a simple external form or disabled waitlist.

Then ship real accounts, submissions, moderation, and rewards once the Supabase backend is ready.
