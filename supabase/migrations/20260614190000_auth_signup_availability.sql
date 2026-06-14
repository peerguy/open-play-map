create or replace function public.profile_signup_availability(
  check_email text,
  check_username text
)
returns table (
  email_available boolean,
  username_available boolean
)
language sql
security definer
set search_path = public
as $$
  with normalized as (
    select
      lower(nullif(trim(check_email), '')) as email_value,
      lower(coalesce(
        nullif(left(trim(regexp_replace(coalesce(check_username, ''), '[^a-zA-Z0-9 _-]', '', 'g')), 28), ''),
        'player'
      )) as username_value
  )
  select
    not exists (
      select 1
      from public.profiles, normalized
      where lower(public.profiles.email) = normalized.email_value
    ) as email_available,
    not exists (
      select 1
      from public.profiles, normalized
      where lower(public.profiles.username) = normalized.username_value
    ) as username_available;
$$;

revoke all on function public.profile_signup_availability(text, text) from public;
grant execute on function public.profile_signup_availability(text, text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
  base_username text;
  final_username text;
begin
  requested_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
  base_username := regexp_replace(
    coalesce(requested_username, split_part(new.email, '@', 1), 'player'),
    '[^a-zA-Z0-9 _-]',
    '',
    'g'
  );
  base_username := nullif(trim(base_username), '');
  if base_username is null then
    base_username := 'player';
  end if;

  final_username := left(base_username, 28);

  if exists (
    select 1
    from public.profiles
    where lower(username) = lower(final_username)
  ) then
    raise exception 'Username is already taken.'
      using errcode = 'unique_violation';
  end if;

  if new.email is not null and exists (
    select 1
    from public.profiles
    where lower(email) = lower(new.email)
  ) then
    raise exception 'Email is already registered.'
      using errcode = 'unique_violation';
  end if;

  insert into public.profiles (
    id,
    email,
    username,
    skill_level,
    bio
  ) values (
    new.id,
    new.email,
    final_username,
    case
      when new.raw_user_meta_data->>'skill_level' in ('beginner', 'intermediate', 'advanced')
        then new.raw_user_meta_data->>'skill_level'
      else null
    end,
    left(coalesce(new.raw_user_meta_data->>'bio', ''), 140)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

update auth.users
set
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where email is not null
  and email_confirmed_at is null;
