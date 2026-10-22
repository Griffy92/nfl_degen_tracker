-- Run once on an existing database (keeps your tables, members and parlays).
-- 1) Allow several parlays per week, with an optional name
alter table public.parlays drop constraint if exists parlays_season_week_key;
alter table public.parlays add column if not exists name text;
create index if not exists parlays_season_week_idx on public.parlays (season, week);

-- 2) Odds become a decimal multiplier (1.40 = $1 returns $1.40). Old American odds can't be converted, so they are cleared.
alter table public.legs alter column odds type numeric(6,2) using null;
alter table public.legs add constraint legs_odds_check check (odds is null or odds > 1);
