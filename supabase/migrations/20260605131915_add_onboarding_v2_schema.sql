-- Onboarding v2: two-path flow (plan / track), per-modality goal details, tracking config

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS onboarding_path text;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_onboarding_path_check
    CHECK (onboarding_path IN ('plan', 'track'));

ALTER TABLE health_profiles
  ADD COLUMN IF NOT EXISTS activity_modalities text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_details jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stress_level integer,
  ADD COLUMN IF NOT EXISTS hydration_level text,
  ADD COLUMN IF NOT EXISTS job_type text;

ALTER TABLE health_profiles
  ADD CONSTRAINT health_profiles_stress_level_check
    CHECK (stress_level IS NULL OR stress_level BETWEEN 1 AND 5);

CREATE TABLE IF NOT EXISTS tracking_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  selected_trackers text[] DEFAULT '{}' NOT NULL,
  reminder_morning time,
  reminder_evening time,
  reminder_style text DEFAULT 'simple' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT tracking_config_user_id_unique UNIQUE (user_id)
);

ALTER TABLE tracking_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tracking_config"
  ON tracking_config FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tracking_config_set_updated_at
  BEFORE UPDATE ON tracking_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
