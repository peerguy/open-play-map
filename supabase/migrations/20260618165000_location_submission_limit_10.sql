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

  if recent_count > 10 then
    raise exception 'Daily location submission limit reached. Please try again tomorrow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
