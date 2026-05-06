create table if not exists public.event_state (
  event_id text primary key,
  checkbox_state jsonb not null default '{}'::jsonb,
  custom_items jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.event_state enable row level security;

drop policy if exists "anon can read event_state" on public.event_state;
create policy "anon can read event_state"
  on public.event_state
  for select
  to anon
  using (true);

drop policy if exists "anon can insert event_state" on public.event_state;
create policy "anon can insert event_state"
  on public.event_state
  for insert
  to anon
  with check (true);

drop policy if exists "anon can update event_state" on public.event_state;
create policy "anon can update event_state"
  on public.event_state
  for update
  to anon
  using (true)
  with check (true);

alter publication supabase_realtime add table public.event_state;
