-- 012: members can reword their own text works, within a length cap.
--
-- Run after 010 and 011. Safe to re-run.
--
-- What a member may do, and where each rule lives:
--   * only their own member work, only today, only humour or poetry,
--     only before it is accessioned           -> RLS update policy
--   * only the wording (body), nothing else    -> guard trigger
--   * at most 280 characters (humour) or 600 (poetry), never blank
--                                              -> guard trigger
--   * the model wording is kept                -> original_body, set once
--
-- Score and vote_count are written by sync_work_score(), a security
-- definer function, so it runs as the table owner and the guard does not
-- apply to it. Superadmins (adminmoda) are exempt as well.

alter table public.works
  add column if not exists original_body text,
  add column if not exists edited_at timestamptz;

comment on column public.works.original_body is
  'The model wording, kept the first time a member edits the work. Null means never edited.';
comment on column public.works.edited_at is
  'When the member last changed the wording.';

-- One place for the caps. lib/work-limits.ts mirrors these numbers.
create or replace function public.work_body_limit(dept text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case dept when 'humour' then 280 when 'poetry' then 600 else null end
$$;

drop policy if exists "members edit own un-accessioned text works" on public.works;
create policy "members edit own un-accessioned text works"
  on public.works
  for update
  to authenticated
  using (
    origin = 'member'
    and author_id = (select auth.uid())
    and accessioned_at is null
    and hung_on = current_date
    and department in ('humour', 'poetry')
  )
  with check (
    origin = 'member'
    and author_id = (select auth.uid())
    and accessioned_at is null
    and hung_on = current_date
    and department in ('humour', 'poetry')
  );

create or replace function public.guard_member_work_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cap integer;
begin
  -- Definer functions (vote sync, the nightly close) run as the owner.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (select public.is_superadmin()) then
    return new;
  end if;

  if (to_jsonb(new) - 'body' - 'original_body' - 'edited_at')
     is distinct from
     (to_jsonb(old) - 'body' - 'original_body' - 'edited_at') then
    raise exception 'Members can change the wording of a work and nothing else.'
      using errcode = '42501';
  end if;

  -- The bookkeeping columns are never the member to set.
  new.original_body := old.original_body;
  new.edited_at := old.edited_at;

  if new.body is not distinct from old.body then
    return new;
  end if;

  new.body := btrim(new.body);
  if new.body is null or new.body = '' then
    raise exception 'A work cannot be blank.' using errcode = '23514';
  end if;

  cap := public.work_body_limit(new.department);
  if cap is not null and char_length(new.body) > cap then
    raise exception 'That is % characters; the limit in % is %.',
      char_length(new.body), new.department, cap
      using errcode = '23514';
  end if;

  new.original_body := coalesce(old.original_body, old.body);
  new.edited_at := now();
  return new;
end;
$$;

revoke execute on function public.guard_member_work_edit() from public, anon, authenticated;

drop trigger if exists guard_member_work_edit on public.works;
create trigger guard_member_work_edit
  before update on public.works
  for each row execute function public.guard_member_work_edit();
