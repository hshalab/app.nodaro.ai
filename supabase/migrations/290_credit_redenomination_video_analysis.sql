-- video-analysis pricing for the credit re-denomination.
--
-- Migration 288 deliberately skipped these rows (`formula-plugin` basis) because
-- the cloud plugin owns the FORMULA that generates them. But model_pricing is
-- what users are actually charged from, and getModelCreditBaseCost takes the DB
-- row verbatim — so leaving them un-scaled billed video-analysis at a TENTH of
-- its intended price while every other model had re-denominated.
--
-- Values mirror VIDEO_ANALYSIS_BUCKET_CREDITS in @nodaro/shared, which the
-- plugin's own table must equal (CI cross-check). The plugin reproduces these
-- once its USD_PER_CREDIT flips; seeding them here closes the gap immediately
-- rather than waiting on the plugin release (design §8 ordering: app first).

BEGIN;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis', 3500)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3-flash:60s', 30)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3-flash:180s', 40)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3-flash:360s', 90)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3-flash:600s', 140)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.6-flash:60s', 70)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.6-flash:180s', 90)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.6-flash:360s', 230)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.6-flash:600s', 380)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.1-pro:60s', 90)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.1-pro:180s', 120)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.1-pro:360s', 300)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:gemini-3.1-pro:600s', 490)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:60s', 110)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:180s', 150)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:360s', 380)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:mixed:600s', 630)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:60s', 460)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:180s', 980)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:360s', 2110)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('video-analysis:smart:600s', 3500)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

COMMIT;
