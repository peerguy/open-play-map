insert into public.locations (
  slug,
  name,
  address,
  city,
  state,
  country,
  latitude,
  longitude,
  access,
  is_free,
  court_count,
  surface,
  indoor_outdoor,
  skill_levels,
  reliability,
  notes,
  source_url,
  last_verified,
  status,
  approved_at
) values (
  'example-leonardtown-wharf',
  'Example Park - Leonardtown Wharf Area',
  'Leonardtown, MD',
  'Leonardtown',
  'MD',
  'USA',
  38.2912,
  -76.6358,
  'public',
  true,
  null,
  'unknown',
  'outdoor',
  '{}',
  'uncertain',
  'Sample record used to prove the map/search flow.',
  null,
  '2026-05-03',
  'approved',
  now()
) on conflict (slug) do update set
  name = excluded.name,
  address = excluded.address,
  city = excluded.city,
  state = excluded.state,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  access = excluded.access,
  is_free = excluded.is_free,
  court_count = excluded.court_count,
  surface = excluded.surface,
  indoor_outdoor = excluded.indoor_outdoor,
  skill_levels = excluded.skill_levels,
  reliability = excluded.reliability,
  notes = excluded.notes,
  source_url = excluded.source_url,
  last_verified = excluded.last_verified,
  status = excluded.status,
  updated_at = now();

delete from public.open_play_slots
where location_id = (
  select id from public.locations where slug = 'example-leonardtown-wharf'
);

insert into public.open_play_slots (location_id, days, notes)
select id, array['Example only - verify locally'], 'TBD - Replace this sample with real open-play info.'
from public.locations
where slug = 'example-leonardtown-wharf';
