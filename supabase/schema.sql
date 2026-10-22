-- Run this in the Supabase SQL editor.
create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.parlays (
  id uuid primary key default gen_random_uuid(),
  season int not null,
  week int not null,
  stake numeric(10,2) not null default 0,
  payout numeric(10,2) not null default 0,   -- total returned (0 if lost)
  created_at timestamptz not null default now(),
  unique (season, week)
);

create table public.legs (
  id uuid primary key default gen_random_uuid(),
  parlay_id uuid not null references public.parlays(id) on delete cascade,
  member_id uuid not null references public.members(id),
  description text not null,                 -- e.g. "Mahomes over 274.5 pass yds"
  market text not null default 'Other',
  odds int,                                  -- American odds, e.g. -110
  result text not null default 'pending' check (result in ('pending','hit','miss','push')),
  created_at timestamptz not null default now()
);
create index on public.legs (parlay_id);
create index on public.legs (member_id);

-- Auto-create a member row when someone signs in for the first time
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row level security: any signed-in member can read and write everything
alter table public.members enable row level security;
alter table public.parlays enable row level security;
alter table public.legs enable row level security;

create policy "members read" on public.members for select to authenticated using (true);
create policy "members update self" on public.members for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "parlays all" on public.parlays for all to authenticated using (true) with check (true);
create policy "legs all" on public.legs for all to authenticated using (true) with check (true);
