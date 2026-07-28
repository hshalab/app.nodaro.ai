-- Allow 'url_import' as an assets.upload_source.
--
-- `POST /v1/media/import-url` has always written `upload_source: 'url_import'`
-- (backend/src/lib/media-import.ts), but that value is in no migration — the
-- constraint added by 258 allows exactly:
--
--   manual_upload | api | generation | generated | library | media_process
--   | job | social_download
--
-- So every URL import violated the check, the INSERT failed, and the failure
-- was swallowed (`console.error`, then `assetId: null` with `ok: true`). The
-- consequences all follow from the missing row:
--
--   * the bytes ARE charged — `reserve_storage_if_within_limit` runs before the
--     insert and increments `profiles.storage_used_bytes`;
--   * nothing can ever give them back — `deleteOwnedMediaByUrl` proves ownership
--     via an `assets` row, so a delete returns "not-owned" and skips; the
--     free-tier reaper iterates `assets` and never sees it; and
--     `permanentlyDeleteAsset`, the only path that decrements the quota, needs
--     the row.
--
-- i.e. every imported image is a permanent, unreclaimable quota charge. This
-- has been true for as long as the route has existed; it is being fixed now
-- because the recast reference picker turns "paste a rare link" into the
-- primary way to attach a reference.
--
-- 'url_import' rather than folding into 'manual_upload': the provenance is
-- real and worth keeping — these rows carry `metadata.source_url`, and
-- distinguishing "the user uploaded this" from "we fetched this on their
-- behalf" matters for both support and any future dedup.
--
-- Existing rows are unaffected: none can carry the value, because every insert
-- that tried to was rejected.

ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_upload_source_check;

ALTER TABLE public.assets
  ADD CONSTRAINT assets_upload_source_check
  CHECK (
    upload_source IN (
      'manual_upload',
      'api',
      'generation',
      'generated',
      'library',
      'media_process',
      'job',
      'social_download',
      'url_import'
    )
  );
