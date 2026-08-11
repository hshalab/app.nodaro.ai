-- Migration: Normalize app_settings.ai_provider to "kie"
--
-- Migration 005 seeds ai_provider = '"replicate"' on every fresh database,
-- but replicate-as-primary was retired long ago: the admin API accepts only
-- "kie" (ee/routes/admin-settings.ts), and the provider router now treats
-- KIE as the sole primary regardless of this setting (providers/config.ts —
-- the old non-"kie" branch returned an empty provider chain, which broke
-- every registry-routed node on fresh self-host installs).
--
-- Routing no longer reads this value; this normalization is so stored rows
-- and the admin settings screen stop reporting a mode that no longer exists.
UPDATE public.app_settings
SET value = '"kie"'::jsonb, updated_at = NOW()
WHERE key = 'ai_provider' AND value = '"replicate"'::jsonb;
