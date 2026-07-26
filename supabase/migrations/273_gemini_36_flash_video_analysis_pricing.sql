-- 273_gemini_36_flash_video_analysis_pricing.sql
-- The video-analysis FAST tier's backing model moves gemini-3-flash →
-- gemini-3.6-flash (VIDEO_ANALYSIS_TIERS in packages/shared/src/llm-models.ts).
-- KIE bills 3.6 Flash at $0.45/$2.25 per M tokens (3× the 3-flash rate), so the
-- formula (videoAnalysisBucketCredits, private plugin) emits a higher schedule:
--   gemini-3.6-flash → 60s 2 · 180s 2 · 360s 5 · 600s 9   (bare id = 600s ceiling)
-- Still ≤ pro (2/3/7/11) in every bucket.
--
-- The legacy gemini-3-flash rows are DELIBERATELY untouched: stored raw-model
-- configs keep resolving through the passthrough in resolveVideoAnalysisModel
-- and keep pricing under their original identifiers.
--
-- ON CONFLICT DO NOTHING preserves any admin overrides set via /admin/models.
INSERT INTO public.model_pricing (model_identifier, credit_cost, is_enabled, category)
VALUES
  ('video-analysis:gemini-3.6-flash',       9, true, 'other'),  -- unknown-duration ceiling (600s)
  ('video-analysis:gemini-3.6-flash:60s',   2, true, 'other'),  -- 1-min bucket
  ('video-analysis:gemini-3.6-flash:180s',  2, true, 'other'),  -- 3-min bucket
  ('video-analysis:gemini-3.6-flash:360s',  5, true, 'other'),  -- 6-min bucket
  ('video-analysis:gemini-3.6-flash:600s',  9, true, 'other')   -- 10-min ceiling
ON CONFLICT (model_identifier) DO NOTHING;
