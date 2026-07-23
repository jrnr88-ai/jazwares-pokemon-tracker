create table if not exists public.collection_progress (
  user_id uuid not null default auth.uid(),
  item_id text not null,
  caught boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.collection_progress enable row level security;

drop policy if exists "Users can read their own progress" on public.collection_progress;
create policy "Users can read their own progress"
on public.collection_progress
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own progress" on public.collection_progress;
create policy "Users can insert their own progress"
on public.collection_progress
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own progress" on public.collection_progress;
create policy "Users can update their own progress"
on public.collection_progress
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
