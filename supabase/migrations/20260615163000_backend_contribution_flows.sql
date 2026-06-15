alter table public.reports
add column if not exists metadata jsonb not null default '{}';

create unique index if not exists reports_open_target_once
on public.reports (reporter_id, target_type, target_id)
where status = 'open';

create unique index if not exists credits_once_per_target
on public.credits (user_id, action, target_type, target_id)
where target_id is not null;

drop policy if exists "users can read own submitted locations" on public.locations;
create policy "users can read own submitted locations"
on public.locations for select
using (submitted_by = auth.uid());

drop policy if exists "users can read own submitted location slots" on public.open_play_slots;
create policy "users can read own submitted location slots"
on public.open_play_slots for select
using (
  exists (
    select 1
    from public.locations
    where locations.id = open_play_slots.location_id
      and locations.submitted_by = auth.uid()
  )
);

drop policy if exists "users can manage own pending location slots" on public.open_play_slots;
create policy "users can manage own pending location slots"
on public.open_play_slots for all
using (
  exists (
    select 1
    from public.locations
    where locations.id = open_play_slots.location_id
      and locations.submitted_by = auth.uid()
      and locations.status = 'pending'
  )
)
with check (
  exists (
    select 1
    from public.locations
    where locations.id = open_play_slots.location_id
      and locations.submitted_by = auth.uid()
      and locations.status = 'pending'
  )
);

drop policy if exists "users can read own reports" on public.reports;
create policy "users can read own reports"
on public.reports for select
using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists "signed-in users can submit own reviews" on public.reviews;
create policy "signed-in users can submit own reviews"
on public.reviews for insert
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and exists (
    select 1
    from public.locations
    where locations.id = reviews.location_id
      and locations.status = 'approved'
  )
);

drop policy if exists "users can update own reviews" on public.reviews;
create policy "users can update own reviews"
on public.reviews for update
using (user_id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and status = 'published'
    and exists (
      select 1
      from public.locations
      where locations.id = reviews.location_id
        and locations.status = 'approved'
    )
  )
);

create or replace function public.contribution_credit_value(contribution_action text)
returns integer
language sql
immutable
as $$
  select case contribution_action
    when 'add-review' then 1
    when 'add-photo' then 2
    when 'add-location' then 5
    when 'suggested-edit' then 3
    else 0
  end;
$$;

create or replace function public.award_contribution_credit(
  credit_user_id uuid,
  credit_action text,
  credit_target_type text,
  credit_target_id uuid,
  credit_status text default 'approved',
  credit_awarded_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  credit_amount integer;
begin
  credit_amount := public.contribution_credit_value(credit_action);
  if credit_user_id is null or credit_amount <= 0 then
    return;
  end if;

  insert into public.credits (
    user_id,
    action,
    target_type,
    target_id,
    active_delta,
    lifetime_delta,
    status,
    awarded_by
  ) values (
    credit_user_id,
    credit_action,
    credit_target_type,
    credit_target_id,
    credit_amount,
    credit_amount,
    credit_status,
    credit_awarded_by
  )
  on conflict (user_id, action, target_type, target_id)
  where target_id is not null
  do nothing;
end;
$$;

create or replace function public.award_location_submit_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.submitted_by is not null then
    perform public.award_contribution_credit(
      new.submitted_by,
      'add-location',
      'location',
      new.id,
      case when new.status = 'approved' then 'approved' else 'pending' end,
      new.approved_by
    );
  end if;

  if tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('approved', 'rejected') then
    update public.credits
    set
      status = new.status,
      awarded_by = coalesce(new.approved_by, awarded_by)
    where action = 'add-location'
      and target_type = 'location'
      and target_id = new.id
      and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists award_location_submit_credit_trigger on public.locations;
create trigger award_location_submit_credit_trigger
after insert or update of status on public.locations
for each row execute function public.award_location_submit_credit();

create or replace function public.award_review_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' then
    perform public.award_contribution_credit(
      new.user_id,
      'add-review',
      'review',
      new.id,
      'approved',
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists award_review_credit_trigger on public.reviews;
create trigger award_review_credit_trigger
after insert on public.reviews
for each row execute function public.award_review_credit();

create or replace function public.award_photo_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and tg_op = 'INSERT' then
    perform public.award_contribution_credit(
      new.uploaded_by,
      'add-photo',
      'photo',
      new.id,
      'approved',
      null
    );
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.award_contribution_credit(
      new.uploaded_by,
      'add-photo',
      'photo',
      new.id,
      'approved',
      null
    );
  end if;

  return new;
end;
$$;

drop trigger if exists award_photo_credit_trigger on public.photos;
create trigger award_photo_credit_trigger
after insert or update of status on public.photos
for each row execute function public.award_photo_credit();

create or replace function public.award_suggested_edit_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    perform public.award_contribution_credit(
      new.submitted_by,
      'suggested-edit',
      'suggested-edit',
      new.id,
      'approved',
      new.reviewed_by
    );
  end if;

  return new;
end;
$$;

drop trigger if exists award_suggested_edit_credit_trigger on public.suggested_edits;
create trigger award_suggested_edit_credit_trigger
after update of status on public.suggested_edits
for each row execute function public.award_suggested_edit_credit();

create or replace function public.location_reviews()
returns table (
  id uuid,
  location_id uuid,
  location_slug text,
  location_name text,
  user_id uuid,
  username text,
  profile_skill_level text,
  body text,
  visited_on date,
  skill_levels text[],
  crowd text,
  best_time text,
  reliability text,
  net_setup text,
  play_format text,
  beginner_friendly text,
  fees text,
  amenities text,
  lighting text,
  scheduling_app text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    reviews.id,
    reviews.location_id,
    locations.slug as location_slug,
    locations.name as location_name,
    reviews.user_id,
    profiles.username,
    profiles.skill_level as profile_skill_level,
    reviews.body,
    reviews.visited_on,
    reviews.skill_levels,
    reviews.crowd,
    reviews.best_time,
    reviews.reliability,
    reviews.net_setup,
    reviews.play_format,
    reviews.beginner_friendly,
    reviews.fees,
    reviews.amenities,
    reviews.lighting,
    reviews.scheduling_app,
    reviews.status,
    reviews.created_at,
    reviews.updated_at
  from public.reviews
  join public.locations on locations.id = reviews.location_id
  join public.profiles on profiles.id = reviews.user_id
  where reviews.status = 'published'
    and locations.status = 'approved'
  order by reviews.updated_at desc, reviews.created_at desc;
$$;

create or replace function public.public_leaderboard()
returns table (
  user_id uuid,
  username text,
  active_credits integer,
  lifetime_credits integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    profiles.id as user_id,
    profiles.username,
    coalesce(sum(credits.active_delta) filter (where credits.status = 'approved'), 0)::integer as active_credits,
    coalesce(sum(credits.lifetime_delta) filter (where credits.status = 'approved'), 0)::integer as lifetime_credits
  from public.profiles
  left join public.credits on credits.user_id = profiles.id
  group by profiles.id, profiles.username
  having coalesce(sum(credits.lifetime_delta) filter (where credits.status = 'approved'), 0) > 0
      or coalesce(sum(credits.active_delta) filter (where credits.status = 'approved'), 0) > 0
  order by lifetime_credits desc, active_credits desc, profiles.username asc;
$$;

create or replace function public.public_monthly_drawings()
returns table (
  id uuid,
  drawing_month date,
  username text,
  prize text,
  active_credits_at_draw integer,
  drawn_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    monthly_drawings.id,
    monthly_drawings.drawing_month,
    profiles.username,
    monthly_drawings.prize,
    monthly_drawings.active_credits_at_draw,
    monthly_drawings.drawn_at
  from public.monthly_drawings
  left join public.profiles on profiles.id = monthly_drawings.winner_user_id
  where monthly_drawings.drawn_at is not null
  order by monthly_drawings.drawing_month desc;
$$;

grant execute on function public.location_reviews() to anon, authenticated;
grant execute on function public.public_leaderboard() to anon, authenticated;
grant execute on function public.public_monthly_drawings() to anon, authenticated;
