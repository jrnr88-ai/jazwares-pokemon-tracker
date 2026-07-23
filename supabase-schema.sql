create table if not exists public.collection_progress_private (
  collection_key text not null,
  item_id text not null,
  caught boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (collection_key, item_id)
);

alter table public.collection_progress_private enable row level security;

revoke all on public.collection_progress_private from anon;
revoke all on public.collection_progress_private from authenticated;

drop function if exists public.get_collection_progress(text);
create function public.get_collection_progress(p_collection_key text)
returns table(item_id text, caught boolean)
language sql
security definer
set search_path = public
as $$
  select cp.item_id, cp.caught
  from public.collection_progress_private cp
  where cp.collection_key = p_collection_key;
$$;

drop function if exists public.upsert_collection_progress(text, text, boolean);
create function public.upsert_collection_progress(
  p_collection_key text,
  p_item_id text,
  p_caught boolean
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.collection_progress_private(collection_key, item_id, caught, updated_at)
  values (p_collection_key, p_item_id, p_caught, now())
  on conflict (collection_key, item_id)
  do update set caught = excluded.caught, updated_at = excluded.updated_at;
$$;

grant execute on function public.get_collection_progress(text) to anon, authenticated;
grant execute on function public.upsert_collection_progress(text, text, boolean) to anon, authenticated;
