-- 276_video_analysis_direct_lane_reprice.sql
--
-- CONVERGENCE MIGRATION — video-analysis moved to the direct Google lane, but
-- its prices were still derived from the aggregator's resale rates.
--
-- As of 2026-07-28 the node is pinned to Google's own API with NO fallback
-- (`requireLane: "direct"`, defaulted in the plugin toolkit's multimodal path).
-- That was a deliberate quality decision: the aggregator reaches Gemini by
-- smuggling media URLs through an `image_url` field rather than sending real
-- media parts, so a fallback would return differently-grounded analysis with
-- nothing to signal it. But the credit schedule was generated against those
-- aggregator rates, which sat at roughly 30% of Google list — so every
-- analysis job has been priced against a lane it can no longer reach.
--
-- These rows are the regenerated output of the private formula
-- (`videoAnalysisBucketCredits` in @nodaroai/cloud-plugins) after its rate
-- table was corrected to Google list. Never hand-write these values — they are
-- structural output, and the formula's own cross-check test fails on drift.
--
-- The increase is ~3.3-3.6x across the board and is a real cost pass-through,
-- not a margin change: SAFETY stays at 2 and USD_PER_CREDIT at 0.02, exactly
-- as before. What changed is the price of the tokens.
--
--   gemini-3-flash     2·3·6·9     ->  6·7·18·30
--   gemini-3.6-flash   5·6·15·25   ->  14·19·49·81
--   gemini-3.1-pro     6·8·20·33   ->  21·27·72·120
--   mixed              10·13·35·57 ->  34·46·120·200
--
-- Gemini 3.1 Pro's >200k-prompt band ($4/$18) is deliberately NOT modelled:
-- each window is its own provider call at ~150s of footage, far below the
-- threshold. The formula sums the whole roll only to price it.
--
-- DO UPDATE, not DO NOTHING: every one of these rows already exists from
-- migrations 247/248/259/273/275, so DO NOTHING would leave the stale prices
-- in place and silently accomplish nothing. The cost is that a deliberate
-- admin override set via /admin/models on THESE identifiers is overwritten —
-- re-apply any such override after deploy.
INSERT INTO public.model_pricing (model_identifier, credit_cost, is_enabled, category)
VALUES
  -- Legacy fast tier (stored raw-id configs still resolve here).
  ('video-analysis:gemini-3-flash',          30, true, 'other'),  -- unknown-duration ceiling (600s)
  ('video-analysis:gemini-3-flash:60s',       6, true, 'other'),
  ('video-analysis:gemini-3-flash:180s',      7, true, 'other'),
  ('video-analysis:gemini-3-flash:360s',     18, true, 'other'),
  ('video-analysis:gemini-3-flash:600s',     30, true, 'other'),
  -- Current fast tier.
  ('video-analysis:gemini-3.6-flash',        81, true, 'other'),  -- unknown-duration ceiling (600s)
  ('video-analysis:gemini-3.6-flash:60s',    14, true, 'other'),
  ('video-analysis:gemini-3.6-flash:180s',   19, true, 'other'),
  ('video-analysis:gemini-3.6-flash:360s',   49, true, 'other'),
  ('video-analysis:gemini-3.6-flash:600s',   81, true, 'other'),
  -- Pro tier.
  ('video-analysis:gemini-3.1-pro',         120, true, 'other'),  -- unknown-duration ceiling (600s)
  ('video-analysis:gemini-3.1-pro:60s',      21, true, 'other'),
  ('video-analysis:gemini-3.1-pro:180s',     27, true, 'other'),
  ('video-analysis:gemini-3.1-pro:360s',     72, true, 'other'),
  ('video-analysis:gemini-3.1-pro:600s',    120, true, 'other'),
  -- Mixed family — `mixed` and `mixed-fast` share this one segment.
  ('video-analysis:mixed',                  200, true, 'other'),  -- unknown-duration ceiling (600s)
  ('video-analysis:mixed:60s',               34, true, 'other'),
  ('video-analysis:mixed:180s',              46, true, 'other'),
  ('video-analysis:mixed:360s',             120, true, 'other'),
  ('video-analysis:mixed:600s',             200, true, 'other')
ON CONFLICT (model_identifier) DO UPDATE
  SET credit_cost = EXCLUDED.credit_cost,
      is_enabled  = EXCLUDED.is_enabled;
