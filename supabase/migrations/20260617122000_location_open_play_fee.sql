alter table public.locations
  add column if not exists open_play_fee numeric(8,2);

alter table public.locations
  drop constraint if exists locations_open_play_fee_nonnegative;

alter table public.locations
  drop constraint if exists locations_open_play_fee_positive;

alter table public.locations
  add constraint locations_open_play_fee_positive
  check (open_play_fee is null or open_play_fee > 0);

comment on column public.locations.open_play_fee is
  'Drop-in open play fee in USD for public paid open play locations.';
