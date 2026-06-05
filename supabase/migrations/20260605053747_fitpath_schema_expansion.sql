/*
  # FitPath Schema Expansion
  1. Add daily_logs table for user comments and vitals per day
  2. Add milestones table for unlocked achievements
  3. Add personalization_comments column to health_profiles
  4. Remove UNIQUE constraint from buddies to allow multiple buddies
  5. Add RLS policies for buddy access to daily_tasks and task_logs
*/

-- DAILY LOGS
CREATE TABLE IF NOT EXISTS daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  workout_comments text,
  energy_level integer CHECK (energy_level BETWEEN 1 AND 5),
  meal_comments text,
  supplement_comments text,
  illness_comments text,
  sleep_comments text,
  vitals_comments text,
  other_comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS daily_logs_user_date_idx ON daily_logs(user_id, log_date);

ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily logs"
  ON daily_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily logs"
  ON daily_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily logs"
  ON daily_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- MILESTONES
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, milestone_key)
);

CREATE INDEX IF NOT EXISTS milestones_user_idx ON milestones(user_id);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own milestones"
  ON milestones FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own milestones"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- HEALTH PROFILES - Add personalization_comments
ALTER TABLE health_profiles
ADD COLUMN IF NOT EXISTS personalization_comments text;

-- BUDDIES - Remove UNIQUE constraint to allow multiple buddies
ALTER TABLE buddies
DROP CONSTRAINT IF EXISTS buddies_requester_id_recipient_id_key;

-- RLS POLICIES - Buddy Access to daily_tasks and task_logs
CREATE POLICY "Buddies can read partner daily tasks"
  ON daily_tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buddies
      WHERE status = 'active'
      AND (
        (requester_id = auth.uid() AND recipient_id = daily_tasks.user_id)
        OR (recipient_id = auth.uid() AND requester_id = daily_tasks.user_id)
      )
      AND daily_tasks.category IN ('workout', 'habit', 'sleep')
    )
  );

CREATE POLICY "Buddies can read partner task logs"
  ON task_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM daily_tasks dt
      INNER JOIN buddies b ON b.status = 'active'
      WHERE dt.id = task_logs.task_id
      AND dt.category IN ('workout', 'habit', 'sleep')
      AND (
        (b.requester_id = auth.uid() AND b.recipient_id = task_logs.user_id)
        OR (b.recipient_id = auth.uid() AND b.requester_id = task_logs.user_id)
      )
    )
  );