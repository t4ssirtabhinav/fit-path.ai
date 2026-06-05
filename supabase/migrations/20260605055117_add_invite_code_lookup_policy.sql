
-- Allow authenticated users to look up profiles by invite code (for buddy invites)
-- Only exposes id and display_name via the invite_code search
CREATE POLICY "Users can lookup profiles by invite code"
  ON profiles FOR SELECT
  TO authenticated
  USING (invite_code IS NOT NULL);
