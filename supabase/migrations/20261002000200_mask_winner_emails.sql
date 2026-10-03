/*
  # Remove emails from winner rows

  Winners saved before nicknames existed stored the player's raw email as their
  display name. Replace those with an anonymous "Player XXXX" tag (last 4 hex of
  the user id) so no email is ever shown on a leaderboard.
*/
UPDATE case_winners
SET username = 'Player ' || upper(right(replace(user_id::text, '-', ''), 4))
WHERE username LIKE '%@%';
