-- =====================================================================================================================
-- users.must_reset_password is cleared when the password really changes (owner decision 2026-11-16)
-- =====================================================================================================================
-- A platform administrator can require a user to change their password (platform_update_user_security). The flag was
-- never cleared afterwards, so it could not be "removed" by the user doing what it asks. This trigger clears it in the
-- same statement whenever password_hash changes, whatever the path: change_own_password, complete_password_reset
-- (code or link), or platform tooling. Setting the flag without changing the password (the administrator's action)
-- keeps it set. The API refuses every request except the account page, password change and logout while it is set.
-- =====================================================================================================================

CREATE OR REPLACE FUNCTION public.clear_must_reset_password_on_password_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.must_reset_password := false;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_must_reset_password_on_password_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS users_clear_must_reset_password ON public.users;
CREATE TRIGGER users_clear_must_reset_password
  BEFORE UPDATE OF password_hash ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_must_reset_password_on_password_change();

-- =====================================================================================================================
-- Rollback (forward migration): DROP TRIGGER users_clear_must_reset_password ON public.users;
-- DROP FUNCTION public.clear_must_reset_password_on_password_change();
-- =====================================================================================================================
