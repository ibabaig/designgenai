-- ============================================================
-- Assignment 3: profiles table, auth trigger, avatar storage
-- Run in Supabase: SQL Editor -> New query -> paste -> Run
-- ============================================================

-- 1. PROFILES TABLE -----------------------------------------
-- id is the same uuid as the auth.users row, so the two are 1:1.
-- on delete cascade: deleting the auth user deletes their profile.
-- first_name / last_name are nullable on purpose, so a brand-new
-- user has an "incomplete" profile the app can prompt them to fill.
create table public.profiles (
  id          uuid not null references auth.users on delete cascade,
  email       text,
  first_name  text,               -- nullable
  last_name   text,               -- nullable
  avatar_path text,               -- STORAGE PATH ONLY, never image bytes
  updated_at  timestamptz not null default now(),
  primary key (id)
);

-- Only signed-in users touch this table. anon gets nothing.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- RLS is left OFF for this assignment, per the instructions.
-- When you turn it on later, you'll want policies like:
--   alter table public.profiles enable row level security;
--   create policy "read own profile"   on public.profiles for select to authenticated using  ((select auth.uid()) = id);
--   create policy "update own profile" on public.profiles for update to authenticated using  ((select auth.uid()) = id);


-- 2. TRIGGER: create a profile row on first sign-in ----------
-- Fires once, when Supabase inserts the auth.users row.
-- security definer lets it write to public.profiles even though the
-- signing-in user has no rights yet. search_path = '' forces every
-- name to be fully qualified, which is what makes that safe.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  -- Prefer to pre-fill names from Google instead? Swap the insert above
  -- for this one. Note that the "prompt for your name" screen will then
  -- only appear for accounts whose Google profile has no name set.
  --
  -- insert into public.profiles (id, email, first_name, last_name)
  -- values (
  --   new.id,
  --   new.email,
  --   new.raw_user_meta_data ->> 'given_name',
  --   new.raw_user_meta_data ->> 'family_name'
  -- );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. AVATAR STORAGE -----------------------------------------
-- Images live in Storage (object storage). The database holds only
-- the path string. This is the "no binary data in your relational
-- database" rule from the assignment.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- storage.objects ALWAYS has RLS on; it's a Supabase-managed table and
-- the assignment's "RLS off" note doesn't apply to it. Without these
-- three policies your uploads fail with "new row violates row-level
-- security policy".
-- The folder check means a user can only write inside a folder named
-- after their own uuid: avatars/<user-id>/<filename>
create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "users can replace their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );


-- 4. VERIFY --------------------------------------------------
-- After your first Google sign-in, run this. You should see one row
-- with your email and two NULL name columns.
--   select * from public.profiles;
