-- Allergies were previously packed into the injuries text[] with an "allergy: " prefix.
-- Move them to their own column so they're queryable/usable on their own merits
-- (e.g. surfaced as a hard constraint in AI plan generation).
ALTER TABLE health_profiles
  ADD COLUMN IF NOT EXISTS allergies text[] DEFAULT '{}';
