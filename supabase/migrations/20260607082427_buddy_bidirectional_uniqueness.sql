/*
  Close the bidirectional pending-request gap in buddy relationships.

  buddies_unique_active only covered status = 'active', so two users could
  each send a 'pending' request to one another (A->B and B->A) concurrently —
  the app-level reverse-direction check is racy (check-then-insert). Replace
  it with an index that also covers 'pending', so the DB enforces at most one
  live (pending or active) relationship per unordered pair regardless of
  request direction. 'declined' rows are intentionally excluded so users can
  re-request after a decline.
*/

DROP INDEX IF EXISTS buddies_unique_active;

CREATE UNIQUE INDEX IF NOT EXISTS buddies_unique_live
  ON buddies (
    LEAST(requester_id::text, recipient_id::text),
    GREATEST(requester_id::text, recipient_id::text)
  )
  WHERE status IN ('pending', 'active');
