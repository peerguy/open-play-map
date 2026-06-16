update public.credits
set status = 'void'
where action = 'add-review'
  and target_type = 'review'
  and status <> 'void'
  and exists (
    select 1
    from public.reviews
    join public.locations on locations.id = reviews.location_id
    where reviews.id = credits.target_id
      and (
        reviews.status <> 'published'
        or locations.status <> 'approved'
      )
  );

update public.credits
set status = 'void'
where action = 'add-photo'
  and target_type = 'photo'
  and status <> 'void'
  and exists (
    select 1
    from public.photos
    join public.locations on locations.id = photos.location_id
    left join public.reviews on reviews.id = photos.review_id
    where photos.id = credits.target_id
      and (
        photos.status <> 'approved'
        or locations.status <> 'approved'
        or (photos.review_id is not null and reviews.status <> 'published')
      )
  );

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

  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.status in ('archived', 'rejected') then
    update public.credits
    set status = 'void'
    where status <> 'void'
      and (
        (action = 'add-location' and target_type = 'location' and target_id = new.id and new.status = 'archived')
        or (action = 'add-review' and target_type = 'review' and target_id in (
          select reviews.id from public.reviews where reviews.location_id = new.id
        ))
        or (action = 'add-photo' and target_type = 'photo' and target_id in (
          select photos.id from public.photos where photos.location_id = new.id
        ))
        or (action = 'suggested-edit' and target_type = 'suggested-edit' and target_id in (
          select suggested_edits.id from public.suggested_edits where suggested_edits.location_id = new.id
        ))
      );
  end if;

  return new;
end;
$$;

create or replace function public.current_user_contributions()
returns table (
  profile jsonb,
  locations jsonb,
  reviews jsonb,
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
      select jsonb_agg(to_jsonb(credit_rows) order by credit_rows.created_at desc)
      from (
        select credits.*
        from public.credits
        where credits.user_id = me.user_id
      ) as credit_rows
    ), '[]'::jsonb) as credits,
    coalesce((
      select sum(credits.active_delta) filter (where credits.status = 'approved')
      from public.credits
      where credits.user_id = me.user_id
    ), 0)::integer as active_credits,
    coalesce((
      select sum(credits.lifetime_delta) filter (where credits.status = 'approved')
      from public.credits
      where credits.user_id = me.user_id
    ), 0)::integer as lifetime_credits
  from me
  where me.user_id is not null;
$$;

revoke all on function public.current_user_contributions() from public;
revoke all on function public.current_user_contributions() from anon;
grant execute on function public.current_user_contributions() to authenticated;
