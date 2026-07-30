-- Minimal schema mirroring the columns the Phase 2 data migration touches,
-- seeded with production-shaped values (incl. the awkward cases: NULLs,
-- zeros, a non-zero app_credits_allowance, a non-zero daily_spent_credits).
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT,
  subscription_credits INTEGER NOT NULL DEFAULT 0,
  topup_credits INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER,
  daily_spent_credits INTEGER,
  app_credits_allowance INTEGER NOT NULL DEFAULT 0,
  credits_balance INTEGER DEFAULT 50,      -- dead column: must stay untouched
  daily_credits_used INTEGER DEFAULT 0     -- dead column: must stay untouched
);

CREATE TABLE tier_config (
  tier TEXT PRIMARY KEY,
  monthly_credits INTEGER,
  daily_credit_limit INTEGER,
  price_usd NUMERIC(10,2)
);

CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credits_used INTEGER,
  credits_charged INTEGER,
  cost_usd NUMERIC(12,6),
  status TEXT DEFAULT 'committed'
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'completed',
  credits INTEGER,
  credits_actual INTEGER,
  provider_cost NUMERIC(12,6),
  display_cost NUMERIC(12,6)
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credits_granted INTEGER
);

CREATE TABLE credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credits INTEGER
);

CREATE TABLE credit_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credits_estimated INTEGER,
  credits_actual INTEGER,
  diff INTEGER,
  provider_cost_usd NUMERIC(12,6)
);

-- Production-shaped seed
INSERT INTO profiles (tier, subscription_credits, topup_credits, total_credits, daily_spent_credits, app_credits_allowance) VALUES
  ('free',     150,  0,   150,  0,    0),
  ('basic',    250,  0,   250,  0,    0),
  ('free',     244,  0,   244,  6,    0),   -- non-zero daily spend
  ('free',       0, 24,    24,  0,  175),   -- topup-only + allowance
  ('pro',     2000,  0,  2000, 13,    0),
  ('business', 4800, 500, 5300, 0,    0),
  ('free',     150,  0,  NULL, NULL,  0);   -- NULL-tolerance case

INSERT INTO tier_config (tier, monthly_credits, daily_credit_limit, price_usd) VALUES
  ('free', 150, 50, 0.00),
  ('basic', 250, NULL, 19.00),
  ('standard', 850, NULL, 39.00),
  ('pro', 2000, NULL, 79.00),
  ('business', 4800, NULL, 149.00);

INSERT INTO usage_logs (credits_used, credits_charged, cost_usd) VALUES
  (1, 1, 0.02), (5, 5, 0.09), (63, 63, 2.00), (0, 0, 0), (28, 28, 0.275), (NULL, NULL, 0.01);

INSERT INTO jobs (credits, credits_actual, provider_cost, display_cost) VALUES
  (38, 38, 0.41, 0.76), (5, 4, 0.09, 0.10), (400, 400, 4.953466, 8.00), (NULL, NULL, 0.02, 0.02);

INSERT INTO transactions (credits_granted) VALUES (150), (2000), (0), (NULL);
INSERT INTO credit_purchases (credits) VALUES (150), (450), (2200), (NULL);
INSERT INTO credit_anomalies (credits_estimated, credits_actual, diff, provider_cost_usd) VALUES
  (8, 4, -4, 0.075), (29, 28, -1, 0.56), (0, 3, 3, 0.05), (NULL, NULL, NULL, 0.01);
