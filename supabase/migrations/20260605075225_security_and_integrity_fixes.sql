/*
  # FitPath Security & Integrity Fixes
  
  fix_01: Replace broken invite code RLS with SECURITY DEFINER function
  fix_02: Re-add partial unique index for active buddy relationships
  fix_03: Fix generate_invite_code missing SET search_path
  fix_04: Add updated_at auto-update triggers
*/

-- ============================================================
-- fix_01: Remove dangerous RLS policy, use SECURITY DEFINER function instead
-- ============================================================
DROP POLICY IF EXISTS "Users can lookup profiles by invite code" ON profiles;

CREATE OR REPLACE FUNCTION lookup_profile_by_invite_code(code text)
RETURNS TABLE(id uuid, display_name text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, display_name FROM profiles
  WHERE invite_code = code LIMIT 1;
$$;

-- ============================================================
-- fix_02: Partial unique index — one active relationship per pair
-- Prevents duplicate active buddy pairs while allowing multiple buddies
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS buddies_unique_active
  ON buddies (
    LEAST(requester_id::text, recipient_id::text),
    GREATEST(requester_id::text, recipient_id::text)
  )
  WHERE status = 'active';

-- ============================================================
-- fix_03: Fix generate_invite_code — add SET search_path
-- ============================================================
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
  exists_check boolean;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE invite_code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$;

-- ============================================================
-- fix_04: updated_at auto-update triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_health_profiles_updated_at
  BEFORE UPDATE ON health_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_buddies_updated_at
  BEFORE UPDATE ON buddies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
