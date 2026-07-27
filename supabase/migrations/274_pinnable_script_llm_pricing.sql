-- 274_pinnable_script_llm_pricing.sql
-- Seed model_pricing rows for the film-pipeline PINNABLE SCRIPT LLM ids
-- (PIPELINE_PINNABLE_SCRIPT_LLMS in packages/shared/src/pipeline-types.ts).
--
-- Why these bare model ids need rows at all: create-pipeline.ts's tier guard
-- calls CreditsService.checkCreditsWithProfile with each pinned id verbatim —
-- image models, video models, AND the script LLM. The image/video ids have
-- always been priced, so the guard worked for them; the script LLM ids never
-- were. That path resolves through getModelCreditBaseCost, and the 2026-05
-- hard-fail policy THROWS PriceNotConfiguredError on an unconfigured
-- identifier, so pinning a Script LLM returned a 500 instead of a pipeline.
--
-- Gate-only values: this identifier is never deducted. The pin check reads it
-- for is_enabled / tier_restriction / balance gating only; the script stage's
-- real charge rides the generate-script + llm-chat feature identifiers and
-- their :economy/:premium tier composites. Values mirror the LLM band already
-- used there (economy 1 / standard 2 / premium 3) and are derived in code from
-- each model's registry tier (PINNABLE_SCRIPT_LLM_STATIC in ee/billing/credits.ts)
-- — keep the two in step; hard-fail-coverage.test.ts fails CI if an id is missing.
--
-- ON CONFLICT DO NOTHING preserves any admin overrides set via /admin/models.
INSERT INTO public.model_pricing (model_identifier, credit_cost, is_enabled, category)
VALUES
  ('claude-haiku-4-5',   1, true, 'other'),  -- economy tier
  ('claude-sonnet-4-6',  2, true, 'other'),  -- standard tier
  ('claude-opus-4-7',    3, true, 'other'),  -- premium tier
  ('claude-opus-5',      3, true, 'other')   -- premium tier
ON CONFLICT (model_identifier) DO NOTHING;
