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
                'storage_path', photos.storage_path,
                'status', photos.status
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
