-- Launch hardening for public RLS/storage surfaces.

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own player profile"
on public.profiles for insert
with check (
  id = auth.uid()
  and role = 'player'
);

drop policy if exists "users can update own reviews" on public.reviews;
create policy "users can update own published reviews"
on public.reviews for update
using (
  public.is_admin()
  or (
    user_id = auth.uid()
    and status = 'published'
    and exists (
      select 1
      from public.locations
      where locations.id = reviews.location_id
        and locations.status = 'approved'
    )
  )
)
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and status = 'published'
    and exists (
      select 1
      from public.locations
      where locations.id = reviews.location_id
        and locations.status = 'approved'
    )
  )
);

drop policy if exists "signed-in users can submit pending photos" on public.photos;
create policy "signed-in users can submit pending photos"
on public.photos for insert
with check (
  auth.uid() is not null
  and uploaded_by = auth.uid()
  and status = 'pending'
  and (
    (
      review_id is null
      and location_id is not null
      and exists (
        select 1
        from public.locations
        where locations.id = photos.location_id
          and (
            locations.status = 'approved'
            or locations.submitted_by = auth.uid()
          )
      )
    )
    or (
      review_id is not null
      and location_id is not null
      and exists (
        select 1
        from public.reviews
        join public.locations on locations.id = reviews.location_id
        where reviews.id = photos.review_id
          and reviews.location_id = photos.location_id
          and reviews.user_id = auth.uid()
          and reviews.status = 'published'
          and locations.status = 'approved'
      )
    )
  )
);

drop policy if exists "users can upload own open play photo objects" on storage.objects;
create policy "users can upload own open play photo objects"
on storage.objects for insert
with check (
  bucket_id = 'open-play-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (storage.foldername(name))[2] in ('locations', 'reviews')
  and coalesce((storage.foldername(name))[3], '') <> ''
);

drop policy if exists "anyone can read monthly drawings" on public.monthly_drawings;
drop policy if exists "anyone can read claimed monthly drawings" on public.monthly_drawings;
create policy "anyone can read claimed monthly drawings"
on public.monthly_drawings for select
using (
  public.is_admin()
  or (
    status = 'claimed'
    and drawn_at is not null
  )
);

revoke all on function public.award_contribution_credit(uuid, text, text, uuid, text, uuid) from public;
revoke all on function public.award_contribution_credit(uuid, text, text, uuid, text, uuid) from anon;
revoke all on function public.award_contribution_credit(uuid, text, text, uuid, text, uuid) from authenticated;
