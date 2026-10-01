create table if not exists public.hard75_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.hard75_profiles enable row level security;
create policy "read own" on public.hard75_profiles for select using (auth.uid() = user_id);
create policy "insert own" on public.hard75_profiles for insert with check (auth.uid() = user_id);
create policy "update own" on public.hard75_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own" on public.hard75_profiles for delete using (auth.uid() = user_id);
