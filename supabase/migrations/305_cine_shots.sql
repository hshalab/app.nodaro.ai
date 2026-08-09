-- Cine shots — the Share → Remix record (Cine prerequisite #4).
--
-- A small read-mostly row persisting a Cine builder state: picker selections,
-- prompts, chosen models, and @-mention entity refs — so a /s/:id link can
-- hydrate the builder for remixing. Reuse was evaluated first (spec
-- backend-share-remix.md): published_apps carries app/slug/workflow semantics,
-- projects is a private-RLS workspace table — neither fits a public-by-id
-- capability read, so this dedicated table.
--
-- visibility DEFAULTS TO PRIVATE (product decision 2026-08-09): sharing is an
-- explicit "make shareable" action, after which anyone with the id can read.

CREATE TABLE IF NOT EXISTS cine_shots (
  -- Opaque URL-safe id (server-generated, base64url) — the capability token
  -- in /s/:id links. TEXT (not uuid) so ids stay short and copy-friendly.
  id TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'single'
    CHECK (mode IN ('single', 'multi-shot', 'frame-to-motion', 'storyboard')),
  -- The builder's picker selections, verbatim ({ pickerNodeType -> valueId |
  -- { field: valueId } }) so hydration is lossless.
  selection_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  free_text TEXT,
  negative_prompt TEXT,
  assembled_prompt TEXT,
  -- Optional caches so the share page renders without recomputing.
  per_model_prompts JSONB,
  models JSONB,
  -- @-mention bindings ({ entitySlug, variantSlug, role }...) so a remix
  -- re-resolves the same references.
  entity_refs JSONB,
  -- Already-public asset URLs only (no signed URLs) — enforced at the route.
  result_urls JSONB,
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'public')),
  -- Hydrators tolerate old records: bump when the selection-state shape
  -- changes so clients can skip-with-note instead of crashing.
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cine_shots_owner ON cine_shots(owner_id, created_at DESC);

ALTER TABLE cine_shots ENABLE ROW LEVEL SECURITY;

-- Owner: full control.
CREATE POLICY cine_shots_owner_all ON cine_shots
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Anyone (incl. anonymous): read shots the owner explicitly made public.
-- The id is the capability — there is no listing surface.
CREATE POLICY cine_shots_public_read ON cine_shots
  FOR SELECT USING (visibility = 'public');
