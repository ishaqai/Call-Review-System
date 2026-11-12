-- Run this once in Supabase Dashboard > SQL Editor.
create table if not exists public.call_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  record jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.call_records enable row level security;

create policy "Users can read their own call records"
  on public.call_records for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own call records"
  on public.call_records for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own call records"
  on public.call_records for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own call records"
  on public.call_records for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.call_records to authenticated;
