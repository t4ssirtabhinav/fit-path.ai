ALTER TABLE exercise_logs
  ADD COLUMN IF NOT EXISTS duration_minutes numeric,
  ADD COLUMN IF NOT EXISTS notes text;
