# Meoksa

Next.js App Router app for the Meoksa MVP. The UI and API run together on
`http://localhost:3000`.

## Stack

- TypeScript
- Node.js
- Next.js
- Supabase Auth
- Supabase Postgres + PostGIS

## MVP Modules

- Login: Supabase Auth token verification through `GET /api/auth/me`
- Onboarding: guardian profile, new dog profile, and invite-code join
- Dog profiles: profile creation and invite-code based guardian join
- Walk route recommendations: AI-ready recommendation endpoint
- Walk records: GPS walk start, finish, review, and calendar history
- Care: shared walk/feed/medicine checklist for co-guardians

## Scripts

```bash
npm.cmd install
npm.cmd run dev
npm.cmd run breeds:generate
npm.cmd run check
npm.cmd run check:jobs
npm.cmd run db:check
npm.cmd run build
npm.cmd run start
```

## Teammate setup

Use this when pulling this branch into another local copy for feature merge work.

```bash
git fetch origin
git switch -c merge-meoksa origin/backend_jiwon_share
npm.cmd install
copy .env.example .env
```

Fill `.env` with the shared local values. The real `.env` and `.env.local` files
are intentionally not committed.

Required for normal app/API work:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `KAKAO_MAP_APP_KEY`

Required for walk recommendation/demo quality:

- `GRAPHHOPPER_URL=http://localhost:8989`
- local GraphHopper instance running with the project's custom foot profile
- `PUBLIC_DATA_API_KEY`
- `TMAP_APP_KEY`
- `VWORLD_API_KEY`
- recommendation seed/ingest data loaded into Supabase

Optional:

- `OPENAI_API_KEY`
- `KAKAO_REST_API_KEY`

After filling `.env`, run:

```bash
npm.cmd run check
npm.cmd run check:jobs
npm.cmd run db:check
npm.cmd run dev
```

Current app entry:

```text
app/page.tsx -> app/main/main-tab.tsx
```

## API

- `GET /health`
- `GET /api`
- `POST /api/auth/signup`
- `POST /api/auth/verify-email`
- `POST /api/auth/login`
- `POST /api/auth/resend-verification`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `DELETE /api/auth/account`
- `GET /api/onboarding/options`
- `GET /api/onboarding/status`
- `GET /api/onboarding/debug-db`
- `PUT /api/onboarding/guardian-profile`
- `POST /api/onboarding/dogs`
- `POST /api/onboarding/join`
- `GET /api/dogs/breeds`
- `GET /api/dogs`
- `POST /api/dogs`
- `POST /api/dogs/join`
- `POST /api/walk-routes/recommendations`
- `GET /api/walk-records`
- `POST /api/walk-records/start`
- `PATCH /api/walk-records/:walkRecordId/finish`
- `GET /api/care/today`
- `PATCH /api/care/tasks/:taskId`
- `POST /api/care/nudges`

## Environment

Copy `.env.example` to `.env` and fill in the shared local values. Do not commit
`.env`, `.env.local`, or raw secrets.

## Database

Run these files in the Supabase SQL Editor, in order, after creating a project.

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_onboarding_survey_consent.sql`
3. `supabase/migrations/0003_walk_recommendation.sql`
4. `supabase/migrations/0004_bearing_grid_function.sql`
5. `supabase/migrations/0005_park_polygon_lookup.sql`
6. `supabase/migrations/0006_score_route_candidates.sql`
7. `supabase/migrations/0007_road_overlay_matching.sql`
8. `supabase/migrations/0008_bearing_grid_index_fix.sql`
9. `supabase/migrations/0009_scoring_index_fix.sql`
10. `supabase/migrations/0010_walk_records_route_geojson.sql`
11. `supabase/migrations/0011_care_recurring_routines.sql`
12. `supabase/migrations/0012_walk_records_recommended_course.sql`
13. `supabase/dog_breeds_seed.sql`

Every migration is idempotent, so re-running one is safe.

### Checking that the database matches the code

```bash
npm.cmd run db:check
```

This compares every table and column the code uses against the live database and
prints exactly which SQL file to run when something is missing. The same check
runs automatically on `npm run dev` / `npm start` and prints its result right
after the "API server listening" line.

### Adding a column or table

`0001_init.sql` uses `create table if not exists`, which means **editing it does
nothing to a database whose tables already exist**. Adding a column there and
expecting it to appear in Supabase is the one mistake that silently breaks the
API with `column ... does not exist` errors. Instead:

1. Add a new numbered file, for example
   `supabase/migrations/0003_walk_goals.sql`, using
   `alter table ... add column if not exists ...`.
2. Add the new columns to `expectedSchema` in `src/lib/schema-check.ts`, pointing
   at that new file.
3. Run the file in the Supabase SQL Editor.
4. Confirm with `npm.cmd run db:check`.

Also mirror the change in `0001_init.sql` so that a brand-new project still gets
the full schema from step 1.

## Frontend

**The UI lives in `app/` and nowhere else.** It is the Next.js App Router
frontend, served by the same `npm.cmd run dev` as the API — there is no separate
frontend project and no separate port.

```
app/page.tsx  →  app/meoksa-app.tsx  →  app/walk-recorder-panel-next.tsx
```

Local URL: `http://localhost:3000`

Two earlier UIs were deleted on 2026-08-12 because having three copies of the
same screens meant edits kept landing in the copy that wasn't running: a Vite
React app in `frontend/` and an older `app/walk-recorder-panel.tsx`. If you find
yourself building a new UI surface rather than editing `app/`, delete the old one
in the same change instead of leaving both.

`public/demo.html` is a standalone Leaflet demo page kept only for the
walk-recommendation demo; it is not part of the product UI.

## Email Verification

The current MVP uses Supabase's default email link verification flow.
After signup, users click the `Confirm email address` link and return to
`/auth/callback`.
