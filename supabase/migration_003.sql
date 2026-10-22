-- Adds the bookie's combined slip odds to each parlay. Safe to run more than once.
alter table public.parlays add column if not exists slip_odds numeric(6,2);
alter table public.parlays drop constraint if exists parlays_slip_odds_check;
alter table public.parlays add constraint parlays_slip_odds_check check (slip_odds is null or slip_odds > 1);
