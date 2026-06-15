insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'open-play-photos',
  'open-play-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anyone can read open play photo objects" on storage.objects;
create policy "anyone can read open play photo objects"
on storage.objects for select
using (bucket_id = 'open-play-photos');

drop policy if exists "users can upload own open play photo objects" on storage.objects;
create policy "users can upload own open play photo objects"
on storage.objects for insert
with check (
  bucket_id = 'open-play-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "admins can manage open play photo objects" on storage.objects;
create policy "admins can manage open play photo objects"
on storage.objects for all
using (bucket_id = 'open-play-photos' and public.is_admin())
with check (bucket_id = 'open-play-photos' and public.is_admin());

drop policy if exists "signed-in users can submit photos" on public.photos;
create policy "signed-in users can submit pending photos"
on public.photos for insert
with check (
  auth.uid() is not null
  and uploaded_by = auth.uid()
  and status = 'pending'
);

drop policy if exists "anyone can read approved photos" on public.photos;
create policy "anyone can read approved photos"
on public.photos for select
using (
  status = 'approved'
  and exists (
    select 1
    from public.locations
    where locations.id = photos.location_id
      and locations.status = 'approved'
  )
);

drop policy if exists "users can read own photos" on public.photos;
create policy "users can read own photos"
on public.photos for select
using (uploaded_by = auth.uid() or public.is_admin());

create index if not exists photos_location_status_idx
on public.photos (location_id, status);

create index if not exists photos_review_status_idx
on public.photos (review_id, status);
