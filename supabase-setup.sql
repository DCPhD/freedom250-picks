-- FREEDOM 250 PICKS — SUPABASE DATABASE SETUP
-- Paste this entire file into Supabase SQL Editor and click Run.
-- Safe for a new, otherwise empty Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  admin_email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.fights (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_order integer not null,
  fighter1 text not null,
  fighter2 text not null,
  weight_class text not null,
  max_rounds integer not null check (max_rounds in (3,5)),
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  actual_result text check (actual_result in ('fighter1','fighter2','draw','no_contest')),
  actual_method text check (actual_method in ('ko_tko','submission','decision','disqualification','technical_decision','technical_draw','no_contest')),
  actual_ending text check (actual_ending in ('r1','r2','r3','r4','r5','decision')),
  actual_takedown_leader text check (actual_takedown_leader in ('fighter1','fighter2','tie','void')),
  actual_strike_leader text check (actual_strike_leader in ('fighter1','fighter2','tie','void')),
  unique(event_id, display_order)
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 30),
  created_at timestamptz not null default now(),
  unique(event_id, user_id)
);
create unique index if not exists participants_unique_name
  on public.participants(event_id, lower(display_name));

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  fight_id uuid not null references public.fights(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  result_pick text not null check (result_pick in ('fighter1','fighter2','draw','no_contest')),
  method_pick text not null check (method_pick in ('ko_tko','submission','decision','disqualification','technical_decision','technical_draw','no_contest')),
  ending_pick text not null check (ending_pick in ('r1','r2','r3','r4','r5','decision')),
  takedown_pick text not null check (takedown_pick in ('fighter1','fighter2','tie')),
  strike_pick text not null check (strike_pick in ('fighter1','fighter2','tie')),
  updated_at timestamptz not null default now(),
  unique(fight_id, user_id)
);

alter table public.events enable row level security;
alter table public.fights enable row level security;
alter table public.participants enable row level security;
alter table public.picks enable row level security;

-- Remove old policies if this script is rerun.
drop policy if exists "Authenticated users read active events" on public.events;
drop policy if exists "Admin manages events" on public.events;
drop policy if exists "Authenticated users read fights" on public.fights;
drop policy if exists "Admin manages fights" on public.fights;
drop policy if exists "Authenticated users read participant names" on public.participants;
drop policy if exists "Users create own participant profile" on public.participants;
drop policy if exists "Users update own participant profile" on public.participants;
drop policy if exists "Admin manages participants" on public.participants;
drop policy if exists "Users see own picks or revealed picks" on public.picks;
drop policy if exists "Users create own open-fight picks" on public.picks;
drop policy if exists "Users update own open-fight picks" on public.picks;
drop policy if exists "Users delete own open-fight picks" on public.picks;
drop policy if exists "Admin manages all picks" on public.picks;

create policy "Authenticated users read active events"
on public.events for select to authenticated
using (active = true or lower(coalesce(auth.jwt()->>'email','')) = lower(admin_email));

create policy "Admin manages events"
on public.events for all to authenticated
using (lower(coalesce(auth.jwt()->>'email','')) = lower(admin_email))
with check (lower(coalesce(auth.jwt()->>'email','')) = lower(admin_email));

create policy "Authenticated users read fights"
on public.fights for select to authenticated
using (true);

create policy "Admin manages fights"
on public.fights for all to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = fights.event_id
      and lower(coalesce(auth.jwt()->>'email','')) = lower(e.admin_email)
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = fights.event_id
      and lower(coalesce(auth.jwt()->>'email','')) = lower(e.admin_email)
  )
);

create policy "Authenticated users read participant names"
on public.participants for select to authenticated
using (true);

create policy "Users create own participant profile"
on public.participants for insert to authenticated
with check (user_id = auth.uid());

create policy "Users update own participant profile"
on public.participants for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Admin manages participants"
on public.participants for all to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = participants.event_id
      and lower(coalesce(auth.jwt()->>'email','')) = lower(e.admin_email)
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = participants.event_id
      and lower(coalesce(auth.jwt()->>'email','')) = lower(e.admin_email)
  )
);

create policy "Users see own picks or revealed picks"
on public.picks for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.fights f
    where f.id = picks.fight_id
      and f.status in ('in_progress','completed','cancelled')
  )
  or exists (
    select 1 from public.events e
    where e.id = picks.event_id
      and lower(coalesce(auth.jwt()->>'email','')) = lower(e.admin_email)
  )
);

create policy "Users create own open-fight picks"
on public.picks for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.participants p
    where p.id = picks.participant_id and p.user_id = auth.uid()
  )
  and exists (
    select 1 from public.fights f
    where f.id = picks.fight_id and f.status = 'open'
  )
);

create policy "Users update own open-fight picks"
on public.picks for update to authenticated
using (
  user_id = auth.uid()
  and exists (select 1 from public.fights f where f.id = picks.fight_id and f.status = 'open')
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.participants p
    where p.id = picks.participant_id and p.user_id = auth.uid()
  )
  and exists (select 1 from public.fights f where f.id = picks.fight_id and f.status = 'open')
);

create policy "Users delete own open-fight picks"
on public.picks for delete to authenticated
using (
  user_id = auth.uid()
  and exists (select 1 from public.fights f where f.id = picks.fight_id and f.status = 'open')
);

create policy "Admin manages all picks"
on public.picks for all to authenticated
using (
  exists (
    select 1 from public.events e
    where e.id = picks.event_id
      and lower(coalesce(auth.jwt()->>'email','')) = lower(e.admin_email)
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = picks.event_id
      and lower(coalesce(auth.jwt()->>'email','')) = lower(e.admin_email)
  )
);

grant usage on schema public to authenticated;
grant select on public.events, public.fights, public.participants, public.picks to authenticated;
grant insert, update on public.participants, public.picks to authenticated;
grant delete on public.picks to authenticated;
grant insert, update, delete on public.events, public.fights to authenticated;

-- Seed the event and seven-fight main card.
insert into public.events (code, title, admin_email)
values ('FREEDOM250', 'Freedom 250 Picks', 'niugrads1999@gmail.com')
on conflict (code) do update
set title = excluded.title,
    admin_email = excluded.admin_email,
    active = true;

do $$
declare
  event_uuid uuid;
begin
  select id into event_uuid from public.events where code = 'FREEDOM250';

  insert into public.fights
    (event_id, display_order, fighter1, fighter2, weight_class, max_rounds)
  values
    (event_uuid, 1, 'Ilia Topuria', 'Justin Gaethje', 'Lightweight Championship', 5),
    (event_uuid, 2, 'Alex Pereira', 'Ciryl Gane', 'Interim Heavyweight Championship', 5),
    (event_uuid, 3, 'Sean O''Malley', 'Aiemann Zahabi', 'Bantamweight', 3),
    (event_uuid, 4, 'Josh Hokit', 'Derrick Lewis', 'Heavyweight', 3),
    (event_uuid, 5, 'Mauricio Ruffy', 'Michael Chandler', 'Lightweight', 3),
    (event_uuid, 6, 'Bo Nickal', 'Kyle Daukaus', 'Middleweight', 3),
    (event_uuid, 7, 'Diego Lopes', 'Steve Garcia', 'Featherweight', 3)
  on conflict (event_id, display_order) do update
  set fighter1 = excluded.fighter1,
      fighter2 = excluded.fighter2,
      weight_class = excluded.weight_class,
      max_rounds = excluded.max_rounds;
end $$;
