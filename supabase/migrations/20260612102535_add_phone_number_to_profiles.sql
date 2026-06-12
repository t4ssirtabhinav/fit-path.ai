-- Mobile number field on profiles, no verification yet (prerequisite for future
-- WhatsApp integration). Nullable, free-text — no format/verification enforced.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_number text;
