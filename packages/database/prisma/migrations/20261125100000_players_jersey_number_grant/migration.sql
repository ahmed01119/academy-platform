-- The runtime role may insert and update only the columns of players it was granted one by one
-- (20261118110000_account_links_definer_only: every column except user_id, listed when that migration ran).
-- players.jersey_number (20261125090000) came later, so writing it was refused ("permission denied for table players")
-- when staff added, edited or approved a player. Same rule as for the other columns: insert and update, not user_id.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['academy_runtime', 'academy_runtime_ci', 'sportexus_app'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r);
    EXECUTE format('GRANT INSERT (jersey_number), UPDATE (jersey_number) ON TABLE public.players TO %I', r);
  END LOOP;
END
$$;
