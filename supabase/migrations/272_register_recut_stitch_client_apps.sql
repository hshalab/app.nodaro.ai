-- Register recut.nodaro.ai and stitch.nodaro.ai in the client-apps registry —
-- the PRIVATE-app pattern (voice-changer-pro/person/recast), not the listed one
-- (studio): their per-user "Recut"/"Stitch" projects and workflow-per-document
-- rows are app-private storage and must not appear in app.nodaro.ai's own lists.
--
-- The same recurrence 271's header warns about ("registration is a manual step
-- no code path enforces"): both apps shipped 2026-07-24/25 without registry
-- rows, so `inferAppSlugFromSettings` never matched them and their projects
-- surfaced in the platform UI. Registering the rows IS the fix — stamping
-- starts working with no client change and no client deploy; the backfills
-- below (262's idempotent NULLs-only predicates, verbatim) reclassify the rows
-- created in between.
--
-- recut  marks project + workflows with `settings.recut`
--   (recut.nodaro.ai/src/lib/recut-project.ts, recut-settings.ts)
-- stitch marks project + workflows with `settings.stitch`
--   (stitch.nodaro.ai/src/lib/stitch-project.ts, stitch-settings.ts)
--
-- Purely additive registry data + NULLs-only backfills over existing columns:
-- no deploy-ordering hazard (unlike 271's jobs.app_slug half).

insert into public.client_apps (slug, name, workflows_listed, settings_key) values
  ('recut', 'Recut', false, 'recut'),
  ('stitch', 'Stitch', false, 'stitch')
on conflict (slug) do nothing;

-- If bare rows were ever hand-created without the marker key, converge them.
update public.client_apps set settings_key = 'recut'
  where slug = 'recut' and settings_key is null;
update public.client_apps set settings_key = 'stitch'
  where slug = 'stitch' and settings_key is null;

-- ── Backfill workflows created before registration (idempotent, NULLs only) ──
update public.workflows set app_slug = 'recut'
  where app_slug is null and settings ? 'recut';
update public.workflows set app_slug = 'stitch'
  where app_slug is null and settings ? 'stitch';

-- ── Backfill the per-user projects — 257/262's conservative predicate ──
-- Only hide a project that is unambiguously the app's private storage: never a
-- default project, never one holding another app's rows or real native
-- (node/edge-bearing) workflows. Run AFTER the workflow backfills above.
update public.projects p set app_slug = 'recut'
where p.app_slug is null
  and coalesce(p.is_default, false) = false
  and p.settings ? 'recut'
  and not exists (
    select 1 from public.workflows w
    where w.project_id = p.id
      and w.app_slug is not null
      and w.app_slug <> 'recut'
  )
  and not exists (
    select 1 from public.workflows w
    where w.project_id = p.id
      and w.app_slug is null
      and (
        (jsonb_typeof(w.nodes) = 'array' and jsonb_array_length(w.nodes) > 0)
        or (jsonb_typeof(w.edges) = 'array' and jsonb_array_length(w.edges) > 0)
      )
  );

update public.projects p set app_slug = 'stitch'
where p.app_slug is null
  and coalesce(p.is_default, false) = false
  and p.settings ? 'stitch'
  and not exists (
    select 1 from public.workflows w
    where w.project_id = p.id
      and w.app_slug is not null
      and w.app_slug <> 'stitch'
  )
  and not exists (
    select 1 from public.workflows w
    where w.project_id = p.id
      and w.app_slug is null
      and (
        (jsonb_typeof(w.nodes) = 'array' and jsonb_array_length(w.nodes) > 0)
        or (jsonb_typeof(w.edges) = 'array' and jsonb_array_length(w.edges) > 0)
      )
  );
