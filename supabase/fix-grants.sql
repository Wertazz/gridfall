-- ============================================================
-- GRIDFALL — Correctif permissions
-- À exécuter dans Supabase > SQL Editor si les API renvoient
-- "permission denied for table ..."
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;
grant all    on all tables    in schema public to service_role;
grant select on all tables    in schema public to anon, authenticated;
grant all    on all sequences in schema public to service_role;
