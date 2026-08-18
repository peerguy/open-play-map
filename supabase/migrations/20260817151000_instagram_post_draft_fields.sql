alter table public.instagram_posts
  add column if not exists image_urls jsonb not null default '[]'::jsonb,
  add column if not exists location_tag text,
  add column if not exists instagram_location_id text;

