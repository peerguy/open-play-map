alter table public.locations
  add column if not exists website_url text,
  add column if not exists phone_number text;

comment on column public.locations.website_url is 'Public website, registration, or facility info link for players.';
comment on column public.locations.phone_number is 'Public phone number for players to confirm schedules, fees, or reservations.';
