-- The tutorial_completed column was added with DEFAULT false and never backfilled, so every
-- account that existed before the intro wizard still looked like a brand-new player.
-- Mark everyone who already exists as having seen it; new signups still start at false.
UPDATE user_profiles
SET tutorial_completed = true
WHERE tutorial_completed = false
  AND created_at < now();
