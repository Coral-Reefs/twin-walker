-- Optional seed: a few illustrative jury rankings so the live dashboard isn't empty at the start of a demo.
-- Mirrors lib/data/sample-votes.json. Safe to re-run (session ids are unique).
insert into public.votes (session_id, ranking) values
  ('seed-vote-01', array['family-pickup', 'crossing-reposition', 'shaded-seating']),
  ('seed-vote-02', array['shaded-seating', 'family-pickup', 'crossing-reposition']),
  ('seed-vote-03', array['crossing-reposition', 'shaded-seating', 'family-pickup']),
  ('seed-vote-04', array['family-pickup', 'shaded-seating', 'crossing-reposition']),
  ('seed-vote-05', array['shaded-seating', 'crossing-reposition', 'family-pickup']),
  ('seed-vote-06', array['family-pickup', 'crossing-reposition', 'shaded-seating'])
on conflict (session_id) do nothing;
