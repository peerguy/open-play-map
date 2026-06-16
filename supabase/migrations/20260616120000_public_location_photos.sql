create or replace function public.location_photos()
returns table (
  id uuid,
  location_id uuid,
  location_slug text,
  location_name text,
  review_id uuid,
  uploaded_by uuid,
  username text,
  storage_path text,
  caption text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    photos.id,
    photos.location_id,
    locations.slug as location_slug,
    locations.name as location_name,
    photos.review_id,
    photos.uploaded_by,
    profiles.username,
    photos.storage_path,
    photos.caption,
    photos.status,
    photos.created_at
  from public.photos
  join public.locations on locations.id = photos.location_id
  left join public.profiles on profiles.id = photos.uploaded_by
  where photos.status = 'approved'
    and locations.status = 'approved'
  order by photos.created_at asc;
$$;

grant execute on function public.location_photos() to anon, authenticated;
