create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text not null unique,
  role text not null default 'player' check (role in ('player', 'admin')),
  skill_level text check (skill_level in ('beginner', 'intermediate', 'advanced')),
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text,
  city text,
  state text,
  country text not null default 'USA',
  latitude double precision not null,
  longitude double precision not null,
  access text not null default 'unknown' check (access in ('public', 'private', 'paid', 'club', 'unknown')),
  is_free boolean,
  court_count integer,
  surface text,
  indoor_outdoor text not null default 'unknown' check (indoor_outdoor in ('outdoor', 'indoor', 'both', 'unknown')),
  skill_levels text[] not null default '{}',
  reliability text default 'uncertain' check (reliability in ('confirmed', 'sometimes', 'uncertain')),
  notes text,
  source_url text,
  last_verified date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'archived')),
  submitted_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.open_play_slots (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  days text[] not null default '{}',
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  visited_on date,
  skill_levels text[] not null default '{}',
  crowd text,
  best_time text,
  reliability text check (reliability in ('confirmed', 'sometimes', 'uncertain')),
  net_setup text,
  play_format text,
  beginner_friendly text,
  fees text,
  amenities text,
  lighting text,
  scheduling_app text,
  status text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, user_id)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  storage_path text not null,
  caption text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'removed')),
  created_at timestamptz not null default now(),
  constraint photos_location_or_review check (location_id is not null or review_id is not null)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('location', 'review', 'photo')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'dismissed', 'resolved')),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.suggested_edits (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  note text not null,
  suggested_location jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('add-location', 'add-review', 'add-photo', 'suggested-edit', 'manual-adjustment', 'monthly-reset')),
  target_type text,
  target_id uuid,
  active_delta integer not null default 0,
  lifetime_delta integer not null default 0,
  status text not null default 'approved' check (status in ('pending', 'approved', 'rejected', 'void')),
  awarded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.monthly_drawings (
  id uuid primary key default gen_random_uuid(),
  drawing_month date not null unique,
  winner_user_id uuid references public.profiles(id) on delete set null,
  prize text not null default 'Free Scoop Pickleball paddle',
  active_credits_at_draw integer,
  drawn_by uuid references public.profiles(id) on delete set null,
  drawn_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.open_play_slots enable row level security;
alter table public.reviews enable row level security;
alter table public.photos enable row level security;
alter table public.reports enable row level security;
alter table public.suggested_edits enable row level security;
alter table public.credits enable row level security;
alter table public.monthly_drawings enable row level security;
alter table public.audit_events enable row level security;

create policy "users can read own profile"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "users can insert own profile"
on public.profiles for insert
with check (id = auth.uid());

create policy "users can update own player profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and role = 'player');

create policy "admins can manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy "anyone can read approved locations"
on public.locations for select
using (status = 'approved' or public.is_admin());

create policy "signed-in users can submit pending locations"
on public.locations for insert
with check (auth.uid() is not null and submitted_by = auth.uid() and status = 'pending');

create policy "admins can manage locations"
on public.locations for all
using (public.is_admin())
with check (public.is_admin());

create policy "anyone can read approved location slots"
on public.open_play_slots for select
using (
  exists (
    select 1
    from public.locations
    where locations.id = open_play_slots.location_id
      and (locations.status = 'approved' or public.is_admin())
  )
);

create policy "admins can manage open play slots"
on public.open_play_slots for all
using (public.is_admin())
with check (public.is_admin());

create policy "anyone can read published reviews for approved locations"
on public.reviews for select
using (
  status = 'published'
  and exists (
    select 1 from public.locations
    where locations.id = reviews.location_id
      and locations.status = 'approved'
  )
  or public.is_admin()
);

create policy "signed-in users can submit own reviews"
on public.reviews for insert
with check (auth.uid() is not null and user_id = auth.uid());

create policy "users can update own reviews"
on public.reviews for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "anyone can read approved photos"
on public.photos for select
using (status = 'approved' or public.is_admin());

create policy "signed-in users can submit photos"
on public.photos for insert
with check (auth.uid() is not null and uploaded_by = auth.uid());

create policy "admins can manage photos"
on public.photos for all
using (public.is_admin())
with check (public.is_admin());

create policy "signed-in users can create reports"
on public.reports for insert
with check (auth.uid() is not null and reporter_id = auth.uid());

create policy "admins can manage reports"
on public.reports for all
using (public.is_admin())
with check (public.is_admin());

create policy "users can submit suggested edits"
on public.suggested_edits for insert
with check (auth.uid() is not null and submitted_by = auth.uid() and status = 'pending');

create policy "users can read own suggested edits"
on public.suggested_edits for select
using (submitted_by = auth.uid() or public.is_admin());

create policy "admins can manage suggested edits"
on public.suggested_edits for all
using (public.is_admin())
with check (public.is_admin());

create policy "users can read own credits"
on public.credits for select
using (user_id = auth.uid() or public.is_admin());

create policy "admins can manage credits"
on public.credits for all
using (public.is_admin())
with check (public.is_admin());

create policy "anyone can read monthly drawings"
on public.monthly_drawings for select
using (true);

create policy "admins can manage monthly drawings"
on public.monthly_drawings for all
using (public.is_admin())
with check (public.is_admin());

create policy "admins can read audit events"
on public.audit_events for select
using (public.is_admin());

create policy "admins can write audit events"
on public.audit_events for insert
with check (public.is_admin());
