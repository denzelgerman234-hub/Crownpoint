create table if not exists public.payment_settings (
  currency_code text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_by_auth_user_id uuid references auth.users(id) on delete set null,
  updated_by_name text not null default '',
  revision integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_settings_currency_code_check
    check (currency_code = any (array['USD'::text, 'GBP'::text, 'EUR'::text, 'CAD'::text, 'AUD'::text, 'AED'::text])),
  constraint payment_settings_revision_check
    check (revision >= 0)
);

create index if not exists payment_settings_updated_at_idx
  on public.payment_settings (updated_at desc);

drop trigger if exists set_payment_settings_updated_at on public.payment_settings;

create trigger set_payment_settings_updated_at
before update on public.payment_settings
for each row
execute function public.set_updated_at();

alter table public.payment_settings enable row level security;

drop policy if exists "Public can read payment settings" on public.payment_settings;
create policy "Public can read payment settings"
on public.payment_settings
for select
using (true);

drop policy if exists "Admins can insert payment settings" on public.payment_settings;
create policy "Admins can insert payment settings"
on public.payment_settings
for insert
with check (public.is_admin());

drop policy if exists "Admins can update payment settings" on public.payment_settings;
create policy "Admins can update payment settings"
on public.payment_settings
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete payment settings" on public.payment_settings;
create policy "Admins can delete payment settings"
on public.payment_settings
for delete
using (public.is_admin());

alter table public.user_profiles
  add column if not exists avatar_storage jsonb not null default '{}'::jsonb;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  2000000,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'verification-documents',
  'verification-documents',
  false,
  10000000,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read profile avatars" on storage.objects;
create policy "Public can read profile avatars"
on storage.objects
for select
using (bucket_id = 'profile-avatars');

drop policy if exists "Users and signup drafts can upload profile avatars" on storage.objects;
create policy "Users and signup drafts can upload profile avatars"
on storage.objects
for insert
with check (
  bucket_id = 'profile-avatars'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
    or (
      auth.role() = 'anon'
      and (storage.foldername(name))[1] = 'signup-draft'
    )
  )
);

drop policy if exists "Users and signup drafts can delete profile avatars" on storage.objects;
create policy "Users and signup drafts can delete profile avatars"
on storage.objects
for delete
using (
  bucket_id = 'profile-avatars'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
    or (
      auth.role() = 'anon'
      and (storage.foldername(name))[1] = 'signup-draft'
    )
  )
);

drop policy if exists "Admins and owners can read verification documents" on storage.objects;
create policy "Admins and owners can read verification documents"
on storage.objects
for select
using (
  bucket_id = 'verification-documents'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "Users and signup drafts can upload verification documents" on storage.objects;
create policy "Users and signup drafts can upload verification documents"
on storage.objects
for insert
with check (
  bucket_id = 'verification-documents'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
    or (
      auth.role() = 'anon'
      and (storage.foldername(name))[1] = 'signup-draft'
    )
  )
);

drop policy if exists "Users and signup drafts can delete verification documents" on storage.objects;
create policy "Users and signup drafts can delete verification documents"
on storage.objects
for delete
using (
  bucket_id = 'verification-documents'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
    or (
      auth.role() = 'anon'
      and (storage.foldername(name))[1] = 'signup-draft'
    )
  )
);
