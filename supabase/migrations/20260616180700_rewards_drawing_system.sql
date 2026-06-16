alter table public.credits
drop constraint if exists credits_action_check;

alter table public.credits
add constraint credits_action_check
check (action in ('add-location', 'add-review', 'add-photo', 'suggested-edit', 'manual-adjustment', 'monthly-reset', 'signup-bonus'));

create table if not exists public.reward_periods (
  id uuid primary key default gen_random_uuid(),
  drawing_month date not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  drawing_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'drawn', 'cancelled')),
  rules_version text not null default '2026-08-01',
  official_rules_url text not null default 'official-rules.html',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reward_periods enable row level security;

drop policy if exists "anyone can read reward periods" on public.reward_periods;
create policy "anyone can read reward periods"
on public.reward_periods for select
using (true);

drop policy if exists "admins can manage reward periods" on public.reward_periods;
create policy "admins can manage reward periods"
on public.reward_periods for all
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.drawing_entries (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.reward_periods(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_count integer not null check (entry_count > 0),
  active_credits_at_snapshot integer not null default 0,
  lifetime_credits_at_snapshot integer not null default 0,
  snapshot jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (period_id, user_id)
);

alter table public.drawing_entries enable row level security;

drop policy if exists "admins can read drawing entries" on public.drawing_entries;
create policy "admins can read drawing entries"
on public.drawing_entries for select
using (public.is_admin());

drop policy if exists "admins can manage drawing entries" on public.drawing_entries;
create policy "admins can manage drawing entries"
on public.drawing_entries for all
using (public.is_admin())
with check (public.is_admin());

alter table public.monthly_drawings
add column if not exists reward_period_id uuid references public.reward_periods(id) on delete set null,
add column if not exists total_entries integer,
add column if not exists winning_entry_number integer,
add column if not exists rules_version text not null default '2026-08-01',
add column if not exists official_rules_url text not null default 'official-rules.html',
add column if not exists status text not null default 'drawn' check (status in ('drawn', 'claimed', 'redrawn', 'cancelled')),
add column if not exists winner_notified_at timestamptz,
add column if not exists winner_claim_deadline timestamptz,
add column if not exists redraw_of uuid references public.monthly_drawings(id) on delete set null,
add column if not exists notes text;

alter table public.monthly_drawings
drop constraint if exists monthly_drawings_drawing_month_key;

drop index if exists public.monthly_drawings_reward_period_once;

create unique index if not exists monthly_drawings_current_period_once
on public.monthly_drawings (reward_period_id)
where reward_period_id is not null
  and status in ('drawn', 'claimed');

create or replace function public.contribution_credit_value(contribution_action text)
returns integer
language sql
immutable
as $$
  select case contribution_action
    when 'signup-bonus' then 1
    when 'add-review' then 1
    when 'add-photo' then 2
    when 'add-location' then 5
    when 'suggested-edit' then 3
    else 0
  end;
$$;

create or replace function public.random_drawing_entry(total_entries integer)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  random_bytes bytea;
  random_value bigint;
begin
  if total_entries is null or total_entries <= 0 then
    raise exception 'Total entries must be greater than zero';
  end if;

  random_bytes := gen_random_bytes(4);
  random_value :=
    get_byte(random_bytes, 0)::bigint * 16777216
    + get_byte(random_bytes, 1)::bigint * 65536
    + get_byte(random_bytes, 2)::bigint * 256
    + get_byte(random_bytes, 3)::bigint;

  return (random_value % total_entries)::integer + 1;
end;
$$;

create or replace function public.ensure_signup_bonus_credit(profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if profile_id is null then
    return;
  end if;

  insert into public.credits (
    user_id,
    action,
    target_type,
    target_id,
    active_delta,
    lifetime_delta,
    status
  ) values (
    profile_id,
    'signup-bonus',
    'profile',
    profile_id,
    1,
    0,
    'approved'
  )
  on conflict (user_id, action, target_type, target_id)
  where target_id is not null
  do nothing;
end;
$$;

create or replace function public.award_profile_signup_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_signup_bonus_credit(new.id);
  return new;
end;
$$;

drop trigger if exists award_profile_signup_bonus_trigger on public.profiles;
create trigger award_profile_signup_bonus_trigger
after insert on public.profiles
for each row execute function public.award_profile_signup_bonus();

select public.ensure_signup_bonus_credit(profiles.id)
from public.profiles;

create or replace function public.valid_contribution_credits()
returns table (
  id text,
  user_id uuid,
  action text,
  target_type text,
  target_id uuid,
  active_delta integer,
  lifetime_delta integer,
  status text,
  awarded_by uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with approved_locations as (
    select
      'location:' || locations.id::text as id,
      locations.submitted_by as user_id,
      'add-location'::text as action,
      'location'::text as target_type,
      locations.id as target_id,
      5 as active_delta,
      5 as lifetime_delta,
      'approved'::text as status,
      locations.approved_by as awarded_by,
      coalesce(locations.approved_at, locations.created_at) as created_at
    from public.locations
    where locations.status = 'approved'
      and locations.submitted_by is not null
  ),
  location_image_bonus as (
    select
      'location-image:' || locations.id::text as id,
      locations.submitted_by as user_id,
      'add-photo'::text as action,
      'location'::text as target_type,
      locations.id as target_id,
      2 as active_delta,
      2 as lifetime_delta,
      'approved'::text as status,
      locations.approved_by as awarded_by,
      min(photos.created_at) as created_at
    from public.locations
    join public.photos on photos.location_id = locations.id
      and photos.review_id is null
      and photos.status = 'approved'
      and photos.uploaded_by = locations.submitted_by
    where locations.status = 'approved'
      and locations.submitted_by is not null
    group by locations.id, locations.submitted_by, locations.approved_by
  ),
  approved_reviews as (
    select
      'review:' || reviews.id::text as id,
      reviews.user_id,
      'add-review'::text as action,
      'review'::text as target_type,
      reviews.id as target_id,
      1 as active_delta,
      1 as lifetime_delta,
      'approved'::text as status,
      null::uuid as awarded_by,
      reviews.created_at
    from public.reviews
    join public.locations on locations.id = reviews.location_id
    where reviews.status = 'published'
      and locations.status = 'approved'
  ),
  review_image_bonus as (
    select
      'review-image:' || reviews.id::text as id,
      reviews.user_id,
      'add-photo'::text as action,
      'review'::text as target_type,
      reviews.id as target_id,
      2 as active_delta,
      2 as lifetime_delta,
      'approved'::text as status,
      null::uuid as awarded_by,
      min(photos.created_at) as created_at
    from public.reviews
    join public.locations on locations.id = reviews.location_id
    join public.photos on photos.review_id = reviews.id
      and photos.status = 'approved'
      and photos.uploaded_by = reviews.user_id
    where reviews.status = 'published'
      and locations.status = 'approved'
    group by reviews.id, reviews.user_id
  ),
  approved_suggested_edits as (
    select
      'suggested-edit:' || suggested_edits.id::text as id,
      suggested_edits.submitted_by as user_id,
      'suggested-edit'::text as action,
      'suggested-edit'::text as target_type,
      suggested_edits.id as target_id,
      3 as active_delta,
      3 as lifetime_delta,
      'approved'::text as status,
      suggested_edits.reviewed_by as awarded_by,
      coalesce(suggested_edits.reviewed_at, suggested_edits.created_at) as created_at
    from public.suggested_edits
    join public.locations on locations.id = suggested_edits.location_id
    where suggested_edits.status = 'approved'
      and locations.status = 'approved'
  ),
  suggested_edit_image_bonus as (
    select
      'suggested-edit-image:' || suggested_edits.id::text as id,
      suggested_edits.submitted_by as user_id,
      'add-photo'::text as action,
      'suggested-edit'::text as target_type,
      suggested_edits.id as target_id,
      2 as active_delta,
      2 as lifetime_delta,
      'approved'::text as status,
      suggested_edits.reviewed_by as awarded_by,
      coalesce(suggested_edits.reviewed_at, suggested_edits.created_at) as created_at
    from public.suggested_edits
    join public.locations on locations.id = suggested_edits.location_id
    where suggested_edits.status = 'approved'
      and locations.status = 'approved'
      and (
        coalesce(case when jsonb_typeof(suggested_edits.suggested_location -> 'photos') = 'array' then jsonb_array_length(suggested_edits.suggested_location -> 'photos') else 0 end, 0)
        + coalesce(case when jsonb_typeof(suggested_edits.suggested_location -> 'imageUrls') = 'array' then jsonb_array_length(suggested_edits.suggested_location -> 'imageUrls') else 0 end, 0)
        + coalesce(case when jsonb_typeof(suggested_edits.suggested_location -> 'images') = 'array' then jsonb_array_length(suggested_edits.suggested_location -> 'images') else 0 end, 0)
      ) > 0
  ),
  ledger_adjustments as (
    select
      'ledger:' || credits.id::text as id,
      credits.user_id,
      credits.action,
      credits.target_type,
      credits.target_id,
      credits.active_delta,
      credits.lifetime_delta,
      credits.status,
      credits.awarded_by,
      credits.created_at
    from public.credits
    where credits.status = 'approved'
      and credits.action in ('manual-adjustment', 'monthly-reset', 'signup-bonus')
  )
  select * from approved_locations
  union all select * from location_image_bonus
  union all select * from approved_reviews
  union all select * from review_image_bonus
  union all select * from approved_suggested_edits
  union all select * from suggested_edit_image_bonus
  union all select * from ledger_adjustments;
$$;

create or replace function public.ensure_reward_period(p_drawing_month date default null)
returns public.reward_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  target_month date;
  start_month date;
  period_row public.reward_periods;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  target_month := date_trunc('month', coalesce(p_drawing_month, (now() at time zone 'America/New_York')::date))::date;
  if target_month < date '2026-08-01' then
    target_month := date '2026-08-01';
  end if;

  start_month := (target_month - interval '1 month')::date;

  insert into public.reward_periods (
    drawing_month,
    starts_at,
    ends_at,
    drawing_at,
    status,
    rules_version,
    official_rules_url
  ) values (
    target_month,
    make_timestamptz(extract(year from start_month)::integer, extract(month from start_month)::integer, 1, 0, 0, 0, 'America/New_York'),
    make_timestamptz(extract(year from target_month)::integer, extract(month from target_month)::integer, 1, 17, 0, 0, 'America/New_York'),
    make_timestamptz(extract(year from target_month)::integer, extract(month from target_month)::integer, 1, 17, 0, 0, 'America/New_York'),
    'scheduled',
    '2026-08-01',
    'official-rules.html'
  )
  on conflict (drawing_month) do update
  set
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    drawing_at = excluded.drawing_at,
    official_rules_url = excluded.official_rules_url,
    updated_at = now()
  where public.reward_periods.status = 'scheduled';

  select *
  into period_row
  from public.reward_periods
  where drawing_month = target_month;

  return period_row;
end;
$$;

create or replace function public.admin_reward_periods()
returns table (
  id uuid,
  drawing_id uuid,
  drawing_month date,
  starts_at timestamptz,
  ends_at timestamptz,
  drawing_at timestamptz,
  period_status text,
  drawing_status text,
  rules_version text,
  official_rules_url text,
  estimated_entries integer,
  total_entries integer,
  winner_user_id uuid,
  winner_username text,
  prize text,
  active_credits_at_draw integer,
  drawn_at timestamptz,
  winner_notified_at timestamptz,
  winner_claim_deadline timestamptz,
  can_run boolean,
  can_claim boolean,
  can_redraw boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  perform public.ensure_reward_period(null);

  return query
  select
    reward_periods.id,
    monthly_drawings.id as drawing_id,
    reward_periods.drawing_month,
    reward_periods.starts_at,
    reward_periods.ends_at,
    reward_periods.drawing_at,
    reward_periods.status as period_status,
    monthly_drawings.status as drawing_status,
    reward_periods.rules_version,
    reward_periods.official_rules_url,
    coalesce((select sum(public_leaderboard.active_credits)::integer from public.public_leaderboard()), 0) as estimated_entries,
    monthly_drawings.total_entries,
    monthly_drawings.winner_user_id,
    profiles.username as winner_username,
    monthly_drawings.prize,
    monthly_drawings.active_credits_at_draw,
    monthly_drawings.drawn_at,
    monthly_drawings.winner_notified_at,
    monthly_drawings.winner_claim_deadline,
    (now() >= reward_periods.drawing_at and reward_periods.status = 'scheduled') as can_run,
    (monthly_drawings.status = 'drawn') as can_claim,
    (monthly_drawings.status = 'drawn' and monthly_drawings.winner_claim_deadline is not null and now() >= monthly_drawings.winner_claim_deadline) as can_redraw
  from public.reward_periods
  left join lateral (
    select *
    from public.monthly_drawings
    where monthly_drawings.reward_period_id = reward_periods.id
      and monthly_drawings.status in ('drawn', 'claimed')
    order by monthly_drawings.drawn_at desc, monthly_drawings.created_at desc
    limit 1
  ) monthly_drawings on true
  left join public.profiles on profiles.id = monthly_drawings.winner_user_id
  order by reward_periods.drawing_month desc
  limit 12;
end;
$$;

create or replace function public.run_monthly_drawing(p_drawing_month date default null)
returns public.monthly_drawings
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.reward_periods;
  drawing_row public.monthly_drawings;
  total_entry_count integer;
  winning_number integer;
  winner_id uuid;
  winner_active_credits integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into period_row
  from public.ensure_reward_period(p_drawing_month);

  if period_row.status = 'drawn' then
    select *
    into drawing_row
    from public.monthly_drawings
    where reward_period_id = period_row.id
      and status in ('drawn', 'claimed')
    order by drawn_at desc, created_at desc
    limit 1;
    return drawing_row;
  end if;

  if now() < period_row.drawing_at then
    raise exception 'Drawing is scheduled for %', period_row.drawing_at;
  end if;

  delete from public.drawing_entries
  where period_id = period_row.id;

  insert into public.drawing_entries (
    period_id,
    user_id,
    entry_count,
    active_credits_at_snapshot,
    lifetime_credits_at_snapshot,
    snapshot
  )
  select
    period_row.id,
    leaderboard.user_id,
    leaderboard.active_credits,
    leaderboard.active_credits,
    leaderboard.lifetime_credits,
    jsonb_build_object(
      'username', leaderboard.username,
      'active_credits', leaderboard.active_credits,
      'lifetime_credits', leaderboard.lifetime_credits,
      'snapshot_at', now()
    )
  from public.public_leaderboard() leaderboard
  where leaderboard.active_credits > 0;

  select coalesce(sum(drawing_entries.entry_count), 0)::integer
  into total_entry_count
  from public.drawing_entries
  where period_id = period_row.id;

  if total_entry_count <= 0 then
    raise exception 'No eligible drawing entries';
  end if;

  winning_number := public.random_drawing_entry(total_entry_count);

  with weighted_entries as (
    select
      drawing_entries.user_id,
      drawing_entries.active_credits_at_snapshot,
      sum(drawing_entries.entry_count) over (order by drawing_entries.created_at, drawing_entries.user_id) as cumulative_entries
    from public.drawing_entries
    where drawing_entries.period_id = period_row.id
  )
  select
    weighted_entries.user_id,
    weighted_entries.active_credits_at_snapshot
  into
    winner_id,
    winner_active_credits
  from weighted_entries
  where weighted_entries.cumulative_entries >= winning_number
  order by weighted_entries.cumulative_entries
  limit 1;

  insert into public.monthly_drawings (
    drawing_month,
    reward_period_id,
    winner_user_id,
    prize,
    active_credits_at_draw,
    drawn_by,
    drawn_at,
    total_entries,
    winning_entry_number,
    rules_version,
    official_rules_url,
    status,
    winner_notified_at,
    winner_claim_deadline
  ) values (
    period_row.drawing_month,
    period_row.id,
    winner_id,
    'Any paddle on scooppickleball.com with standard shipping included, or up to $100 worth of gear from scooppickleball.com with standard shipping included',
    winner_active_credits,
    auth.uid(),
    now(),
    total_entry_count,
    winning_number,
    period_row.rules_version,
    period_row.official_rules_url,
    'drawn',
    now(),
    now() + interval '14 days'
  )
  returning * into drawing_row;

  update public.reward_periods
  set status = 'drawn', updated_at = now()
  where id = period_row.id;

  return drawing_row;
end;
$$;

create or replace function public.claim_monthly_drawing(p_drawing_id uuid)
returns public.monthly_drawings
language plpgsql
security definer
set search_path = public
as $$
declare
  drawing_row public.monthly_drawings;
  current_active_credits integer;
  post_draw_active_credits integer;
  target_active_credits integer;
  reset_delta integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into drawing_row
  from public.monthly_drawings
  where id = p_drawing_id
  for update;

  if not found then
    raise exception 'Drawing not found';
  end if;

  if drawing_row.status = 'claimed' then
    return drawing_row;
  end if;

  if drawing_row.status <> 'drawn' then
    raise exception 'Only the current drawn winner can be marked claimed';
  end if;

  select coalesce(public_leaderboard.active_credits, 0)::integer
  into current_active_credits
  from public.public_leaderboard()
  where public_leaderboard.user_id = drawing_row.winner_user_id;

  current_active_credits := coalesce(current_active_credits, 0);

  select coalesce(sum(valid_credits.active_delta), 0)::integer
  into post_draw_active_credits
  from public.valid_contribution_credits() valid_credits
  where valid_credits.user_id = drawing_row.winner_user_id
    and valid_credits.status = 'approved'
    and valid_credits.action <> 'monthly-reset'
    and valid_credits.created_at > drawing_row.drawn_at;

  target_active_credits := greatest(1, 1 + coalesce(post_draw_active_credits, 0));
  reset_delta := least(0, target_active_credits - current_active_credits);

  if reset_delta < 0 then
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
      drawing_row.winner_user_id,
      'monthly-reset',
      'monthly-drawing',
      drawing_row.id,
      reset_delta,
      0,
      'approved',
      auth.uid()
    )
    on conflict (user_id, action, target_type, target_id)
    where target_id is not null
    do nothing;
  end if;

  update public.monthly_drawings
  set status = 'claimed'
  where id = drawing_row.id
  returning * into drawing_row;

  return drawing_row;
end;
$$;

create or replace function public.run_monthly_redraw(p_drawing_id uuid)
returns public.monthly_drawings
language plpgsql
security definer
set search_path = public
as $$
declare
  source_drawing public.monthly_drawings;
  redraw_row public.monthly_drawings;
  total_entry_count integer;
  winning_number integer;
  winner_id uuid;
  winner_active_credits integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into source_drawing
  from public.monthly_drawings
  where id = p_drawing_id
  for update;

  if not found then
    raise exception 'Drawing not found';
  end if;

  if source_drawing.status <> 'drawn' then
    raise exception 'Only the current drawn winner can be redrawn';
  end if;

  if source_drawing.winner_claim_deadline is null or now() < source_drawing.winner_claim_deadline then
    raise exception 'The 14 day claim period has not ended yet';
  end if;

  select coalesce(sum(drawing_entries.entry_count), 0)::integer
  into total_entry_count
  from public.drawing_entries
  where drawing_entries.period_id = source_drawing.reward_period_id
    and not exists (
      select 1
      from public.monthly_drawings previous_drawings
      where previous_drawings.reward_period_id = source_drawing.reward_period_id
        and previous_drawings.winner_user_id = drawing_entries.user_id
    );

  if total_entry_count <= 0 then
    raise exception 'No alternate eligible drawing entries';
  end if;

  winning_number := public.random_drawing_entry(total_entry_count);

  with weighted_entries as (
    select
      drawing_entries.user_id,
      drawing_entries.active_credits_at_snapshot,
      sum(drawing_entries.entry_count) over (order by drawing_entries.created_at, drawing_entries.user_id) as cumulative_entries
    from public.drawing_entries
    where drawing_entries.period_id = source_drawing.reward_period_id
      and not exists (
        select 1
        from public.monthly_drawings previous_drawings
        where previous_drawings.reward_period_id = source_drawing.reward_period_id
          and previous_drawings.winner_user_id = drawing_entries.user_id
      )
  )
  select
    weighted_entries.user_id,
    weighted_entries.active_credits_at_snapshot
  into
    winner_id,
    winner_active_credits
  from weighted_entries
  where weighted_entries.cumulative_entries >= winning_number
  order by weighted_entries.cumulative_entries
  limit 1;

  update public.monthly_drawings
  set
    status = 'redrawn',
    notes = concat_ws(E'\n', nullif(notes, ''), 'Redrawn after the claim deadline passed.')
  where id = source_drawing.id;

  insert into public.monthly_drawings (
    drawing_month,
    reward_period_id,
    winner_user_id,
    prize,
    active_credits_at_draw,
    drawn_by,
    drawn_at,
    total_entries,
    winning_entry_number,
    rules_version,
    official_rules_url,
    status,
    winner_notified_at,
    winner_claim_deadline,
    redraw_of
  ) values (
    source_drawing.drawing_month,
    source_drawing.reward_period_id,
    winner_id,
    source_drawing.prize,
    winner_active_credits,
    auth.uid(),
    now(),
    total_entry_count,
    winning_number,
    source_drawing.rules_version,
    source_drawing.official_rules_url,
    'drawn',
    now(),
    now() + interval '14 days',
    source_drawing.id
  )
  returning * into redraw_row;

  return redraw_row;
end;
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
    and monthly_drawings.status = 'claimed'
  order by monthly_drawings.drawing_month desc;
$$;

revoke all on function public.ensure_signup_bonus_credit(uuid) from public;
revoke all on function public.ensure_signup_bonus_credit(uuid) from anon;
revoke all on function public.ensure_signup_bonus_credit(uuid) from authenticated;
revoke all on function public.random_drawing_entry(integer) from public;
revoke all on function public.random_drawing_entry(integer) from anon;
revoke all on function public.random_drawing_entry(integer) from authenticated;
grant execute on function public.ensure_reward_period(date) to authenticated;
grant execute on function public.admin_reward_periods() to authenticated;
grant execute on function public.run_monthly_drawing(date) to authenticated;
grant execute on function public.claim_monthly_drawing(uuid) to authenticated;
grant execute on function public.run_monthly_redraw(uuid) to authenticated;
grant execute on function public.public_monthly_drawings() to anon, authenticated;
