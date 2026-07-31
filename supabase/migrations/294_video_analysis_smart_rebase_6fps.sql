-- video-analysis schedule re-derived: smart tier re-based, measured constants trued-up.
--
-- The smart tier's frame-sampling rate moved 24 -> 6 fps after a 43-run
-- measurement campaign (2026-07-31) found 6 fps equal on content quality
-- (visual density, audio layers, subtitle capture) and strictly better on
-- cast stability, at well under half the provider spend. 24 fps was also
-- silently hitting a provider-side media-token clamp past ~57s of footage,
-- so part of the modelled input spend was never actually billed by the
-- provider. At the same time the analyzer's system-prompt and per-window
-- output-token figures were re-measured directly from provider usage
-- metadata (the prompt had grown ~27% across doctrine additions since the
-- last measurement; dense-edit clips emit more output than the reference
-- clip the old figure came from).
--
-- Net effect, per bucket:
--
--   smart:60s    454 ->  333     gemini-3.6-flash:60s    61 ->  65
--   smart:180s   975 ->  470     gemini-3.6-flash:180s   88 ->  92
--   smart:360s  2105 -> 1135     gemini-3.6-flash:360s  224 -> 237
--   smart:600s  3496 -> 1868     gemini-3.6-flash:600s  374 -> 395
--
--   mixed and the per-model economy rows move +3-6% from the prompt true-up;
--   smart drops 27-47%. Bare ids follow their family's 600s (ceiling) bucket;
--   the bare `video-analysis` id is the MAX of the whole table.
--
-- Values taken from the plugin's own generator, not computed here. The
-- plugin's cost test cross-checks every row, sentinels included.

BEGIN;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis', 1868)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3-flash', 143)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3-flash:60s', 24)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3-flash:180s', 33)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3-flash:360s', 86)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3-flash:600s', 143)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.6-flash', 395)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.6-flash:60s', 65)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.6-flash:180s', 92)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.6-flash:360s', 237)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.6-flash:600s', 395)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.1-pro', 509)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.1-pro:60s', 87)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.1-pro:180s', 116)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.1-pro:360s', 305)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.1-pro:600s', 509)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed', 651)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:60s', 110)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:180s', 149)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:360s', 390)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:600s', 651)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart', 1868)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:60s', 333)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:180s', 470)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:360s', 1135)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:600s', 1868)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

COMMIT;
