create or replace function public.drawing_excluded_profile_usernames()
returns text[]
language sql
immutable
as $$
  select array['scoop', 'osprey', 'tinascoop']::text[];
$$;

create or replace function public.normalized_drawing_profile_username(profile_username text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(coalesce(profile_username, '')), '[^a-z0-9]+', '', 'g');
$$;

create or replace function public.is_drawing_credit_suppressed(profile_role text, profile_username text)
returns boolean
language sql
immutable
as $$
  select coalesce(profile_role, 'player') = 'admin'
    or public.normalized_drawing_profile_username(profile_username) = any (public.drawing_excluded_profile_usernames());
$$;

create or replace function public.public_leaderboard()
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
      coalesce(sum(valid_credits.active_delta) filter (where valid_credits.status = 'approved'), 0)::integer as active_credits,
      coalesce(sum(valid_credits.lifetime_delta) filter (where valid_credits.status = 'approved'), 0)::integer as lifetime_credits
    from public.valid_contribution_credits() valid_credits
    group by valid_credits.user_id
  ),
  display_rows as (
    select
      profiles.id as user_id,
      profiles.username,
      case
        when public.is_drawing_credit_suppressed(profiles.role, profiles.username) then 0
        else coalesce(totals.active_credits, 0)::integer
      end as active_credits,
      coalesce(totals.lifetime_credits, 0)::integer as lifetime_credits
    from public.profiles
    join totals on totals.user_id = profiles.id
  )
  select
    display_rows.user_id,
    display_rows.username,
    display_rows.active_credits,
    display_rows.lifetime_credits
  from display_rows
  where display_rows.lifetime_credits > 0
     or display_rows.active_credits > 0
  order by display_rows.lifetime_credits desc, display_rows.active_credits desc, display_rows.username asc;
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
    and not public.is_drawing_credit_suppressed(profiles.role, profiles.username)
  order by profiles.username asc, profiles.id asc;
$$;

create or replace function public.apply_monthly_drawing_active_credit_reset(p_drawing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  drawing_row public.monthly_drawings;
  base_active_credits integer;
  post_snapshot_active_credits integer;
  reset_delta integer;
  reset_cutoff timestamptz;
  has_existing_reset boolean;
begin
  select *
  into drawing_row
  from public.monthly_drawings
  where id = p_drawing_id
  for update;

  if not found then
    raise exception 'Drawing not found';
  end if;

  if drawing_row.winner_user_id is null or drawing_row.drawn_at is null then
    return;
  end if;

  reset_cutoff := coalesce(drawing_row.snapshot_cutoff_at, drawing_row.drawn_at);

  select coalesce(sum(valid_credits.active_delta), 0)::integer
  into base_active_credits
  from public.valid_contribution_credits() valid_credits
  where valid_credits.user_id = drawing_row.winner_user_id
    and valid_credits.status = 'approved'
    and not (
      valid_credits.action = 'monthly-reset'
      and valid_credits.target_type = 'monthly-drawing'
      and valid_credits.target_id = drawing_row.id
    );

  select coalesce(sum(valid_credits.active_delta), 0)::integer
  into post_snapshot_active_credits
  from public.valid_contribution_credits() valid_credits
  where valid_credits.user_id = drawing_row.winner_user_id
    and valid_credits.status = 'approved'
    and valid_credits.action <> 'monthly-reset'
    and valid_credits.created_at > reset_cutoff;

  reset_delta := coalesce(post_snapshot_active_credits, 0) - coalesce(base_active_credits, 0);

  select exists (
    select 1
    from public.credits
    where credits.user_id = drawing_row.winner_user_id
      and credits.action = 'monthly-reset'
      and credits.target_type = 'monthly-drawing'
      and credits.target_id = drawing_row.id
  )
  into has_existing_reset;

  if reset_delta <> 0 or has_existing_reset then
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
    do update set
      active_delta = excluded.active_delta,
      lifetime_delta = 0,
      status = 'approved',
      awarded_by = coalesce(excluded.awarded_by, credits.awarded_by);
  end if;
end;
$$;

create or replace function public.run_monthly_drawing(p_drawing_month date default null)
returns public.monthly_drawings
language plpgsql
security definer
set search_path = public, extensions
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

  perform public.apply_monthly_drawing_active_credit_reset(drawing_row.id);

  update public.reward_periods
  set status = 'drawn', updated_at = now()
  where id = period_row.id;

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

  perform public.apply_monthly_drawing_active_credit_reset(drawing_row.id);

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
set search_path = public, extensions
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

  perform public.apply_monthly_drawing_active_credit_reset(redraw_row.id);

  return redraw_row;
end;
$$;

create or replace function public.public_monthly_drawings()
returns table (
  id uuid,
  drawing_month date,
  username text,
  prize text,
  active_credits_at_draw integer,
  drawn_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    monthly_drawings.id,
    monthly_drawings.drawing_month,
    profiles.username,
    monthly_drawings.prize,
    monthly_drawings.active_credits_at_draw,
    monthly_drawings.drawn_at
  from public.monthly_drawings
  left join public.profiles on profiles.id = monthly_drawings.winner_user_id
  where monthly_drawings.drawn_at is not null
    and monthly_drawings.status in ('drawn', 'claimed')
  order by monthly_drawings.drawing_month desc, monthly_drawings.drawn_at desc;
$$;

select public.apply_monthly_drawing_active_credit_reset(monthly_drawings.id)
from public.monthly_drawings
where monthly_drawings.status in ('drawn', 'claimed')
  and monthly_drawings.winner_user_id is not null
  and monthly_drawings.drawn_at is not null;

revoke all on function public.normalized_drawing_profile_username(text) from public;
revoke all on function public.normalized_drawing_profile_username(text) from anon;
revoke all on function public.normalized_drawing_profile_username(text) from authenticated;
revoke all on function public.is_drawing_credit_suppressed(text, text) from public;
revoke all on function public.is_drawing_credit_suppressed(text, text) from anon;
revoke all on function public.is_drawing_credit_suppressed(text, text) from authenticated;
revoke all on function public.apply_monthly_drawing_active_credit_reset(uuid) from public;
revoke all on function public.apply_monthly_drawing_active_credit_reset(uuid) from anon;
revoke all on function public.apply_monthly_drawing_active_credit_reset(uuid) from authenticated;
grant execute on function public.public_leaderboard() to anon, authenticated;
grant execute on function public.public_monthly_drawings() to anon, authenticated;
