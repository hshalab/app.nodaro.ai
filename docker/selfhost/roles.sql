-- Align the Supabase internal role passwords with POSTGRES_PASSWORD.
-- Runs once, at the db container's FIRST init (docker-entrypoint-initdb.d),
-- which is the only window where the image's supautils reserved-role
-- protection does not intercept the ALTER (the same mechanism the official
-- Supabase self-host compose uses via its volumes/db/roles.sql).
-- Without this, GoTrue/PostgREST cannot authenticate and crash-loop with
-- "password authentication failed for user supabase_auth_admin".
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
