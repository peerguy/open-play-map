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
      and credits.action in ('manual-adjustment', 'monthly-reset')
  )
  select * from approved_locations
  union all select * from location_image_bonus
  union all select * from approved_reviews
  union all select * from review_image_bonus
  union all select * from approved_suggested_edits
  union all select * from suggested_edit_image_bonus
  union all select * from ledger_adjustments;
$$;

revoke all on function public.valid_contribution_credits() from public;
revoke all on function public.valid_contribution_credits() from anon;
revoke all on function public.valid_contribution_credits() from authenticated;

update public.credits
set status = 'void'
where credits.status <> 'void'
  and credits.action in ('add-location', 'add-review', 'add-photo', 'suggested-edit')
  and not exists (
    select 1
    from public.valid_contribution_credits() valid_credits
    where valid_credits.user_id = credits.user_id
      and valid_credits.action = credits.action
      and valid_credits.target_type = credits.target_type
      and valid_credits.target_id = credits.target_id
  );

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
begin
  return;
end;
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
  with totals as (
    select
      valid_credits.user_id,
      coalesce(sum(valid_credits.active_delta) filter (where valid_credits.status = 'approved'), 0)::integer as active_credits,
      coalesce(sum(valid_credits.lifetime_delta) filter (where valid_credits.status = 'approved'), 0)::integer as lifetime_credits
    from public.valid_contribution_credits() valid_credits
    group by valid_credits.user_id
  )
  select
    profiles.id as user_id,
    profiles.username,
    coalesce(totals.active_credits, 0)::integer as active_credits,
    coalesce(totals.lifetime_credits, 0)::integer as lifetime_credits
  from public.profiles
  join totals on totals.user_id = profiles.id
  where coalesce(totals.lifetime_credits, 0) > 0
     or coalesce(totals.active_credits, 0) > 0
  order by lifetime_credits desc, active_credits desc, profiles.username asc;
$$;

drop function if exists public.current_user_contributions();

create or replace function public.current_user_contributions()
returns table (
  profile jsonb,
  locations jsonb,
  reviews jsonb,
  suggested_edits jsonb,
  credits jsonb,
  active_credits integer,
  lifetime_credits integer
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as user_id
  ),
  user_credits as (
    select valid_credits.*
    from public.valid_contribution_credits() valid_credits
    join me on me.user_id = valid_credits.user_id
  )
  select
    (
      select to_jsonb(profiles)
      from public.profiles
      where profiles.id = me.user_id
    ) as profile,
    coalesce((
      select jsonb_agg(to_jsonb(location_rows) order by location_rows.created_at desc)
      from (
        select
          locations.*,
          coalesce((
            select jsonb_agg(to_jsonb(open_play_slots) order by open_play_slots.created_at asc)
            from public.open_play_slots
            where open_play_slots.location_id = locations.id
          ), '[]'::jsonb) as open_play_slots,
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', photos.id,
                'location_id', photos.location_id,
                'review_id', photos.review_id,
                'uploaded_by', photos.uploaded_by,
                'storage_path', photos.storage_path,
                'caption', photos.caption,
                'status', photos.status,
                'created_at', photos.created_at
              )
              order by photos.created_at asc
            )
            from public.photos
            where photos.location_id = locations.id
              and (
                photos.status = 'approved'
                or photos.uploaded_by = me.user_id
              )
          ), '[]'::jsonb) as photos
        from public.locations
        where locations.submitted_by = me.user_id
      ) as location_rows
    ), '[]'::jsonb) as locations,
    coalesce((
      select jsonb_agg(to_jsonb(review_rows) order by review_rows.updated_at desc, review_rows.created_at desc)
      from (
        select
          reviews.*,
          locations.slug as location_slug,
          locations.name as location_name,
          profiles.username,
          profiles.skill_level as profile_skill_level
        from public.reviews
        join public.locations on locations.id = reviews.location_id
        join public.profiles on profiles.id = reviews.user_id
        where reviews.user_id = me.user_id
          and reviews.status = 'published'
          and locations.status = 'approved'
      ) as review_rows
    ), '[]'::jsonb) as reviews,
    coalesce((
      select jsonb_agg(to_jsonb(edit_rows) order by edit_rows.created_at desc)
      from (
        select
          suggested_edits.*,
          locations.slug as location_slug,
          locations.name as location_name,
          locations.status as location_status
        from public.suggested_edits
        join public.locations on locations.id = suggested_edits.location_id
        where suggested_edits.submitted_by = me.user_id
      ) as edit_rows
    ), '[]'::jsonb) as suggested_edits,
    coalesce((
      select jsonb_agg(to_jsonb(user_credits) order by user_credits.created_at desc, user_credits.id desc)
      from user_credits
    ), '[]'::jsonb) as credits,
    coalesce((
      select sum(user_credits.active_delta) filter (where user_credits.status = 'approved')
      from user_credits
    ), 0)::integer as active_credits,
    coalesce((
      select sum(user_credits.lifetime_delta) filter (where user_credits.status = 'approved')
      from user_credits
    ), 0)::integer as lifetime_credits
  from me
  where me.user_id is not null;
$$;

revoke all on function public.current_user_contributions() from public;
revoke all on function public.current_user_contributions() from anon;
grant execute on function public.current_user_contributions() to authenticated;

create or replace function public.admin_contribution_credits()
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
  select valid_credits.*
  from public.valid_contribution_credits() valid_credits
  where public.is_admin()
  order by valid_credits.created_at desc, valid_credits.id desc;
$$;

revoke all on function public.admin_contribution_credits() from public;
revoke all on function public.admin_contribution_credits() from anon;
grant execute on function public.admin_contribution_credits() to authenticated;
