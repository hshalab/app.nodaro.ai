-- Supporting index for the keyset pagination added to GET /v1/characters.
--
-- The route pages with `ORDER BY created_at DESC, id DESC` plus a
-- `(created_at, id) < (cursor)` predicate, scoped to one user and one
-- archived-state. The pre-existing `idx_characters_user_active
-- (user_id, deleted_at)` covers the scoping but carries no ordering, so every
-- page had to sort the user's whole matching set.
--
-- That was acceptable when the endpoint was called ONCE per session with a
-- hard cap of 100 rows. Rolling load calls it repeatedly, so the sort cost is
-- now paid per page — this index turns each page into an index range scan.
--
-- `deleted_at` stays in the key (not a partial WHERE) because the route serves
-- BOTH the active list (`deleted_at IS NULL`) and the archive view
-- (`deleted_at IS NOT NULL`) through the same ordering.

CREATE INDEX IF NOT EXISTS idx_characters_user_keyset
  ON public.characters (user_id, deleted_at, created_at DESC, id DESC);
