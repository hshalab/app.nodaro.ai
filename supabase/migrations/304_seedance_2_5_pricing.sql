-- Pricing for the seedance-2-5 provider (image-to-video / text-to-video /
-- unified generate-video nodes): KIE bytedance/seedance-2-5.
--
-- Per-second billing, 480p/720p ONLY (no 1080p/4K — probe-verified against
-- api.kie.ai on 2026-08-08: 1080p/4k/2k/1440p are rejected with the same
-- "not within the range of allowed options" as a nonsense value), across
-- 4-30s (31s+ rejected by the same probe). "-ref" = a reference video was
-- supplied, which KIE bills at a lower per-second rate because the billed span
-- becomes (input + output) seconds instead of output alone.
--
-- ONE ROW PER SECOND rather than the 2.0 family's 4/8/12/15 ladder: the tier
-- lookup snaps up and falls back to the last tier, so a coarse ladder over a
-- 30s range would price a 30s render at the 15s rate, and commit_credits can
-- only refund a surplus — never collect an upward delta.
--
-- Values MUST match STATIC_CREDIT_COSTS in backend/src/ee/billing/credits.ts.
-- Per CLAUDE.md Provider Enum Sync step 9: ON CONFLICT DO NOTHING (preserves
-- admin overrides).

INSERT INTO model_pricing (model_identifier, credit_cost, is_enabled, category) VALUES
  ('seedance-2-5',            1260, true, 'video'),
  -- 480p no video ref
  ('seedance-2-5:4s:480p',     280, true, 'video'),
  ('seedance-2-5:5s:480p',     350, true, 'video'),
  ('seedance-2-5:6s:480p',     420, true, 'video'),
  ('seedance-2-5:7s:480p',     490, true, 'video'),
  ('seedance-2-5:8s:480p',     560, true, 'video'),
  ('seedance-2-5:9s:480p',     630, true, 'video'),
  ('seedance-2-5:10s:480p',    700, true, 'video'),
  ('seedance-2-5:11s:480p',    770, true, 'video'),
  ('seedance-2-5:12s:480p',    840, true, 'video'),
  ('seedance-2-5:13s:480p',    910, true, 'video'),
  ('seedance-2-5:14s:480p',    980, true, 'video'),
  ('seedance-2-5:15s:480p',   1050, true, 'video'),
  ('seedance-2-5:16s:480p',   1120, true, 'video'),
  ('seedance-2-5:17s:480p',   1190, true, 'video'),
  ('seedance-2-5:18s:480p',   1260, true, 'video'),
  ('seedance-2-5:19s:480p',   1330, true, 'video'),
  ('seedance-2-5:20s:480p',   1400, true, 'video'),
  ('seedance-2-5:21s:480p',   1470, true, 'video'),
  ('seedance-2-5:22s:480p',   1540, true, 'video'),
  ('seedance-2-5:23s:480p',   1610, true, 'video'),
  ('seedance-2-5:24s:480p',   1680, true, 'video'),
  ('seedance-2-5:25s:480p',   1750, true, 'video'),
  ('seedance-2-5:26s:480p',   1820, true, 'video'),
  ('seedance-2-5:27s:480p',   1890, true, 'video'),
  ('seedance-2-5:28s:480p',   1960, true, 'video'),
  ('seedance-2-5:29s:480p',   2030, true, 'video'),
  ('seedance-2-5:30s:480p',   2100, true, 'video'),
  -- 480p with video ref
  ('seedance-2-5:4s:480p-ref',   170, true, 'video'),
  ('seedance-2-5:5s:480p-ref',   220, true, 'video'),
  ('seedance-2-5:6s:480p-ref',   260, true, 'video'),
  ('seedance-2-5:7s:480p-ref',   300, true, 'video'),
  ('seedance-2-5:8s:480p-ref',   340, true, 'video'),
  ('seedance-2-5:9s:480p-ref',   390, true, 'video'),
  ('seedance-2-5:10s:480p-ref',   430, true, 'video'),
  ('seedance-2-5:11s:480p-ref',   470, true, 'video'),
  ('seedance-2-5:12s:480p-ref',   510, true, 'video'),
  ('seedance-2-5:13s:480p-ref',   560, true, 'video'),
  ('seedance-2-5:14s:480p-ref',   600, true, 'video'),
  ('seedance-2-5:15s:480p-ref',   640, true, 'video'),
  ('seedance-2-5:16s:480p-ref',   680, true, 'video'),
  ('seedance-2-5:17s:480p-ref',   730, true, 'video'),
  ('seedance-2-5:18s:480p-ref',   770, true, 'video'),
  ('seedance-2-5:19s:480p-ref',   810, true, 'video'),
  ('seedance-2-5:20s:480p-ref',   850, true, 'video'),
  ('seedance-2-5:21s:480p-ref',   900, true, 'video'),
  ('seedance-2-5:22s:480p-ref',   940, true, 'video'),
  ('seedance-2-5:23s:480p-ref',   980, true, 'video'),
  ('seedance-2-5:24s:480p-ref',  1020, true, 'video'),
  ('seedance-2-5:25s:480p-ref',  1070, true, 'video'),
  ('seedance-2-5:26s:480p-ref',  1110, true, 'video'),
  ('seedance-2-5:27s:480p-ref',  1150, true, 'video'),
  ('seedance-2-5:28s:480p-ref',  1190, true, 'video'),
  ('seedance-2-5:29s:480p-ref',  1240, true, 'video'),
  ('seedance-2-5:30s:480p-ref',  1280, true, 'video'),
  -- 720p no video ref
  ('seedance-2-5:4s:720p',     630, true, 'video'),
  ('seedance-2-5:5s:720p',     790, true, 'video'),
  ('seedance-2-5:6s:720p',     950, true, 'video'),
  ('seedance-2-5:7s:720p',    1110, true, 'video'),
  ('seedance-2-5:8s:720p',    1260, true, 'video'),
  ('seedance-2-5:9s:720p',    1420, true, 'video'),
  ('seedance-2-5:10s:720p',   1580, true, 'video'),
  ('seedance-2-5:11s:720p',   1740, true, 'video'),
  ('seedance-2-5:12s:720p',   1890, true, 'video'),
  ('seedance-2-5:13s:720p',   2050, true, 'video'),
  ('seedance-2-5:14s:720p',   2210, true, 'video'),
  ('seedance-2-5:15s:720p',   2370, true, 'video'),
  ('seedance-2-5:16s:720p',   2520, true, 'video'),
  ('seedance-2-5:17s:720p',   2680, true, 'video'),
  ('seedance-2-5:18s:720p',   2840, true, 'video'),
  ('seedance-2-5:19s:720p',   3000, true, 'video'),
  ('seedance-2-5:20s:720p',   3150, true, 'video'),
  ('seedance-2-5:21s:720p',   3310, true, 'video'),
  ('seedance-2-5:22s:720p',   3470, true, 'video'),
  ('seedance-2-5:23s:720p',   3630, true, 'video'),
  ('seedance-2-5:24s:720p',   3780, true, 'video'),
  ('seedance-2-5:25s:720p',   3940, true, 'video'),
  ('seedance-2-5:26s:720p',   4100, true, 'video'),
  ('seedance-2-5:27s:720p',   4260, true, 'video'),
  ('seedance-2-5:28s:720p',   4410, true, 'video'),
  ('seedance-2-5:29s:720p',   4570, true, 'video'),
  ('seedance-2-5:30s:720p',   4730, true, 'video'),
  -- 720p with video ref
  ('seedance-2-5:4s:720p-ref',   380, true, 'video'),
  ('seedance-2-5:5s:720p-ref',   480, true, 'video'),
  ('seedance-2-5:6s:720p-ref',   570, true, 'video'),
  ('seedance-2-5:7s:720p-ref',   670, true, 'video'),
  ('seedance-2-5:8s:720p-ref',   760, true, 'video'),
  ('seedance-2-5:9s:720p-ref',   860, true, 'video'),
  ('seedance-2-5:10s:720p-ref',   950, true, 'video'),
  ('seedance-2-5:11s:720p-ref',  1050, true, 'video'),
  ('seedance-2-5:12s:720p-ref',  1140, true, 'video'),
  ('seedance-2-5:13s:720p-ref',  1240, true, 'video'),
  ('seedance-2-5:14s:720p-ref',  1330, true, 'video'),
  ('seedance-2-5:15s:720p-ref',  1430, true, 'video'),
  ('seedance-2-5:16s:720p-ref',  1520, true, 'video'),
  ('seedance-2-5:17s:720p-ref',  1620, true, 'video'),
  ('seedance-2-5:18s:720p-ref',  1710, true, 'video'),
  ('seedance-2-5:19s:720p-ref',  1810, true, 'video'),
  ('seedance-2-5:20s:720p-ref',  1900, true, 'video'),
  ('seedance-2-5:21s:720p-ref',  2000, true, 'video'),
  ('seedance-2-5:22s:720p-ref',  2090, true, 'video'),
  ('seedance-2-5:23s:720p-ref',  2190, true, 'video'),
  ('seedance-2-5:24s:720p-ref',  2280, true, 'video'),
  ('seedance-2-5:25s:720p-ref',  2380, true, 'video'),
  ('seedance-2-5:26s:720p-ref',  2470, true, 'video'),
  ('seedance-2-5:27s:720p-ref',  2570, true, 'video'),
  ('seedance-2-5:28s:720p-ref',  2660, true, 'video'),
  ('seedance-2-5:29s:720p-ref',  2760, true, 'video'),
  ('seedance-2-5:30s:720p-ref',  2850, true, 'video')
ON CONFLICT (model_identifier) DO NOTHING;
