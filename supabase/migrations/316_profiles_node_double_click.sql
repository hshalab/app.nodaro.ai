-- Per-user choice of what double-clicking a node on the canvas does.
--
-- The two useful behaviours are genuinely contested between people who use the
-- editor daily — one wants the node to zoom, the other wants its settings — so
-- this is a preference, not a default to argue about. Toggled from the editor
-- toolbar; set via PATCH /v1/user/settings.
--
-- 'zoom'     — double-click zooms to the node (toggle; a second one restores the
--              previous viewport). The behaviour that shipped before this column.
-- 'settings' — double-click opens the node's settings panel.
--
-- Enter is deliberately NOT governed by this: it always zooms, in either mode,
-- so both actions stay reachable at once (mouse does one, keyboard the other).
--
-- Defaults to 'settings'. Note this CHANGES the shipped behaviour for existing
-- users, who have had 'zoom' — a deliberate product call, not an oversight. The
-- toggle is one click away in the toolbar and the choice then sticks per user.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS node_double_click_action TEXT NOT NULL DEFAULT 'settings';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_node_double_click_action_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_node_double_click_action_check
      CHECK (node_double_click_action IN ('zoom', 'settings'));
  END IF;
END $$;

COMMENT ON COLUMN profiles.node_double_click_action IS
  'What double-clicking a canvas node does: zoom | settings. Default settings.';
