create unique index if not exists profiles_username_lower_unique
on public.profiles (lower(username));

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
  suffix integer := 0;
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
  while exists (
    select 1
    from public.profiles
    where lower(username) = lower(final_username)
  ) loop
    suffix := suffix + 1;
    final_username := left(base_username, greatest(1, 27 - length(suffix::text))) || '-' || suffix::text;
  end loop;

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

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
