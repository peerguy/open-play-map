# Deployment Runbook

## Recommended Setup

- Storefront stays on Shopify at `scooppickleball.com`.
- Open Play Map deploys as its own app at `play.scooppickleball.com` or `map.scooppickleball.com`.
- Cloudflare Pages hosts the static frontend.
- Supabase owns auth, database, storage, moderation, credits, and admin permissions.

## Cloudflare Pages

1. Put `/Users/alex/Projects/open-play-map` in a GitHub repo.
2. In Cloudflare, go to Workers & Pages, create a Pages app, and import the GitHub repo.
3. Use:
   - Framework preset: None/static
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy the default Pages URL first.
5. Add `play.scooppickleball.com` as a custom domain.
6. Add the CNAME record Cloudflare asks for wherever DNS is managed.
7. Keep `_headers` in the repo so production security headers ship with each deploy.

## Analytics

- Enable Cloudflare Web Analytics from the Pages project Metrics tab for basic traffic and performance reporting. Cloudflare injects its pageview/performance beacon on the next deploy.
- Cloudflare Web Analytics does not currently support custom events, so the app also includes `src/analytics.js` as a first-party event layer.
- The local event layer tracks page views, store clicks, map searches, place searches, search suggestion selections, and location views.
- During prototype testing, recent events are kept in each browser under `localStorage` key `open-play-map-analytics-events`.
- For aggregated custom events, configure one later:
  - add a lightweight endpoint as `window.OPEN_PLAY_ANALYTICS_ENDPOINT`,
  - add Google Analytics `gtag`,
  - add Plausible,
  - add Fathom,
  - or move event writes into the future Supabase backend.

## Supabase

1. Create a Supabase project.
2. Install/use the Supabase CLI locally.
3. Link this repo to the Supabase project.
4. Apply migrations from `supabase/migrations`.
5. Enable email auth and set allowed redirect/site URLs:
   - `http://127.0.0.1:8080`
   - Cloudflare preview URL
   - `https://play.scooppickleball.com`
6. Create storage buckets for location photos and profile avatars.
7. Assign Alex/admin role server-side in the `profiles` table after first signup.

## App Refactor Order

1. Add a Supabase client module.
2. Replace local profile signup/login with Supabase Auth.
3. Replace `data/courts.json` reads with approved `locations` + `open_play_slots`.
4. Replace localStorage submissions/reviews/reports/suggested edits with database writes.
5. Move admin moderation to role-protected database reads/writes.
6. Move credits and monthly drawing logic to server-owned database actions.
7. Replace photo URL fields with Supabase Storage uploads.
8. Add tests for public map, auth, contribution flow, admin approval, and leaderboard.

## What I Can Do Without Alex

- Prepare the Cloudflare-ready static project files.
- Initialize or clean up the local Git repo.
- Draft and revise Supabase migrations, RLS policies, and seed/import scripts.
- Refactor the app locally to use Supabase once project URL/anon key are available.
- Write import scripts for `data/courts.json`.
- Add tests and run local verification.
- Draft deployment docs, launch checklist, privacy/rewards copy, and admin operating docs.

## What Needs Alex

- Cloudflare login/project creation if no API token is provided.
- Supabase login/project creation if no access token is provided.
- GitHub repo ownership decision and any private-repo access.
- DNS changes for `play.scooppickleball.com`.
- Shopify navigation update unless access is provided.
- Final legal/rewards terms for monthly paddle drawings.
- Production decisions: free vs paid Supabase plan, backup policy, and domain name.
