-- Marks a parlay as placed with bonus bet money. Safe to run more than once.
-- For a bonus bet the stake was free money, so the app takes the stake off the payout when working out net (a win nets
-- payout minus stake) and a loss costs nothing. "payout" is still the full amount on the slip.
alter table public.parlays add column if not exists is_bonus boolean not null default false;
