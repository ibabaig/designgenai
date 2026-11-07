-- ============================================================
-- MoDA 008: house commissions + a day-wide member allowance
--
-- MIGRATION. Assumes 006 and the 007 anon-policy patch have run.
-- Run in: SQL Editor -> New query -> paste -> Run
--
-- WHAT CHANGES
--   works.origin        'house' (the museum's own daily commission)
--                       vs 'member' (what visitors commission)
--   author_id nullable  a house work has no author
--   member allowance    3 per DAY across all departments, not 3 each
--   close_gallery()     credits a house work to the Museum
-- ============================================================


-- ============================================================
-- 1. WHO MADE IT
-- ============================================================
alter table public.works add column origin text not null default 'member'
  check (origin in ('house', 'member'));

-- A house work has no author. It is commissioned by the midnight job
-- running as service_role, which bypasses RLS entirely — so no policy
-- below needs to make room for it.
alter table public.works alter column author_id drop not null;

create index works_day_origin_idx on public.works (hung_on, origin, department);

-- Everything that exists today was made by a member.
update public.works set origin = 'member' where origin is null;


-- ============================================================
-- 2. THE MEMBER ALLOWANCE IS NOW PER DAY, NOT PER DEPARTMENT
-- ============================================================
-- Three works a day across the whole museum, so choosing WHICH
-- department to spend them in is a real decision. Previously it was
-- three in each, which made twelve and made the choice free.
--
-- Also pins origin = 'member': a client cannot pass itself off as the
-- house, whatever it sends.
drop policy if exists "members submit own works" on public.works;

create policy "members submit own works"
  on public.works for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and origin = 'member'
    and wing_id = public.current_wing_id()
    and hung_on = current_date
    and (
      select count(*) from public.works w
       where w.author_id = (select auth.uid())
         and w.hung_on = current_date
    ) < 3
  );

-- Withdrawal is unchanged in spirit, but say it explicitly: a member
-- may only ever delete their own work, never the house's. author_id is
-- null on house rows, and null = uid() is never true, so this already
-- holds — stated here so it survives a future edit.
drop policy if exists "members withdraw own un-accessioned works" on public.works;

create policy "members withdraw own un-accessioned works"
  on public.works for delete to authenticated
  using (
    origin = 'member'
    and author_id is not null
    and (select auth.uid()) = author_id
    and accessioned_at is null
  );


-- ============================================================
-- 3. CLOSING THE DAY, WITH THE HOUSE IN THE RUNNING
-- ============================================================
-- The house work competes like any other: it is the baseline the
-- membership is voting against. If nobody beats it, it is acquired and
-- credited to the Museum rather than to "an anonymous donor".
create or replace function public.close_gallery(target date default (current_date - 1))
returns table (department text, outcome text, winner bigint)
language plpgsql
security definer set search_path = ''
as $$
declare
  dept      text;
  wing      bigint;
  n_works   integer;
  n_votes   integer;
  best      record;
  result    text;
  winner_id bigint;
begin
  select w.id into wing
    from public.wings w
   where w.is_active
   order by w.sort_order
   offset (((extract(epoch from target)::bigint / 86400)
            % greatest((select count(*) from public.wings where is_active), 1)))
   limit 1;

  foreach dept in array array['humour','poetry','prints','film'] loop
    winner_id := null;
    best := null;

    select count(*) into n_works
      from public.works
     where hung_on = target and works.department = dept;

    select count(*) into n_votes
      from public.votes v
      join public.works w on w.id = v.work_id
     where w.hung_on = target and w.department = dept;

    if n_works = 0 then
      result := 'no_submissions';
    elsif n_votes = 0 then
      result := 'no_votes';
    else
      select w.id, w.score, w.origin, w.author_id into best
        from public.works w
       where w.hung_on = target and w.department = dept
         and w.accessioned_at is null
       order by w.score desc, w.vote_count desc, w.created_at asc
       limit 1;

      if best is null or best.score <= 0 then
        result := 'no_consensus';
      else
        winner_id := best.id;
        result := 'acquired';

        update public.works w
           set accessioned_at = now(),
               credit_name = case
                 when w.origin = 'house' then 'the Museum'
                 else coalesce(
                   nullif(trim(
                     coalesce((select p.first_name from public.profiles p where p.id = w.author_id), '')
                     || ' ' ||
                     coalesce((select p.last_name  from public.profiles p where p.id = w.author_id), '')
                   ), ''),
                   'an anonymous donor')
               end
         where w.id = winner_id;
      end if;
    end if;

    insert into public.exhibitions
      (held_on, exhibitions.department, wing_id, winner_work_id,
       works_submitted, votes_cast, top_score, outcome)
    values
      (target, dept, wing, winner_id,
       n_works, n_votes, (case when best is null then null else best.score end), result)
    on conflict (held_on, department) do update
      set winner_work_id  = excluded.winner_work_id,
          works_submitted = excluded.works_submitted,
          votes_cast      = excluded.votes_cast,
          top_score       = excluded.top_score,
          outcome         = excluded.outcome,
          closed_at       = now();

    department := dept;
    outcome    := result;
    winner     := winner_id;
    return next;
  end loop;
end;
$$;


-- ============================================================
-- 4. VERIFY
-- ============================================================
--   select origin, count(*) from public.works group by origin;
--
-- As `anon` in the role dropdown, today's house works must be visible:
--   select department, origin, left(body, 40) from public.works
--    where hung_on = current_date;
--
-- The allowance is now day-wide. As a member with 3 works today, an
-- insert in ANY department should fail with 42501.
