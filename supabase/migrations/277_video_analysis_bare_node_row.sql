-- Reprice the BARE `video-analysis` node-type row.
--
-- Migration 247 seeded it at 3 credits with the comment "= flash 600s", which was
-- true then. Every reprice since -- 248, 259, 273, 275, 276 -- matched only
-- `video-analysis:` COLON ids, so this row was never carried along and its own
-- stated invariant has been false for five repricings. It is not decoration: the
-- frontend's `getModelIdentifier` has no video-analysis branch, so it falls through
-- to `return nodeType` and the run-credits estimate looks up this exact row, while
-- a real run reserves 21-200. A pre-run balance check can therefore wave through a
-- run the reservation then rejects.
--
-- 200 = the MAXIMUM of the whole bucket table (`mixed` at 600s). The obvious
-- candidate was the default tier at the ceiling bucket -- what
-- STATIC_CREDIT_COSTS["video-analysis"] computes -- but a guard added alongside
-- this migration showed that is 120 and `mixed:600s` is 200, so the "default at
-- the ceiling" value is itself an under-quote for the priciest tier. This id is
-- reached only when BOTH the model and the duration are unknown, so it must bound
-- every row: an unknown-duration estimate has to over-quote, never under-quote, or
-- the gate it feeds stops protecting anything.
--
-- Idempotent + convergent (DO UPDATE), matching the house style of 275/276.
INSERT INTO public.model_pricing (model_identifier, credit_cost, is_enabled, category)
VALUES ('video-analysis', 200, true, 'other')
ON CONFLICT (model_identifier) DO UPDATE
  SET credit_cost = EXCLUDED.credit_cost,
      is_enabled  = EXCLUDED.is_enabled;
