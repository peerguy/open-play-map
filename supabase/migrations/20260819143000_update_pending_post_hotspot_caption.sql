with draft_locations as (
  select
    instagram_posts.id as post_id,
    coalesce(nullif(locations.name, ''), 'This court') as location_name,
    concat_ws(', ', nullif(locations.city, ''), nullif(locations.state, '')) as area,
    'https://play.scooppickleball.com/?location=' || coalesce(nullif(locations.slug, ''), locations.id::text) as location_url
  from public.instagram_posts
  join public.locations on locations.id = instagram_posts.location_id
  where instagram_posts.status is distinct from 'published'
)
update public.instagram_posts
set
  caption = array_to_string(array[
    draft_locations.location_name || ' was recommended as an active pickleball open play hot spot.',
    '',
    case
      when draft_locations.area <> ''
        then 'Calling all players near ' || draft_locations.area || ': have you played here?'
      else 'Calling all local players: have you played here?'
    end,
    '',
    'Check it out on the Scoop Open Play Map and help local players by adding a quick review, uploading pictures, or confirming the open play info is accurate.',
    '',
    'When you sign up or contribute helpful information, you''ll get a chance to win a Scoop paddle or $100 worth of gear from the Scoop Pickleball store.',
    '',
    'View this spot:',
    draft_locations.location_url,
    '',
    '#pickleball #openplay #scooppickleball'
  ], E'\n'),
  updated_at = now()
from draft_locations
where instagram_posts.id = draft_locations.post_id;
