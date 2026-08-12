-- Per-user default for how {nodeRef} placeholders render in prompt fields.
--
-- This control used to live in the editor toolbar as a `{}` dropdown, where it
-- was in everyone's way for a preference almost nobody changes per-session. It
-- moves to Settings → Editor, which only works if it survives a reload — the
-- old toolbar state was in-memory only and reset to 'raw' on every load. Set via
-- PATCH /v1/user/settings.
--
-- 'raw'       — show the placeholder as written:            {Subject}
-- 'annotated' — show the placeholder AND its value:         {Subject: a red fox}
-- 'resolved'  — show only the value, as the model sees it:  a red fox
--
-- Defaults to 'raw', which is what every user effectively had before, so nobody
-- sees a change until they opt in.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS variable_display_mode TEXT NOT NULL DEFAULT 'raw';

-- Constrain to the three modes the renderer implements. Without this a typo
-- reaches `renderNodeRefs`, which only branches on 'annotated' vs everything
-- else, so a bad value would silently render as 'resolved'.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_variable_display_mode_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_variable_display_mode_check
      CHECK (variable_display_mode IN ('raw', 'annotated', 'resolved'));
  END IF;
END $$;

COMMENT ON COLUMN profiles.variable_display_mode IS
  'How {nodeRef} placeholders render in prompt fields: raw | annotated | resolved. Default raw.';
