/*
  # FitPath - Initial Database Schema

  ## Overview
  Core schema for the FitPath holistic fitness and nutrition logging app.
  
  ## New Tables
  
  ### 1. profiles
  - Links to auth.users (one-to-one)
  - Stores display name, avatar, onboarding status, buddy invite code
  - `onboarding_complete`: false until wizard is finished
  - `invite_code`: unique 8-char code for buddy invites
  
  ### 2. health_profiles
  - Full health questionnaire data from onboarding wizard
  - age, weight_kg, height_cm, gender
  - body_type, activity_level, fitness_goals (array)
  - diet_type: 'veg' | 'veg_eggs' | 'non_veg'
  - health_concerns, injuries (text arrays)
  - sleep_hours_current, commitment_days_per_week
  - All data stored per user, one row per user
  
  ### 3. plans
  - AI-generated fitness plans stored as structured JSON
  - phase: 1-4, is_active boolean
  - plan_data: full JSON blob with workout, diet, supplements, habits, sleep protocol
  - generated_at, valid_until (3 months per phase)
  - last_regenerated_at to enforce 30-day regeneration limit
  
  ### 4. daily_tasks
  - Rendered checklist items for each user per day
  - category: 'workout' | 'meal' | 'supplement' | 'habit' | 'sleep'
  - title, description, target_value, unit
  - is_rest_day flag
  - Generated from the active plan each morning
  
  ### 5. task_logs
  - User check-offs and completion records
  - Tied to daily_tasks, one log per task per day
  - completed_at timestamp, notes text
  - value_logged (for numeric entries like weight)
  
  ### 6. body_measurements
  - Weight, waist, and other measurements over time
  - Separate from task logs for easy trend querying
  
  ### 7. streaks
  - One row per user, updated daily
  - current_streak, longest_streak, total_active_days
  - last_active_date, total_missed_days
  - monthly_completion_rate (0-1)
  
  ### 8. buddies
  - Pairs of users in a buddy relationship
  - user_id, buddy_id, status: 'pending' | 'active' | 'declined'
  - Created when invite code is used
  
  ## Security
  - RLS enabled on all tables
  - Users can only read/write their own data
  - Buddy pairs can read each other's streak and completion data (not health details)
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  onboarding_complete boolean NOT NULL DEFAULT false,
  invite_code text UNIQUE,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- HEALTH PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS health_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Personal stats
  age integer,
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  gender text,
  
  -- Goals and lifestyle
  fitness_goals text[] NOT NULL DEFAULT '{}',
  body_type text,
  activity_level text,
  diet_type text,
  
  -- Health context
  health_concerns text[] NOT NULL DEFAULT '{}',
  injuries text[] NOT NULL DEFAULT '{}',
  medications text,
  
  -- Current patterns
  sleep_hours_current numeric(4,1),
  commitment_days_per_week integer,
  preferred_workout_time text,
  
  -- Food preferences
  food_preferences text[] NOT NULL DEFAULT '{}',
  food_dislikes text[] NOT NULL DEFAULT '{}',
  
  -- Timeline
  goal_timeline_months integer,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE health_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own health profile"
  ON health_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health profile"
  ON health_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health profile"
  ON health_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase integer NOT NULL DEFAULT 1 CHECK (phase BETWEEN 1 AND 4),
  is_active boolean NOT NULL DEFAULT false,
  plan_data jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  last_regenerated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plans_user_id_active_idx ON plans(user_id, is_active);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plans"
  ON plans FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plans"
  ON plans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON plans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DAILY TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES plans(id) ON DELETE SET NULL,
  task_date date NOT NULL,
  category text NOT NULL CHECK (category IN ('workout','meal','supplement','habit','sleep')),
  title text NOT NULL,
  description text,
  target_value numeric,
  unit text,
  order_index integer NOT NULL DEFAULT 0,
  is_rest_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_tasks_user_date_idx ON daily_tasks(user_id, task_date);

ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily tasks"
  ON daily_tasks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily tasks"
  ON daily_tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily tasks"
  ON daily_tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily tasks"
  ON daily_tasks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- TASK LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS task_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES daily_tasks(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  value_logged numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, task_id, log_date)
);

CREATE INDEX IF NOT EXISTS task_logs_user_date_idx ON task_logs(user_id, log_date);

ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own task logs"
  ON task_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task logs"
  ON task_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task logs"
  ON task_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- BODY MEASUREMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(5,2),
  waist_cm numeric(5,2),
  chest_cm numeric(5,2),
  hips_cm numeric(5,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS body_measurements_user_date_idx ON body_measurements(user_id, measured_at);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own measurements"
  ON body_measurements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurements"
  ON body_measurements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurements"
  ON body_measurements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STREAKS
-- ============================================================
CREATE TABLE IF NOT EXISTS streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  total_active_days integer NOT NULL DEFAULT 0,
  total_missed_days integer NOT NULL DEFAULT 0,
  last_active_date date,
  monthly_completion_rate numeric(5,4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own streaks"
  ON streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks"
  ON streaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
  ON streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- BUDDIES
-- ============================================================
CREATE TABLE IF NOT EXISTS buddies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS buddies_recipient_idx ON buddies(recipient_id);

ALTER TABLE buddies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their buddy relationships"
  ON buddies FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can insert buddy requests"
  ON buddies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Recipient can update buddy status"
  ON buddies FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id OR auth.uid() = requester_id)
  WITH CHECK (auth.uid() = recipient_id OR auth.uid() = requester_id);

-- Buddies can read each other's streak data (read-only, no health details)
CREATE POLICY "Buddies can read partner streaks"
  ON streaks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buddies
      WHERE status = 'active'
      AND (
        (requester_id = auth.uid() AND recipient_id = streaks.user_id)
        OR (recipient_id = auth.uid() AND requester_id = streaks.user_id)
      )
    )
  );

-- Buddies can read each other's profiles (display name only)
CREATE POLICY "Buddies can read partner profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM buddies
      WHERE status = 'active'
      AND (
        (requester_id = auth.uid() AND recipient_id = profiles.id)
        OR (recipient_id = auth.uid() AND requester_id = profiles.id)
      )
    )
  );

-- ============================================================
-- HELPER FUNCTION: generate invite code
-- ============================================================
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS text
LANGUAGE plpgsql
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
-- TRIGGER: auto-create profile on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, display_name, invite_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    generate_invite_code()
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO streaks (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
