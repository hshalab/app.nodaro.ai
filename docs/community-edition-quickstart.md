# Nodaro Community Edition Quickstart

5 steps to a running self-hosted Nodaro:

## 1. Create a Supabase project

Go to https://supabase.com and create a new project (free tier is fine for testing).

Copy these values from Project Settings:
- Project URL → `SUPABASE_URL`
- Service role key → `SUPABASE_SERVICE_ROLE_KEY`
- Anon key → `SUPABASE_ANON_KEY`

## 2. Apply database migrations

Run the SQL files in `supabase/migrations/` against your Supabase project, in
filename order, via the Supabase SQL editor or `supabase db push` if you have
the Supabase CLI linked.

## 3. Configure secrets

```bash
cp .env.example .env
echo "INTERNAL_ORCHESTRATOR_SECRET=$(openssl rand -hex 32)" >> .env
echo "SOCIAL_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
```

Then edit `.env` and fill in the Supabase values from step 1 plus at least one
AI provider key (KIE_API_KEY, REPLICATE_API_TOKEN, or ANTHROPIC_API_KEY).

## 4. Start the stack

```bash
docker compose -f docker-compose.community.yml up
```

Wait for `nodaro-1` to log `Server listening at http://0.0.0.0:9000` (backend), then visit http://localhost:3000.

Initial Docker build takes ~5-10 minutes (Node deps, Remotion bundling, frontend build). Subsequent boots are seconds.

## 5. Check your install: /setup

Open http://localhost:3000/setup — a live health screen for the install
(no login needed). It shows green/red status for each dependency:

- **Database** — Supabase reachable, and whether the migrations from step 2
  have been applied ("Migrations missing" is its own state)
- **Redis** — the job-queue backbone
- **Storage** — whether the `R2_*` vars are set and the bucket is reachable
- **Provider keys** — which AI provider keys the backend can see

The page polls every 5 seconds, so you can fix `.env`, restart the container,
and watch the cards flip green. The backing endpoint is
`GET /v1/setup/status` if you prefer curl.

## 6. Open the editor

http://localhost:3000

Sign up with an email + password (the Email provider is enabled by default
on Supabase projects; if your project requires email confirmation, check
your inbox after signing up). Google sign-in also works if you enable the
Google provider under Authentication → Providers in the Supabase dashboard —
it is optional.
The first user is a regular user; admin promotion is a manual SQL step (see
[Deployment → First user + admin promotion](deployment.md#4-first-user--admin-promotion)).
Note: the admin panel only exists in the Business and Cloud editions.

On your first visit the dashboard seeds a **Welcome Demo** workflow — a
finished script → image → video → voice → final-cut run with all results
pre-baked into the canvas, so you can explore real nodes and play the final
clip before configuring any provider key. When you are ready to generate,
edit the Scene Idea text and press Run on the Scene Image node (it defaults
to Z-Image, the cheapest and fastest image model).

## Storage

The compose file bundles **MinIO** — generated media is saved to a Docker
volume on your machine, with zero cloud accounts and zero configuration.
The bucket is created automatically on first boot, and the browser reads
media through the app itself (`/storage/...` — one origin for everything).

To use Cloudflare R2 instead, set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY` and `R2_PUBLIC_URL` in `.env`, and set `R2_ENDPOINT=`
and `R2_FORCE_PATH_STYLE=` (empty) to disable the MinIO defaults.

The default MinIO credentials in the compose file are fine for local play —
change them before exposing the stack to a network.

## Troubleshooting

- **Something red on /setup**: each failing card carries a hint naming the
  exact env vars to check.
- **CORS errors in browser**: set `CORS_ORIGIN=http://localhost:3000` in `.env`.
- **`Missing or invalid env vars` on startup**: check the error message lists
  the missing var; add it to `.env` and restart.
- **Storage errors on upload**: open the MinIO console at http://localhost:9001
  (or check your `R2_*` values if you switched to Cloudflare R2).
- **Need help?** Open an issue at https://github.com/nodaroai/app.nodaro.ai/issues.
