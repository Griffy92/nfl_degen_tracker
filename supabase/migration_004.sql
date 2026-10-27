-- Adds a clean player / team name to each leg so the Stats page can group by player.
-- Safe to run more than once. Existing legs keep working with subject left empty; the Stats page
-- guesses a name from the description for those until you save them (Stats > Players > Tidy names).
alter table public.legs add column if not exists subject text;
create index if not exists legs_subject_idx on public.legs (subject);
