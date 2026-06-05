-- Track when a user last completed onboarding; used by generate-plan to bypass
-- the 30-day regeneration rate limit for users who re-onboard with new data.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_onboarded_at timestamptz;
