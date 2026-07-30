-- video-analysis SENTINEL tiers re-derived (mixed:*, smart:* and their bare ids).
--
-- Migration 292 re-derived the 12 per-model buckets but left the 8 sentinel
-- buckets as the mechanical x10 from 290/291, on the reasoning that the
-- sentinels "are not part of the plugin's cross-check loop". That reasoning was
-- wrong: sitting outside the loop makes a row UNGUARDED, not exempt.
-- `videoAnalysisBucketCredits` computes the sentinels from the same roll plan as
-- every other row, so they are formula-derived too — and a formula that ceils
-- USD does not commute with scaling.
--
-- Net effect: these 11 ids were over-charging between 0.1% and 5.8%.
--
--   mixed:60s   110 -> 104     smart:60s    460 -> 454
--   mixed:180s  150 -> 142     smart:180s   980 -> 975
--   mixed:360s  380 -> 372     smart:360s  2110 -> 2105
--   mixed:600s  630 -> 621     smart:600s  3500 -> 3496
--
-- Bare ids follow their family's 600s (ceiling) bucket, and the bare
-- `video-analysis` id is the MAX of the whole table:
--
--   video-analysis  3500 -> 3496    mixed  630 -> 621    smart  3500 -> 3496
--
-- Values taken from the plugin's own generator, not computed here. The plugin's
-- cost test now covers sentinel tiers, so this cannot silently drift again.

BEGIN;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis', 3496)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed', 621)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:60s', 104)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:180s', 142)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:360s', 372)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:600s', 621)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart', 3496)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:60s', 454)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:180s', 975)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:360s', 2105)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:600s', 3496)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

COMMIT;
