-- Add the `smart` analysis tier and reprice the existing tiers downward.
--
-- TWO SEPARATE CHANGES, deliberately in one migration because they are one
-- product decision:
--
-- 1. The existing tiers move to the cheaper serving transport and the cheaper
--    model generation. That transport bills 3-4x less per token AND does no deep
--    reasoning, so its passes emit roughly a quarter of the output tokens — the
--    two together are why these rows fall by 10-18x. They are also less
--    accurate, which is the trade being made deliberately: several cheap passes
--    with a grader picking between them, rather than one expensive good one.
--
-- 2. `smart` is new: a single pass on the native transport with reasoning and
--    frame sampling turned all the way up. It is the only tier whose accuracy
--    was measured against a hand-counted edit list, and the only one that does
--    not depend on voting to be usable.
--
-- The measured shot-boundary detector is no longer used by ANY tier. It was
-- over-reporting by 60% on real footage (29 shots against a hand-counted 18)
-- because it read periodic motion as edits, and feeding those phantom
-- boundaries made a pass exhaust its whole output budget describing shots that
-- do not exist. That removal is a quality fix for every tier, not just `smart`.
--
-- The bare `video-analysis` row tracks the table MAXIMUM (see migration 277): it
-- is the unknown-model AND unknown-duration fallback feeding a pre-run balance
-- gate, so it must bound every row — which now means tracking `smart`.
--
-- `mixed-fast` deliberately gets NO rows: it shares the `mixed` credit family
-- (videoAnalysisCreditSegment folds them), so its colon ids are never built and
-- would be dead rows. The credit-pricing-migration-sync guard catches them.
--
-- Idempotent + convergent, matching 275/276/277/279.
--
-- Numbered 283: 282 was taken by 282_jobs_source_provenance.sql, which landed on
-- dev after this branch was cut. A local uniqueness check cannot see that — only
-- the CI run against the merge can, which is exactly how it was caught.
-- Re-check against origin/dev, not the working tree, before picking a number.
INSERT INTO public.model_pricing (model_identifier, credit_cost, is_enabled, category)
VALUES
  ('video-analysis:gemini-3-flash:60s', 3, true, 'other'),
  ('video-analysis:gemini-3-flash:180s', 4, true, 'other'),
  ('video-analysis:gemini-3-flash:360s', 9, true, 'other'),
  ('video-analysis:gemini-3-flash:600s', 14, true, 'other'),
  ('video-analysis:gemini-3-flash', 14, true, 'other'),
  ('video-analysis:gemini-3.6-flash:60s', 7, true, 'other'),
  ('video-analysis:gemini-3.6-flash:180s', 9, true, 'other'),
  ('video-analysis:gemini-3.6-flash:360s', 23, true, 'other'),
  ('video-analysis:gemini-3.6-flash:600s', 38, true, 'other'),
  ('video-analysis:gemini-3.6-flash', 38, true, 'other'),
  ('video-analysis:gemini-3.1-pro:60s', 9, true, 'other'),
  ('video-analysis:gemini-3.1-pro:180s', 12, true, 'other'),
  ('video-analysis:gemini-3.1-pro:360s', 30, true, 'other'),
  ('video-analysis:gemini-3.1-pro:600s', 49, true, 'other'),
  ('video-analysis:gemini-3.1-pro', 49, true, 'other'),
  ('video-analysis:mixed:60s', 11, true, 'other'),
  ('video-analysis:mixed:180s', 15, true, 'other'),
  ('video-analysis:mixed:360s', 38, true, 'other'),
  ('video-analysis:mixed:600s', 63, true, 'other'),
  ('video-analysis:mixed', 63, true, 'other'),
  ('video-analysis:smart:60s', 42, true, 'other'),
  ('video-analysis:smart:180s', 94, true, 'other'),
  ('video-analysis:smart:360s', 207, true, 'other'),
  ('video-analysis:smart:600s', 346, true, 'other'),
  ('video-analysis:smart', 346, true, 'other'),
  ('video-analysis', 346, true, 'other')
ON CONFLICT (model_identifier) DO UPDATE
  SET credit_cost = EXCLUDED.credit_cost,
      is_enabled  = EXCLUDED.is_enabled;
