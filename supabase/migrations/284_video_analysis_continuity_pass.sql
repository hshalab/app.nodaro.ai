-- Price the CONTINUITY pass onto the `smart` tier only.
--
-- WHAT THE PASS IS. Every analyzer pass reads ONE window and describes each shot
-- in isolation, which it does well. Nothing in the pipeline has ever compared
-- shot 4 with shot 11 — so a shot list can be locally correct and globally
-- impossible, which is the failure class reported from the field: characters on
-- an airless surface with no helmets in one shot and helmets in the next, a prop
-- appearing from nowhere, a character asleep then awake then asleep, a line of
-- dialogue attributed to whichever character was named most recently.
--
-- The continuity pass is one reasoning call over the FINISHED shot list that
-- emits targeted corrections — scene, field, new value, reason — under three
-- constraints: the field must be on an allowlist (never timings, never the scene
-- count), a speaker reassignment must name a character that scene already
-- references, and every correction lands in the result's warnings so the output
-- is never silently different from what the analyzer produced.
--
-- WHY `smart` ONLY, and why that is an economic decision rather than a technical
-- one. The pass is a flat cost per run: it scales with scene count, not with video
-- length or tier. On the economy tiers that flat cost exceeds the entire analysis
-- it would be checking — a short run on the cheapest tier is a few credits in
-- total — so charging for it there would have MORE THAN DOUBLED those tiers and
-- defeated the reason they exist. It also belongs where it pays for itself:
-- `smart` is the tier chosen when the shot list will drive regeneration, which is
-- where an impossible shot becomes an expensive wrong render rather than a note in
-- a transcript.
--
-- So this migration moves ONLY the `smart` rows (+4 credits per bucket). Every
-- other tier is unchanged from migration 283 and is re-asserted here purely
-- because this statement is convergent.
--
-- The bare `video-analysis` row tracks the table MAXIMUM (see migration 277): it
-- is the unknown-model AND unknown-duration fallback feeding a pre-run balance
-- gate, so it must bound every row — which means tracking `smart`, now 350.
--
-- `mixed-fast` deliberately gets NO rows: it shares the `mixed` credit family
-- (videoAnalysisCreditSegment folds them), so its colon ids are never built and
-- would be dead rows. The credit-pricing-migration-sync guard catches them.
--
-- Idempotent + convergent, matching 275/276/277/279/283.
INSERT INTO public.model_pricing (model_identifier, credit_cost, is_enabled, category)
VALUES
  ('video-analysis:smart:60s', 46, true, 'other'),
  ('video-analysis:smart:180s', 98, true, 'other'),
  ('video-analysis:smart:360s', 211, true, 'other'),
  ('video-analysis:smart:600s', 350, true, 'other'),
  ('video-analysis:smart', 350, true, 'other'),
  ('video-analysis:gemini-3-flash:60s', 3, true, 'other'),
  ('video-analysis:gemini-3-flash:180s', 4, true, 'other'),
  ('video-analysis:gemini-3-flash:360s', 9, true, 'other'),
  ('video-analysis:gemini-3-flash:600s', 14, true, 'other'),
  ('video-analysis:gemini-3-flash', 14, true, 'other'),
  ('video-analysis:gemini-3.6-flash:60s', 7, true, 'other'),
  ('video-analysis:gemini-3.6-flash:180s', 9, true, 'other'),
  ('video-analysis:gemini-3.6-flash:360s', 23, true, 'other'),
  ('video-analysis:gemini-3.6-flash:600s', 38, true, 'other'),
  ('video-analysis:gemini-3.6-flash', 38, true, 'other'),
  ('video-analysis:gemini-3.1-pro:60s', 9, true, 'other'),
  ('video-analysis:gemini-3.1-pro:180s', 12, true, 'other'),
  ('video-analysis:gemini-3.1-pro:360s', 30, true, 'other'),
  ('video-analysis:gemini-3.1-pro:600s', 49, true, 'other'),
  ('video-analysis:gemini-3.1-pro', 49, true, 'other'),
  ('video-analysis:mixed:60s', 11, true, 'other'),
  ('video-analysis:mixed:180s', 15, true, 'other'),
  ('video-analysis:mixed:360s', 38, true, 'other'),
  ('video-analysis:mixed:600s', 63, true, 'other'),
  ('video-analysis:mixed', 63, true, 'other'),
  ('video-analysis', 350, true, 'other')
ON CONFLICT (model_identifier) DO UPDATE
  SET credit_cost = EXCLUDED.credit_cost,
      is_enabled  = EXCLUDED.is_enabled;
