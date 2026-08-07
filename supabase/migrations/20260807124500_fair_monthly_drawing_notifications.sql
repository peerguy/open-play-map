alter table public.monthly_drawings
add column if not exists snapshot_cutoff_at timestamptz,
add column if not exists eligible_user_count integer,
add column if not exists entry_snapshot_hash text,
add column if not exists audit_receipt_hash text;

create table if not exists public.drawing_audit_receipts (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null unique references public.monthly_drawings(id) on delete restrict,
  reward_period_id uuid not null references public.reward_periods(id) on delete restrict,
  drawing_month date not null,
  receipt_hash text not null,
  receipt jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.drawing_audit_receipts enable row level security;

drop policy if exists "admins can read drawing audit receipts" on public.drawing_audit_receipts;
create policy "admins can read drawing audit receipts"
on public.drawing_audit_receipts for select
using (public.is_admin());

revoke all on table public.drawing_audit_receipts from public;
revoke all on table public.drawing_audit_receipts from anon;
revoke all on table public.drawing_audit_receipts from authenticated;
grant select on table public.drawing_audit_receipts to authenticated;

create or replace function public.prevent_drawing_audit_receipt_changes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Drawing audit receipts are immutable';
end;
$$;

drop trigger if exists drawing_audit_receipts_immutable on public.drawing_audit_receipts;
create trigger drawing_audit_receipts_immutable
before update or delete on public.drawing_audit_receipts
for each row execute function public.prevent_drawing_audit_receipt_changes();

create or replace function public.drawing_excluded_profile_usernames()
returns text[]
language sql
immutable
as $$
  select array['scoop', 'osprey', 'tinascoop']::text[];
$$;

create or replace function public.random_drawing_entry(total_entries integer)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  random_bytes bytea;
  random_value bigint;
  random_space bigint := 4294967296;
  accepted_space bigint;
begin
  if total_entries is null or total_entries <= 0 then
    raise exception 'Total entries must be greater than zero';
  end if;

  accepted_space := random_space - (random_space % total_entries);

  loop
    random_bytes := gen_random_bytes(4);
    random_value :=
      get_byte(random_bytes, 0)::bigint * 16777216
      + get_byte(random_bytes, 1)::bigint * 65536
      + get_byte(random_bytes, 2)::bigint * 256
      + get_byte(random_bytes, 3)::bigint;

    if random_value < accepted_space then
      return (random_value % total_entries)::integer + 1;
    end if;
  end loop;
end;
$$;

create or replace function public.drawing_leaderboard_as_of(p_cutoff_at timestamptz)
returns table (
  user_id uuid,
  username text,
  active_credits integer,
  lifetime_credits integer
)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select
      valid_credits.user_id,
      coalesce(sum(valid_credits.active_delta), 0)::integer as active_credits,
      coalesce(sum(valid_credits.lifetime_delta), 0)::integer as lifetime_credits
    from public.valid_contribution_credits() valid_credits
    where valid_credits.status = 'approved'
      and valid_credits.created_at <= p_cutoff_at
    group by valid_credits.user_id
  )
  select
    profiles.id as user_id,
    profiles.username,
    totals.active_credits,
    totals.lifetime_credits
  from public.profiles
  join totals on totals.user_id = profiles.id
  where totals.active_credits > 0
    and coalesce(profiles.role, 'player') <> 'admin'
    and lower(trim(profiles.username)) <> all (public.drawing_excluded_profile_usernames())
  order by profiles.username asc, profiles.id asc;
$$;

create or replace function public.ensure_reward_period(p_drawing_month date default null)
returns public.reward_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  target_month date;
  start_month date;
  period_row public.reward_periods;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  target_month := date_trunc('month', coalesce(p_drawing_month, (now() at time zone 'America/New_York')::date))::date;
  if target_month < date '2026-08-01' then
    target_month := date '2026-08-01';
  end if;

  start_month := (target_month - interval '1 month')::date;

  insert into public.reward_periods (
    drawing_month,
    starts_at,
    ends_at,
    drawing_at,
    status,
    rules_version,
    official_rules_url
  ) values (
    target_month,
    make_timestamptz(extract(year from start_month)::integer, extract(month from start_month)::integer, 1, 0, 0, 0, 'America/New_York'),
    make_timestamptz(extract(year from target_month)::integer, extract(month from target_month)::integer, 1, 17, 0, 0, 'America/New_York'),
    make_timestamptz(extract(year from target_month)::integer, extract(month from target_month)::integer, 1, 17, 0, 0, 'America/New_York'),
    'scheduled',
    '2026-08-07',
    'official-rules.html'
  )
  on conflict (drawing_month) do update
  set
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    drawing_at = excluded.drawing_at,
    rules_version = excluded.rules_version,
    official_rules_url = excluded.official_rules_url,
    updated_at = now()
  where public.reward_periods.status = 'scheduled';

  select *
  into period_row
  from public.reward_periods
  where drawing_month = target_month;

  return period_row;
end;
$$;

update public.reward_periods
set
  rules_version = '2026-08-07',
  official_rules_url = 'official-rules.html',
  updated_at = now()
where status = 'scheduled';

drop function if exists public.admin_reward_periods();
create function public.admin_reward_periods()
returns table (
  id uuid,
  drawing_id uuid,
  drawing_month date,
  starts_at timestamptz,
  ends_at timestamptz,
  drawing_at timestamptz,
  period_status text,
  drawing_status text,
  rules_version text,
  official_rules_url text,
  estimated_entries integer,
  total_entries integer,
  eligible_user_count integer,
  snapshot_cutoff_at timestamptz,
  entry_snapshot_hash text,
  audit_receipt_hash text,
  audit_receipt jsonb,
  winner_user_id uuid,
  winner_username text,
  winner_email text,
  prize text,
  active_credits_at_draw integer,
  drawn_at timestamptz,
  winner_notified_at timestamptz,
  winner_claim_deadline timestamptz,
  can_run boolean,
  can_notify boolean,
  can_claim boolean,
  can_redraw boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  perform public.ensure_reward_period(null);

  return query
  select
    reward_periods.id,
    monthly_drawings.id as drawing_id,
    reward_periods.drawing_month,
    reward_periods.starts_at,
    reward_periods.ends_at,
    reward_periods.drawing_at,
    reward_periods.status as period_status,
    monthly_drawings.status as drawing_status,
    reward_periods.rules_version,
    reward_periods.official_rules_url,
    coalesce((select sum(drawing_leaderboard.active_credits)::integer from public.drawing_leaderboard_as_of(reward_periods.ends_at) drawing_leaderboard), 0) as estimated_entries,
    monthly_drawings.total_entries,
    monthly_drawings.eligible_user_count,
    monthly_drawings.snapshot_cutoff_at,
    monthly_drawings.entry_snapshot_hash,
    coalesce(drawing_audit_receipts.receipt_hash, monthly_drawings.audit_receipt_hash) as audit_receipt_hash,
    drawing_audit_receipts.receipt as audit_receipt,
    monthly_drawings.winner_user_id,
    profiles.username as winner_username,
    profiles.email as winner_email,
    monthly_drawings.prize,
    monthly_drawings.active_credits_at_draw,
    monthly_drawings.drawn_at,
    monthly_drawings.winner_notified_at,
    monthly_drawings.winner_claim_deadline,
    (now() >= reward_periods.drawing_at and reward_periods.status = 'scheduled') as can_run,
    (monthly_drawings.status = 'drawn' and monthly_drawings.winner_notified_at is null and coalesce(profiles.email, '') <> '') as can_notify,
    (monthly_drawings.status = 'drawn') as can_claim,
    (monthly_drawings.status = 'drawn' and monthly_drawings.winner_claim_deadline is not null and now() >= monthly_drawings.winner_claim_deadline) as can_redraw
  from public.reward_periods
  left join lateral (
    select *
    from public.monthly_drawings
    where monthly_drawings.reward_period_id = reward_periods.id
      and monthly_drawings.status in ('drawn', 'claimed')
    order by monthly_drawings.drawn_at desc, monthly_drawings.created_at desc
    limit 1
  ) monthly_drawings on true
  left join public.profiles on profiles.id = monthly_drawings.winner_user_id
  left join public.drawing_audit_receipts on drawing_audit_receipts.drawing_id = monthly_drawings.id
  order by reward_periods.drawing_month desc
  limit 12;
end;
$$;

create or replace function public.run_monthly_drawing(p_drawing_month date default null)
returns public.monthly_drawings
language plpgsql
security definer
set search_path = public
as $$
declare
  period_row public.reward_periods;
  drawing_row public.monthly_drawings;
  total_entry_count integer;
  eligible_user_count integer;
  winning_number integer;
  winner_id uuid;
  winner_username text;
  winner_active_credits integer;
  snapshot_cutoff timestamptz;
  entry_snapshot jsonb;
  entry_snapshot_hash text;
  audit_receipt jsonb;
  audit_receipt_hash_value text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into period_row
  from public.ensure_reward_period(p_drawing_month);

  select *
  into period_row
  from public.reward_periods
  where id = period_row.id
  for update;

  if period_row.status = 'drawn' then
    select *
    into drawing_row
    from public.monthly_drawings
    where reward_period_id = period_row.id
      and status in ('drawn', 'claimed')
    order by drawn_at desc, created_at desc
    limit 1;
    return drawing_row;
  end if;

  if period_row.status = 'cancelled' then
    raise exception 'Drawing period is cancelled';
  end if;

  if now() < period_row.drawing_at then
    raise exception 'Drawing is scheduled for %', period_row.drawing_at;
  end if;

  snapshot_cutoff := period_row.ends_at;

  delete from public.drawing_entries
  where period_id = period_row.id;

  insert into public.drawing_entries (
    period_id,
    user_id,
    entry_count,
    active_credits_at_snapshot,
    lifetime_credits_at_snapshot,
    snapshot
  )
  select
    period_row.id,
    leaderboard.user_id,
    leaderboard.active_credits,
    leaderboard.active_credits,
    leaderboard.lifetime_credits,
    jsonb_build_object(
      'username', leaderboard.username,
      'active_credits', leaderboard.active_credits,
      'lifetime_credits', leaderboard.lifetime_credits,
      'snapshot_cutoff_at', snapshot_cutoff,
      'snapshot_created_at', now()
    )
  from public.drawing_leaderboard_as_of(snapshot_cutoff) leaderboard
  where leaderboard.active_credits > 0;

  select
    coalesce(sum(drawing_entries.entry_count), 0)::integer,
    count(*)::integer,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id', drawing_entries.user_id,
        'username', drawing_entries.snapshot ->> 'username',
        'entry_count', drawing_entries.entry_count,
        'active_credits', drawing_entries.active_credits_at_snapshot,
        'lifetime_credits', drawing_entries.lifetime_credits_at_snapshot
      )
      order by drawing_entries.user_id
    ), '[]'::jsonb)
  into total_entry_count, eligible_user_count, entry_snapshot
  from public.drawing_entries
  where period_id = period_row.id;

  if total_entry_count <= 0 then
    raise exception 'No eligible drawing entries';
  end if;

  entry_snapshot_hash := encode(digest(entry_snapshot::text, 'sha256'), 'hex');
  winning_number := public.random_drawing_entry(total_entry_count);

  with weighted_entries as (
    select
      drawing_entries.user_id,
      drawing_entries.active_credits_at_snapshot,
      sum(drawing_entries.entry_count) over (order by drawing_entries.user_id) as cumulative_entries
    from public.drawing_entries
    where drawing_entries.period_id = period_row.id
  )
  select
    weighted_entries.user_id,
    weighted_entries.active_credits_at_snapshot
  into
    winner_id,
    winner_active_credits
  from weighted_entries
  where weighted_entries.cumulative_entries >= winning_number
  order by weighted_entries.cumulative_entries
  limit 1;

  select profiles.username
  into winner_username
  from public.profiles
  where profiles.id = winner_id;

  insert into public.monthly_drawings (
    drawing_month,
    reward_period_id,
    winner_user_id,
    prize,
    active_credits_at_draw,
    drawn_by,
    drawn_at,
    total_entries,
    winning_entry_number,
    rules_version,
    official_rules_url,
    status,
    winner_notified_at,
    winner_claim_deadline,
    snapshot_cutoff_at,
    eligible_user_count,
    entry_snapshot_hash
  ) values (
    period_row.drawing_month,
    period_row.id,
    winner_id,
    'Any paddle on scooppickleball.com with standard shipping included, or up to $100 worth of gear from scooppickleball.com with standard shipping included',
    winner_active_credits,
    auth.uid(),
    now(),
    total_entry_count,
    winning_number,
    period_row.rules_version,
    period_row.official_rules_url,
    'drawn',
    null,
    null,
    snapshot_cutoff,
    eligible_user_count,
    entry_snapshot_hash
  )
  returning * into drawing_row;

  audit_receipt := jsonb_build_object(
    'schema', 'open-play-map-drawing-receipt-v1',
    'drawing_id', drawing_row.id,
    'drawing_month', drawing_row.drawing_month,
    'reward_period_id', period_row.id,
    'rules_version', period_row.rules_version,
    'official_rules_url', period_row.official_rules_url,
    'snapshot_cutoff_at', snapshot_cutoff,
    'drawn_at', drawing_row.drawn_at,
    'drawn_by', drawing_row.drawn_by,
    'eligible_user_count', eligible_user_count,
    'total_entries', total_entry_count,
    'entry_snapshot_hash', entry_snapshot_hash,
    'winning_entry_number', winning_number,
    'winner', jsonb_build_object(
      'user_id', winner_id,
      'username', winner_username,
      'active_credits_at_draw', winner_active_credits
    ),
    'random', jsonb_build_object(
      'source', 'pgcrypto.gen_random_bytes(4)',
      'method', 'rejection sampling'
    ),
    'eligibility', jsonb_build_object(
      'excluded_roles', jsonb_build_array('admin'),
      'excluded_usernames', to_jsonb(public.drawing_excluded_profile_usernames())
    ),
    'entries', entry_snapshot
  );
  audit_receipt_hash_value := encode(digest(audit_receipt::text, 'sha256'), 'hex');

  insert into public.drawing_audit_receipts (
    drawing_id,
    reward_period_id,
    drawing_month,
    receipt_hash,
    receipt
  ) values (
    drawing_row.id,
    period_row.id,
    period_row.drawing_month,
    audit_receipt_hash_value,
    audit_receipt || jsonb_build_object('receipt_hash', audit_receipt_hash_value)
  );

  update public.monthly_drawings
  set audit_receipt_hash = audit_receipt_hash_value
  where id = drawing_row.id
  returning * into drawing_row;

  update public.reward_periods
  set status = 'drawn', updated_at = now()
  where id = period_row.id;

  return drawing_row;
end;
$$;

create or replace function public.mark_monthly_drawing_notified(p_drawing_id uuid)
returns public.monthly_drawings
language plpgsql
security definer
set search_path = public
as $$
declare
  drawing_row public.monthly_drawings;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into drawing_row
  from public.monthly_drawings
  where id = p_drawing_id
  for update;

  if not found then
    raise exception 'Drawing not found';
  end if;

  if drawing_row.status <> 'drawn' then
    raise exception 'Only a current drawn winner can be marked notified';
  end if;

  if drawing_row.winner_notified_at is null then
    update public.monthly_drawings
    set
      winner_notified_at = now(),
      winner_claim_deadline = now() + interval '14 days'
    where id = drawing_row.id
    returning * into drawing_row;
  end if;

  return drawing_row;
end;
$$;

create or replace function public.claim_monthly_drawing(p_drawing_id uuid)
returns public.monthly_drawings
language plpgsql
security definer
set search_path = public
as $$
declare
  drawing_row public.monthly_drawings;
  current_active_credits integer;
  post_draw_active_credits integer;
  target_active_credits integer;
  reset_delta integer;
  reset_cutoff timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into drawing_row
  from public.monthly_drawings
  where id = p_drawing_id
  for update;

  if not found then
    raise exception 'Drawing not found';
  end if;

  if drawing_row.status = 'claimed' then
    return drawing_row;
  end if;

  if drawing_row.status <> 'drawn' then
    raise exception 'Only the current drawn winner can be marked claimed';
  end if;

  reset_cutoff := coalesce(drawing_row.snapshot_cutoff_at, drawing_row.drawn_at);

  select coalesce(public_leaderboard.active_credits, 0)::integer
  into current_active_credits
  from public.public_leaderboard()
  where public_leaderboard.user_id = drawing_row.winner_user_id;

  current_active_credits := coalesce(current_active_credits, 0);

  select coalesce(sum(valid_credits.active_delta), 0)::integer
  into post_draw_active_credits
  from public.valid_contribution_credits() valid_credits
  where valid_credits.user_id = drawing_row.winner_user_id
    and valid_credits.status = 'approved'
    and valid_credits.action <> 'monthly-reset'
    and valid_credits.created_at > reset_cutoff;

  target_active_credits := greatest(1, 1 + coalesce(post_draw_active_credits, 0));
  reset_delta := least(0, target_active_credits - current_active_credits);

  if reset_delta < 0 then
    insert into public.credits (
      user_id,
      action,
      target_type,
      target_id,
      active_delta,
      lifetime_delta,
      status,
      awarded_by
    ) values (
      drawing_row.winner_user_id,
      'monthly-reset',
      'monthly-drawing',
      drawing_row.id,
      reset_delta,
      0,
      'approved',
      auth.uid()
    )
    on conflict (user_id, action, target_type, target_id)
    where target_id is not null
    do nothing;
  end if;

  update public.monthly_drawings
  set status = 'claimed'
  where id = drawing_row.id
  returning * into drawing_row;

  return drawing_row;
end;
$$;

create or replace function public.run_monthly_redraw(p_drawing_id uuid)
returns public.monthly_drawings
language plpgsql
security definer
set search_path = public
as $$
declare
  source_drawing public.monthly_drawings;
  redraw_row public.monthly_drawings;
  total_entry_count integer;
  eligible_user_count integer;
  winning_number integer;
  winner_id uuid;
  winner_username text;
  winner_active_credits integer;
  snapshot_cutoff timestamptz;
  entry_snapshot jsonb;
  entry_snapshot_hash text;
  previous_winner_user_ids jsonb;
  audit_receipt jsonb;
  audit_receipt_hash_value text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into source_drawing
  from public.monthly_drawings
  where id = p_drawing_id
  for update;

  if not found then
    raise exception 'Drawing not found';
  end if;

  if source_drawing.status <> 'drawn' then
    raise exception 'Only the current drawn winner can be redrawn';
  end if;

  if source_drawing.winner_claim_deadline is null or now() < source_drawing.winner_claim_deadline then
    raise exception 'The 14 day claim period has not ended yet';
  end if;

  snapshot_cutoff := coalesce(source_drawing.snapshot_cutoff_at, source_drawing.drawn_at);

  select
    coalesce(sum(drawing_entries.entry_count), 0)::integer,
    count(*)::integer,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id', drawing_entries.user_id,
        'username', drawing_entries.snapshot ->> 'username',
        'entry_count', drawing_entries.entry_count,
        'active_credits', drawing_entries.active_credits_at_snapshot,
        'lifetime_credits', drawing_entries.lifetime_credits_at_snapshot
      )
      order by drawing_entries.user_id
    ), '[]'::jsonb)
  into total_entry_count, eligible_user_count, entry_snapshot
  from public.drawing_entries
  where drawing_entries.period_id = source_drawing.reward_period_id
    and not exists (
      select 1
      from public.monthly_drawings previous_drawings
      where previous_drawings.reward_period_id = source_drawing.reward_period_id
        and previous_drawings.winner_user_id = drawing_entries.user_id
    );

  if total_entry_count <= 0 then
    raise exception 'No alternate eligible drawing entries';
  end if;

  entry_snapshot_hash := encode(digest(entry_snapshot::text, 'sha256'), 'hex');
  winning_number := public.random_drawing_entry(total_entry_count);

  with weighted_entries as (
    select
      drawing_entries.user_id,
      drawing_entries.active_credits_at_snapshot,
      sum(drawing_entries.entry_count) over (order by drawing_entries.user_id) as cumulative_entries
    from public.drawing_entries
    where drawing_entries.period_id = source_drawing.reward_period_id
      and not exists (
        select 1
        from public.monthly_drawings previous_drawings
        where previous_drawings.reward_period_id = source_drawing.reward_period_id
          and previous_drawings.winner_user_id = drawing_entries.user_id
      )
  )
  select
    weighted_entries.user_id,
    weighted_entries.active_credits_at_snapshot
  into
    winner_id,
    winner_active_credits
  from weighted_entries
  where weighted_entries.cumulative_entries >= winning_number
  order by weighted_entries.cumulative_entries
  limit 1;

  select profiles.username
  into winner_username
  from public.profiles
  where profiles.id = winner_id;

  select coalesce(jsonb_agg(previous_drawings.winner_user_id order by previous_drawings.drawn_at, previous_drawings.created_at), '[]'::jsonb)
  into previous_winner_user_ids
  from public.monthly_drawings previous_drawings
  where previous_drawings.reward_period_id = source_drawing.reward_period_id
    and previous_drawings.winner_user_id is not null;

  update public.monthly_drawings
  set
    status = 'redrawn',
    notes = concat_ws(E'\n', nullif(notes, ''), 'Redrawn after the claim deadline passed.')
  where id = source_drawing.id;

  insert into public.monthly_drawings (
    drawing_month,
    reward_period_id,
    winner_user_id,
    prize,
    active_credits_at_draw,
    drawn_by,
    drawn_at,
    total_entries,
    winning_entry_number,
    rules_version,
    official_rules_url,
    status,
    winner_notified_at,
    winner_claim_deadline,
    redraw_of,
    snapshot_cutoff_at,
    eligible_user_count,
    entry_snapshot_hash
  ) values (
    source_drawing.drawing_month,
    source_drawing.reward_period_id,
    winner_id,
    source_drawing.prize,
    winner_active_credits,
    auth.uid(),
    now(),
    total_entry_count,
    winning_number,
    source_drawing.rules_version,
    source_drawing.official_rules_url,
    'drawn',
    null,
    null,
    source_drawing.id,
    snapshot_cutoff,
    eligible_user_count,
    entry_snapshot_hash
  )
  returning * into redraw_row;

  audit_receipt := jsonb_build_object(
    'schema', 'open-play-map-drawing-receipt-v1',
    'drawing_id', redraw_row.id,
    'drawing_month', redraw_row.drawing_month,
    'reward_period_id', source_drawing.reward_period_id,
    'redraw_of', source_drawing.id,
    'previous_winner_user_ids', previous_winner_user_ids,
    'rules_version', redraw_row.rules_version,
    'official_rules_url', redraw_row.official_rules_url,
    'snapshot_cutoff_at', snapshot_cutoff,
    'drawn_at', redraw_row.drawn_at,
    'drawn_by', redraw_row.drawn_by,
    'eligible_user_count', eligible_user_count,
    'total_entries', total_entry_count,
    'entry_snapshot_hash', entry_snapshot_hash,
    'winning_entry_number', winning_number,
    'winner', jsonb_build_object(
      'user_id', winner_id,
      'username', winner_username,
      'active_credits_at_draw', winner_active_credits
    ),
    'random', jsonb_build_object(
      'source', 'pgcrypto.gen_random_bytes(4)',
      'method', 'rejection sampling'
    ),
    'eligibility', jsonb_build_object(
      'excluded_roles', jsonb_build_array('admin'),
      'excluded_usernames', to_jsonb(public.drawing_excluded_profile_usernames())
    ),
    'entries', entry_snapshot
  );
  audit_receipt_hash_value := encode(digest(audit_receipt::text, 'sha256'), 'hex');

  insert into public.drawing_audit_receipts (
    drawing_id,
    reward_period_id,
    drawing_month,
    receipt_hash,
    receipt
  ) values (
    redraw_row.id,
    source_drawing.reward_period_id,
    source_drawing.drawing_month,
    audit_receipt_hash_value,
    audit_receipt || jsonb_build_object('receipt_hash', audit_receipt_hash_value)
  );

  update public.monthly_drawings
  set audit_receipt_hash = audit_receipt_hash_value
  where id = redraw_row.id
  returning * into redraw_row;

  return redraw_row;
end;
$$;

revoke all on function public.drawing_leaderboard_as_of(timestamptz) from public;
revoke all on function public.drawing_leaderboard_as_of(timestamptz) from anon;
revoke all on function public.drawing_leaderboard_as_of(timestamptz) from authenticated;
revoke all on function public.admin_reward_periods() from public;
revoke all on function public.admin_reward_periods() from anon;
revoke all on function public.mark_monthly_drawing_notified(uuid) from public;
revoke all on function public.mark_monthly_drawing_notified(uuid) from anon;
grant execute on function public.mark_monthly_drawing_notified(uuid) to authenticated;
grant execute on function public.admin_reward_periods() to authenticated;
