-- "Last active" timestamp on profiles, updated on a throttled basis from the
-- client (see AuthContext). Foundation for re-engagement emails and
-- buddy-status indicators in later tickets.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
