-- Prevent anonymous bucket browsing from exposing pending/rejected photo paths.

drop policy if exists "anyone can read open play photo objects" on storage.objects;
drop policy if exists "anyone can read approved open play photo objects" on storage.objects;

create policy "anyone can read approved open play photo objects"
on storage.objects for select
using (
  bucket_id = 'open-play-photos'
  and (
    public.is_admin()
    or auth.uid()::text = (storage.foldername(name))[1]
    or exists (
      select 1
      from public.photos
      join public.locations on locations.id = photos.location_id
      where photos.storage_path = storage.objects.name
        and photos.status = 'approved'
        and locations.status = 'approved'
    )
  )
);
