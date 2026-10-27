create table if not exists public.ledgers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"accounts":[],"transactions":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ledgers enable row level security;
create policy "Users can read their own ledger" on public.ledgers for select using (auth.uid() = user_id);
create policy "Users can insert their own ledger" on public.ledgers for insert with check (auth.uid() = user_id);
create policy "Users can update their own ledger" on public.ledgers for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
