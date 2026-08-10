-- Community quickstart onboarding: track one-time demo workflow seeding per user.
-- The seed endpoint (POST /v1/onboarding/seed-demo) atomically claims this column
-- (UPDATE ... WHERE demo_seeded_at IS NULL RETURNING) before inserting the demo
-- workflow, so a user can only ever be seeded once, even under concurrent calls.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS demo_seeded_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.demo_seeded_at IS
  'When the welcome demo workflow was seeded into this user''s default project. NULL = never seeded (eligible on next empty-dashboard visit).';
