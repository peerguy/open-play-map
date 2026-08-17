create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null unique references public.locations(id) on delete cascade,
  photo_id uuid references public.photos(id) on delete set null,
  instagram_container_id text,
  instagram_media_id text,
  status text not null default 'pending' check (status in ('pending', 'published', 'failed', 'skipped')),
  caption text,
  image_url text,
  error_message text,
  requested_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.instagram_posts enable row level security;

drop policy if exists "admins can read instagram posts" on public.instagram_posts;
create policy "admins can read instagram posts"
on public.instagram_posts for select
using (public.is_admin());

drop policy if exists "admins can manage instagram posts" on public.instagram_posts;
create policy "admins can manage instagram posts"
on public.instagram_posts for all
using (public.is_admin())
with check (public.is_admin());

create index if not exists instagram_posts_status_idx
on public.instagram_posts (status);

