create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'ADMIN', false);
$$;

create table if not exists public.talents (
  id bigint primary key,
  wikidata_id text,
  source_item text,
  name text not null,
  aliases text[] not null default '{}',
  category text not null default '',
  subcategory text not null default '',
  initials text not null default '',
  bio text not null default '',
  avatar_url text not null default '',
  avatar_original_url text not null default '',
  avatar_thumbnail_url text not null default '',
  avatar_src_set text not null default '',
  gradient text not null default '',
  location text not null default '',
  languages text[] not null default '{}',
  tags text[] not null default '{}',
  popularity_score integer not null default 0,
  response_time text not null default '72h',
  starting_price numeric(12, 2) not null default 0,
  available boolean not null default true,
  verified boolean not null default true,
  shop_link text not null default '',
  services jsonb not null default '[]'::jsonb,
  event_booking jsonb not null default '{}'::jsonb,
  shop_items jsonb not null default '[]'::jsonb,
  reviews jsonb not null default '[]'::jsonb,
  rating numeric(3, 1) not null default 5.0,
  review_count integer not null default 0,
  completed_bookings integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists talents_category_idx on public.talents (category);
create index if not exists talents_available_idx on public.talents (available);
create index if not exists talents_verified_idx on public.talents (verified);
create index if not exists talents_tags_idx on public.talents using gin (tags);
create index if not exists talents_languages_idx on public.talents using gin (languages);

drop trigger if exists set_talents_updated_at on public.talents;

create trigger set_talents_updated_at
before update on public.talents
for each row
execute function public.set_updated_at();

alter table public.talents enable row level security;

drop policy if exists "Public talents are readable" on public.talents;
create policy "Public talents are readable"
on public.talents
for select
using (true);

drop policy if exists "Admins can insert talents" on public.talents;
create policy "Admins can insert talents"
on public.talents
for insert
with check (public.is_admin());

drop policy if exists "Admins can update talents" on public.talents;
create policy "Admins can update talents"
on public.talents
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete talents" on public.talents;
create policy "Admins can delete talents"
on public.talents
for delete
using (public.is_admin());
