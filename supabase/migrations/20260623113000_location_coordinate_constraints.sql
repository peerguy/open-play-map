update public.locations
set
  longitude = -77.471965,
  updated_at = now()
where id = '784dd290-8960-4e8e-9419-4b6f98a784d8'
  and longitude = -77471965;

alter table public.locations
  drop constraint if exists locations_latitude_range;

alter table public.locations
  drop constraint if exists locations_longitude_range;

alter table public.locations
  add constraint locations_latitude_range
  check (latitude between -90 and 90);

alter table public.locations
  add constraint locations_longitude_range
  check (longitude between -180 and 180);
