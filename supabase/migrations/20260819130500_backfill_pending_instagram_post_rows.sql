insert into public.instagram_posts (
  location_id,
  status,
  caption,
  location_tag,
  collaborator_usernames
)
select
  locations.id,
  'pending',
  array_to_string(array[
    case
      when concat_ws(', ', nullif(locations.city, ''), nullif(locations.state, '')) <> ''
        then 'Calling all pickleball players near ' || concat_ws(', ', nullif(locations.city, ''), nullif(locations.state, '')) || '.'
      else 'Calling all local pickleball players.'
    end,
    '',
    'Have you played at ' || coalesce(nullif(locations.name, ''), 'this open play location') || '? Check it out on the Scoop Open Play Map and help local players by adding a quick review, uploading pictures, or confirming the open play info is accurate.',
    '',
    'When you sign up or contribute helpful information, you''ll get a chance to win a Scoop paddle or $100 worth of gear from the Scoop Pickleball store.',
    '',
    'View this spot:',
    'https://play.scooppickleball.com/?location=' || coalesce(nullif(locations.slug, ''), locations.id::text),
    '',
    '#pickleball #openplay #scooppickleball'
  ], E'\n'),
  concat_ws(' · ', nullif(locations.name, ''), nullif(locations.city, ''), nullif(locations.state, '')),
  '["scooppickleball"]'::jsonb
from public.locations
left join public.instagram_posts on instagram_posts.location_id = locations.id
where locations.status = 'approved'
  and instagram_posts.id is null;
