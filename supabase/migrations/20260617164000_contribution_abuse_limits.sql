-- Add server-side contribution abuse limits for production write paths.

create index if not exists locations_submitted_by_created_at_idx
on public.locations (submitted_by, created_at desc);

create index if not exists reviews_user_id_created_at_idx
on public.reviews (user_id, created_at desc);

create index if not exists reports_reporter_id_created_at_idx
on public.reports (reporter_id, created_at desc);

create index if not exists suggested_edits_submitted_by_created_at_idx
on public.suggested_edits (submitted_by, created_at desc);

create index if not exists photos_uploaded_by_created_at_idx
on public.photos (uploaded_by, created_at desc);

create or replace function public.current_open_play_photo_object_upload_count()
returns integer
language sql
stable
security definer
set search_path = public, storage
as $$
  select count(*)::integer
  from storage.objects
  where bucket_id = 'open-play-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
    and created_at >= now() - interval '24 hours';
$$;

drop policy if exists "users can upload own open play photo objects" on storage.objects;
create policy "users can upload own open play photo objects"
on storage.objects for insert
with check (
  bucket_id = 'open-play-photos'
  and auth.uid()::text = (storage.foldername(name))[1]
  and (storage.foldername(name))[2] in ('locations', 'reviews')
  and coalesce((storage.foldername(name))[3], '') <> ''
  and public.current_open_play_photo_object_upload_count() < 20
);

create or replace function public.enforce_location_submission_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if public.is_admin() or new.submitted_by is null then
    return new;
  end if;

  select count(*)::integer
  into recent_count
  from public.locations
  where submitted_by = new.submitted_by
    and created_at >= now() - interval '24 hours';

  if recent_count > 3 then
    raise exception 'Daily location submission limit reached. Please try again tomorrow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_location_submission_limit_trigger on public.locations;
create trigger enforce_location_submission_limit_trigger
after insert on public.locations
for each row
execute function public.enforce_location_submission_limit();

create or replace function public.enforce_review_submission_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if public.is_admin() or new.user_id is null then
    return new;
  end if;

  select count(*)::integer
  into recent_count
  from public.reviews
  where user_id = new.user_id
    and created_at >= now() - interval '24 hours';

  if recent_count > 10 then
    raise exception 'Daily review limit reached. Please try again tomorrow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_review_submission_limit_trigger on public.reviews;
create trigger enforce_review_submission_limit_trigger
after insert on public.reviews
for each row
execute function public.enforce_review_submission_limit();

create or replace function public.enforce_report_submission_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if public.is_admin() or new.reporter_id is null then
    return new;
  end if;

  select count(*)::integer
  into recent_count
  from public.reports
  where reporter_id = new.reporter_id
    and created_at >= now() - interval '24 hours';

  if recent_count > 10 then
    raise exception 'Daily report limit reached. Please try again tomorrow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_report_submission_limit_trigger on public.reports;
create trigger enforce_report_submission_limit_trigger
after insert on public.reports
for each row
execute function public.enforce_report_submission_limit();

create or replace function public.enforce_suggested_edit_submission_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if public.is_admin() or new.submitted_by is null then
    return new;
  end if;

  select count(*)::integer
  into recent_count
  from public.suggested_edits
  where submitted_by = new.submitted_by
    and created_at >= now() - interval '24 hours';

  if recent_count > 10 then
    raise exception 'Daily suggested edit limit reached. Please try again tomorrow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_suggested_edit_submission_limit_trigger on public.suggested_edits;
create trigger enforce_suggested_edit_submission_limit_trigger
after insert on public.suggested_edits
for each row
execute function public.enforce_suggested_edit_submission_limit();

create or replace function public.enforce_photo_submission_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if public.is_admin() or new.uploaded_by is null then
    return new;
  end if;

  select count(*)::integer
  into recent_count
  from public.photos
  where uploaded_by = new.uploaded_by
    and created_at >= now() - interval '24 hours';

  if recent_count > 20 then
    raise exception 'Daily photo upload limit reached. Please try again tomorrow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_photo_submission_limit_trigger on public.photos;
create trigger enforce_photo_submission_limit_trigger
after insert on public.photos
for each row
execute function public.enforce_photo_submission_limit();
