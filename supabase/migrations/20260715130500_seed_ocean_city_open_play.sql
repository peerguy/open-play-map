delete from public.open_play_slots
where location_id in (
  select id from public.locations
  where slug in (
    'ocean-city-northside-park-recreation-complex',
    'ocean-pines-racquet-center',
    'sea-colony-pickleball',
    'ocean-city-racquet-center',
    'bayside-park-third-street-ocean-city',
    'gorman-park-ocean-city',
    'stephen-decatur-park-berlin'
  )
);

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
  open_play_fee,
  court_count,
  surface,
  indoor_outdoor,
  skill_levels,
  reliability,
  notes,
  source_url,
  website_url,
  phone_number,
  last_verified,
  status,
  approved_at
) values
  (
    'ocean-city-northside-park-recreation-complex',
    'Northside Park Recreation Complex',
    '200 125th Street, Ocean City, MD 21842',
    'Ocean City',
    'MD',
    'USA',
    38.432565,
    -75.059392,
    'paid',
    false,
    8,
    6,
    'gym floor',
    'indoor',
    array['beginner', 'intermediate', 'advanced'],
    'confirmed',
    'Official Ocean City open play at Northside Park. Summer 2026 non-resident fee listed as $8, OC resident fee $5. Register online before going.',
    'https://oceancitymd.gov/oc/departments/recreation-parks/pickleball/',
    'https://oceancitymd.gov/oc/departments/recreation-parks/pickleball/',
    '410-250-0125',
    '2026-07-15',
    'pending',
    null
  ),
  (
    'ocean-pines-racquet-center',
    'Ocean Pines Racquet Center',
    '11443 Manklin Creek Road, Ocean Pines, MD 21811',
    'Ocean Pines',
    'MD',
    'USA',
    38.377204,
    -75.158016,
    'paid',
    false,
    13,
    12,
    'dedicated pickleball',
    'outdoor',
    array['beginner', 'intermediate', 'advanced'],
    'confirmed',
    '12 dedicated outdoor courts plus 4 additional courts. Daily fee listed as free for racquet sports members, $10 Ocean Pines residents, $13 non-residents. Sign in at the pro shop or drop box.',
    'https://www.oceanpines.org/pickleball',
    'https://www.oceanpines.org/pickleball',
    '410-641-7228',
    '2026-07-15',
    'pending',
    null
  ),
  (
    'sea-colony-pickleball',
    'Sea Colony Pickleball',
    '39359 Racquet Lane, Bethany Beach, DE 19930',
    'Bethany Beach',
    'DE',
    'USA',
    38.527968,
    -75.064089,
    'club',
    false,
    15,
    20,
    'dedicated pickleball',
    'both',
    array['intermediate', 'advanced'],
    'confirmed',
    'Open play is limited and pre-registration is required. Listed as free for Sea Colony homeowners and renters, $15 for members; call the pro shop to confirm visitor eligibility before driving from Ocean City.',
    'https://www.seacolony.com/pickleball',
    'https://www.seacolony.com/pickleball',
    '302-539-4488',
    '2026-07-15',
    'pending',
    null
  ),
  (
    'ocean-city-racquet-center',
    'Ocean City Racquet Center',
    '61st Street, Ocean City, MD 21842',
    'Ocean City',
    'MD',
    'USA',
    38.3868,
    -75.0682,
    'paid',
    false,
    null,
    10,
    'dedicated pickleball and tennis overlay',
    'outdoor',
    array['beginner', 'intermediate', 'advanced'],
    'sometimes',
    '6 dedicated pickleball courts plus 4 shared-use courts with blended lines. Equipment is available with paid reservation during the season; no equipment/net provided October to mid-May.',
    'https://oceancitymd.gov/oc/departments/recreation-parks/pickleball/',
    'https://oceancitymd.gov/oc/departments/recreation-parks/pickleball/',
    '410-250-0125',
    '2026-07-15',
    'pending',
    null
  ),
  (
    'bayside-park-third-street-ocean-city',
    'Bayside Park at 3rd Street',
    '3rd Street, Ocean City, MD 21843',
    'Ocean City',
    'MD',
    'USA',
    38.3337,
    -75.091,
    'public',
    true,
    null,
    4,
    'tennis overlay',
    'outdoor',
    array['beginner', 'intermediate'],
    'sometimes',
    'Two shared-use tennis/pickleball courts striped as 4 pickleball courts. Ocean City says pickleball nets are provided during the summer season.',
    'https://oceancitymd.gov/oc/departments/recreation-parks/pickleball/',
    'https://playtimescheduler.com/region/ocean_city-md',
    null,
    '2026-07-15',
    'pending',
    null
  ),
  (
    'gorman-park-ocean-city',
    'Gorman Park',
    '136th Street, Ocean City, MD 21842',
    'Ocean City',
    'MD',
    'USA',
    38.442445,
    -75.056915,
    'public',
    true,
    null,
    3,
    'dedicated pickleball and tennis overlay',
    'outdoor',
    array['beginner', 'intermediate'],
    'sometimes',
    'Ocean City lists 1 dedicated pickleball court with net plus 2 shared-use courts without nets provided.',
    'https://oceancitymd.gov/oc/departments/recreation-parks/pickleball/',
    'https://playtimescheduler.com/region/ocean_city-md',
    null,
    '2026-07-15',
    'pending',
    null
  ),
  (
    'stephen-decatur-park-berlin',
    'Stephen Decatur Park',
    'Tripoli Street & Route 113 South, Berlin, MD 21811',
    'Berlin',
    'MD',
    'USA',
    38.321835,
    -75.215042,
    'public',
    true,
    null,
    4,
    'asphalt',
    'outdoor',
    '{}',
    'uncertain',
    'PlayTime Scheduler lists 4 outdoor asphalt courts with lights and nets. Use local scheduling groups to confirm active sessions.',
    'https://playtimescheduler.com/region/ocean_city-md',
    'https://playtimescheduler.com/region/ocean_city-md',
    null,
    '2026-07-15',
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
  open_play_fee = excluded.open_play_fee,
  court_count = excluded.court_count,
  surface = excluded.surface,
  indoor_outdoor = excluded.indoor_outdoor,
  skill_levels = excluded.skill_levels,
  reliability = excluded.reliability,
  notes = excluded.notes,
  source_url = excluded.source_url,
  website_url = excluded.website_url,
  phone_number = excluded.phone_number,
  last_verified = excluded.last_verified,
  status = excluded.status,
  approved_at = excluded.approved_at,
  updated_at = now();

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Tuesday', 'Thursday'], '16:00'::time, '19:00'::time, 'Mid-June through late August open play. Registration is limited; OC residents can register 7 days ahead, non-residents 6 days ahead.'
from public.locations where slug = 'ocean-city-northside-park-recreation-complex';

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Monday', 'Wednesday'], '13:00'::time, '16:00'::time, 'Late August through mid-June schedule.'
from public.locations where slug = 'ocean-city-northside-park-recreation-complex';

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Tuesday', 'Thursday'], '09:00'::time, '12:00'::time, 'Late August through mid-June schedule.'
from public.locations where slug = 'ocean-city-northside-park-recreation-complex';

insert into public.open_play_slots (location_id, days, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 'Use Pickleball Den to sign up for drop-in times and events. Pro shop is generally open daily 8:00 AM-4:00 PM, subject to staffing.'
from public.locations where slug = 'ocean-pines-racquet-center';

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], '10:30'::time, '13:30'::time, 'Freeman Fitness Center indoor pickleball court schedule; reservations required.'
from public.locations where slug = 'sea-colony-pickleball';

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], '08:00'::time, '10:00'::time, 'Seasonal adult intermediate open play, starting May 22 per Sea Colony programming.'
from public.locations where slug = 'sea-colony-pickleball';

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], '10:00'::time, '12:00'::time, 'Seasonal adult all-levels open play, starting May 22 per Sea Colony programming.'
from public.locations where slug = 'sea-colony-pickleball';

insert into public.open_play_slots (location_id, days, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 'First-come, first-served from early October through mid-May. Mid-May through early October requires reservations and fees.'
from public.locations where slug = 'ocean-city-racquet-center';

insert into public.open_play_slots (location_id, days, start_time, end_time, notes)
select id, array['Wednesday'], '17:00'::time, '19:30'::time, 'Ocean City Pickleball Club practice/open-play mix in September at the outside Racquet Center.'
from public.locations where slug = 'ocean-city-racquet-center';

insert into public.open_play_slots (location_id, days, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 'Public first-come courts. No hosted open-play schedule found; use PlayTime Scheduler or local groups to find sessions.'
from public.locations where slug = 'bayside-park-third-street-ocean-city';

insert into public.open_play_slots (location_id, days, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 'Public first-come courts. No official hosted open-play schedule found; local reports mention morning play, especially Saturdays.'
from public.locations where slug = 'gorman-park-ocean-city';

insert into public.open_play_slots (location_id, days, notes)
select id, array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 'Public first-come courts listed by PlayTime Scheduler. No official hosted open-play schedule found.'
from public.locations where slug = 'stephen-decatur-park-berlin';
