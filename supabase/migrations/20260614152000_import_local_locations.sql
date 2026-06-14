delete from public.open_play_slots
where location_id in (
  select id from public.locations
  where slug in (
    'example-leonardtown-wharf',
    'chancellors-run-regional-park-1780781010349',
    'john-baggett-park-at-laurel-grove-1780781151742',
    'cove-point-park-1780781299395',
    'bauer-drive-local-park-1780848765261',
    'white-plains-regional-park-1781276626536'
  )
);

delete from public.locations
where slug = 'example-leonardtown-wharf';

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
) values
  (
    'chancellors-run-regional-park-1780781010349',
    'Chancellors Run Regional Park',
    'Chancellors Run Regional Park, 21905, Great Mills, Saint Mary''s County, Maryland, 20634, United States',
    'Great Mills',
    'MD',
    'USA',
    38.267562,
    -76.497703,
    'public',
    true,
    6,
    'unknown',
    'unknown',
    array['beginner', 'intermediate', 'advanced'],
    'confirmed',
    '6 courts. Open play in the morning at 8:30 am and the evenings at 5:00 pm. Free to public. Winners stay and split sides.',
    null,
    '2026-06-07',
    'approved',
    now()
  ),
  (
    'john-baggett-park-at-laurel-grove-1780781151742',
    'John Baggett Park at Laurel Grove',
    'John Baggett Park at Laurel Grove, Laurel Grove, Saint Mary''s County, Maryland, United States',
    'Laurel Grove',
    'MD',
    'USA',
    38.406615,
    -76.671788,
    'public',
    true,
    4,
    'unknown',
    'unknown',
    '{}',
    'confirmed',
    'Morning open play Tuesday, Thursday, Saturday, and Sunday. Winning team stays on and splits sides.',
    null,
    '2026-06-07',
    'approved',
    now()
  ),
  (
    'cove-point-park-1780781299395',
    'Cove Point Park',
    'Cove Point Park, 750, Lusby, Calvert County, Maryland, 20657, United States',
    'Lusby',
    'MD',
    'USA',
    38.38632,
    -76.421666,
    'public',
    true,
    8,
    'unknown',
    'unknown',
    '{}',
    'confirmed',
    '8 courts. Open play Monday and Wednesday evenings starting at 4pm. Generally the intermediate and advanced people come at 4pm and then beginners and intermediates come at 6pm, but the 4pm group often plays through.',
    null,
    '2026-06-07',
    'approved',
    now()
  ),
  (
    'bauer-drive-local-park-1780848765261',
    'Bauer Drive Local Park',
    'Bauer Drive Local Park, Aspen Hill, Montgomery County, Maryland, United States',
    'Aspen Hill',
    'MD',
    'USA',
    39.094675,
    -77.107782,
    'public',
    true,
    6,
    'unknown',
    'unknown',
    array['intermediate', 'advanced'],
    'confirmed',
    'Open play pretty much all day every day. Intermediate to advanced level of play. Generally you put your paddles next to the court you want to play at and winners stay on court, sticking together after each match.',
    null,
    '2026-06-07',
    'approved',
    now()
  ),
  (
    'white-plains-regional-park-1781276626536',
    'White Plains Regional Park',
    'White Plains Regional Park, Sheffield Greens, Waldorf, Charles County, Maryland, United States',
    'Waldorf',
    'MD',
    'USA',
    38.577874,
    -76.918099,
    'public',
    true,
    6,
    'unknown',
    'unknown',
    array['beginner'],
    'uncertain',
    '',
    null,
    '2026-06-12',
    'pending',
    null
  )
on conflict (slug) do update set
  name = excluded.name,
  address = excluded.address,
  city = excluded.city,
  state = excluded.state,
  country = excluded.country,
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
  approved_at = excluded.approved_at,
  updated_at = now();

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], '08:30'::time, '10:30'::time, 'User-submitted open play info; verify before going.'
from public.locations where slug = 'chancellors-run-regional-park-1780781010349';

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], '17:00'::time, '20:00'::time, 'User-submitted open play info; verify before going.'
from public.locations where slug = 'chancellors-run-regional-park-1780781010349';

insert into public.open_play_slots (location_id, days, notes)
select id, array['Tuesday', 'Thursday', 'Saturday', 'Sunday'], 'User-submitted open play info; verify before going.'
from public.locations where slug = 'john-baggett-park-at-laurel-grove-1780781151742';

insert into public.open_play_slots (location_id, days, notes)
select id, array['Monday', 'Wednesday'], 'User-submitted open play info; verify before going.'
from public.locations where slug = 'cove-point-park-1780781299395';

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], '07:00'::time, '22:00'::time, 'User-submitted open play info; verify before going.'
from public.locations where slug = 'bauer-drive-local-park-1780848765261';

insert into public.open_play_slots (location_id, days, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 'User-submitted open play info; verify before going.'
from public.locations where slug = 'white-plains-regional-park-1781276626536';
