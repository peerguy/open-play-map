const PHOTO_BUCKET = 'open-play-photos';
const INSTAGRAM_MAX_IMAGES = 10;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function requiredEnv(env, key) {
  const value = env[key];
  if (!value) throw new Error(`Missing ${key}.`);
  return value;
}

function cleanBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function encodeFilterValue(value) {
  return encodeURIComponent(String(value));
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function supabaseRequest(env, path, options = {}) {
  const supabaseUrl = cleanBaseUrl(requiredEnv(env, 'SUPABASE_URL'));
  const serviceRoleKey = requiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await readJson(response);
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.hint || `Supabase request failed: ${response.status}`;
    const error = new Error(message);
    error.code = data?.code || '';
    error.details = data;
    throw error;
  }
  return data;
}

async function currentUser(env, token) {
  const supabaseUrl = cleanBaseUrl(requiredEnv(env, 'SUPABASE_URL'));
  const serviceRoleKey = requiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${token}`
    }
  });
  const data = await readJson(response);
  if (!response.ok || !data?.id) return null;
  return data;
}

async function requireAdmin(env, request) {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const user = await currentUser(env, match[1]);
  if (!user?.id) return null;

  const profiles = await supabaseRequest(
    env,
    `/rest/v1/profiles?id=eq.${encodeFilterValue(user.id)}&select=id,role&limit=1`
  );
  const profile = profiles?.[0];
  return profile?.role === 'admin' ? { id: user.id } : null;
}

function publicStorageUrl(env, path) {
  if (!path) return '';
  if (/^https:\/\//i.test(path)) return path;
  const supabaseUrl = cleanBaseUrl(requiredEnv(env, 'SUPABASE_URL'));
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
  return `${supabaseUrl}/storage/v1/object/public/${PHOTO_BUCKET}/${encodedPath}`;
}

function isJpegPhoto(photo) {
  const source = String(photo?.storage_path || '');
  return /\.(jpe?g)(?:$|\?)/i.test(source);
}

function locationUrl(env, location) {
  const baseUrl = cleanBaseUrl(env.APP_BASE_URL || 'https://play.scooppickleball.com');
  const url = new URL(baseUrl || 'https://play.scooppickleball.com');
  url.searchParams.set('location', location.slug || location.id);
  return url.toString();
}

function captionForLocation(env, location) {
  const place = [location.city, location.state].filter(Boolean).join(', ');
  return [
    `New open play spot added: ${location.name}`,
    place,
    '',
    'Find details, hours, and player updates on the Scoop Open Play Map:',
    locationUrl(env, location),
    '',
    '#pickleball #openplay #scooppickleball'
  ].filter(line => line !== undefined && line !== null).join('\n').trim();
}

function normalizeImageUrls(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .flatMap(value => String(value || '').split(/\r?\n|,/))
    .map(value => value.trim())
    .filter(Boolean))]
    .slice(0, INSTAGRAM_MAX_IMAGES);
}

function isPublishableJpegUrl(url) {
  return /^https:\/\//i.test(url) && /\.(jpe?g)(?:$|\?)/i.test(url);
}

function instagramLocationId(value) {
  const text = String(value || '').trim();
  return /^\d+$/.test(text) ? text : '';
}

async function findExistingPost(env, locationId) {
  const rows = await supabaseRequest(
    env,
    `/rest/v1/instagram_posts?location_id=eq.${encodeFilterValue(locationId)}&select=*&limit=1`
  );
  return rows?.[0] || null;
}

async function createPostRecord(env, payload) {
  const rows = await supabaseRequest(env, '/rest/v1/instagram_posts?select=*', {
    method: 'POST',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  return rows?.[0] || null;
}

function isMissingDraftColumnError(error) {
  return ['42703', 'PGRST204'].includes(error?.code)
    && /(image_urls|location_tag|instagram_location_id)|column .* does not exist/i.test(error.message || '');
}

function legacyPostPayload(payload) {
  const {
    image_urls: _imageUrls,
    location_tag: _locationTag,
    instagram_location_id: _instagramLocationId,
    ...legacyPayload
  } = payload;
  return legacyPayload;
}

async function savePostRecord(env, locationId, payload, existingPost = null) {
  try {
    return existingPost?.id
      ? await updatePostRecord(env, existingPost.id, payload)
      : await createPostRecord(env, {
        location_id: locationId,
        ...payload
      });
  } catch (error) {
    if (!isMissingDraftColumnError(error)) throw error;

    const legacyPayload = legacyPostPayload(payload);
    return existingPost?.id
      ? await updatePostRecord(env, existingPost.id, legacyPayload)
      : await createPostRecord(env, {
        location_id: locationId,
        ...legacyPayload
      });
  }
}

async function updatePostRecord(env, id, payload) {
  if (!id) return null;
  const rows = await supabaseRequest(env, `/rest/v1/instagram_posts?id=eq.${encodeFilterValue(id)}&select=*`, {
    method: 'PATCH',
    headers: { prefer: 'return=representation' },
    body: JSON.stringify({
      ...payload,
      updated_at: new Date().toISOString()
    })
  });
  return rows?.[0] || null;
}

async function fetchLocation(env, locationId) {
  const rows = await supabaseRequest(
    env,
    `/rest/v1/locations?id=eq.${encodeFilterValue(locationId)}&select=id,slug,name,city,state,status&limit=1`
  );
  return rows?.[0] || null;
}

async function fetchLocationPhoto(env, locationId) {
  const rows = await supabaseRequest(
    env,
    `/rest/v1/photos?location_id=eq.${encodeFilterValue(locationId)}&status=eq.approved&select=id,storage_path,caption,created_at&order=created_at.asc`
  );
  return (rows || []).find(isJpegPhoto) || null;
}

async function instagramRequest(env, path, params) {
  const graphVersion = env.INSTAGRAM_GRAPH_VERSION || 'v26.0';
  const body = new URLSearchParams({
    ...params,
    access_token: requiredEnv(env, 'INSTAGRAM_ACCESS_TOKEN')
  });
  const response = await fetch(`https://graph.instagram.com/${graphVersion}/${path}`, {
    method: 'POST',
    body
  });
  const data = await readJson(response);
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Instagram request failed: ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function instagramGet(env, path, params) {
  const graphVersion = env.INSTAGRAM_GRAPH_VERSION || 'v26.0';
  const url = new URL(`https://graph.instagram.com/${graphVersion}/${path}`);
  Object.entries({
    ...params,
    access_token: requiredEnv(env, 'INSTAGRAM_ACCESS_TOKEN')
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url);
  const data = await readJson(response);
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `Instagram request failed: ${response.status}`;
    throw new Error(message);
  }
  return data;
}

async function waitForContainer(env, containerId) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const status = await instagramGet(env, containerId, { fields: 'status_code' });
    if (status.status_code === 'FINISHED') return status;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`Instagram media container ${status.status_code.toLowerCase()}.`);
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error('Instagram media container did not finish processing in time.');
}

async function createSingleImageContainer(env, imageUrl, caption, locationId = '') {
  const params = { image_url: imageUrl, caption };
  if (locationId) params.location_id = locationId;
  return await instagramRequest(env, `${requiredEnv(env, 'INSTAGRAM_IG_USER_ID')}/media`, params);
}

async function createCarouselContainer(env, imageUrls, caption, locationId = '') {
  const children = [];

  for (const imageUrl of imageUrls) {
    const child = await instagramRequest(env, `${requiredEnv(env, 'INSTAGRAM_IG_USER_ID')}/media`, {
      image_url: imageUrl,
      is_carousel_item: 'true'
    });
    children.push(child.id);
  }

  const params = {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption
  };
  if (locationId) params.location_id = locationId;

  return await instagramRequest(env, `${requiredEnv(env, 'INSTAGRAM_IG_USER_ID')}/media`, params);
}

async function publishLocation(env, location, options, actorId, existingPost = null) {
  const imageUrls = options.imageUrls;
  const imageUrl = imageUrls[0];
  const caption = options.caption || captionForLocation(env, location);
  const locationId = instagramLocationId(options.instagramLocationId);
  const payload = {
    photo_id: options.photoId || null,
    status: 'pending',
    caption,
    image_url: imageUrl,
    image_urls: imageUrls,
    location_tag: String(options.locationTag || '').trim() || null,
    instagram_location_id: locationId || null,
    error_message: null,
    requested_by: actorId
  };
  let postRecord = await savePostRecord(env, location.id, payload, existingPost);

  try {
    const container = imageUrls.length > 1
      ? await createCarouselContainer(env, imageUrls, caption, locationId)
      : await createSingleImageContainer(env, imageUrl, caption, locationId);
    await updatePostRecord(env, postRecord.id, { instagram_container_id: container.id });
    await waitForContainer(env, container.id);
    const published = await instagramRequest(env, `${requiredEnv(env, 'INSTAGRAM_IG_USER_ID')}/media_publish`, {
      creation_id: container.id
    });
    postRecord = await updatePostRecord(env, postRecord.id, {
      status: 'published',
      instagram_container_id: container.id,
      instagram_media_id: published.id,
      error_message: null,
      published_at: new Date().toISOString()
    });
    return postRecord;
  } catch (error) {
    await updatePostRecord(env, postRecord?.id, {
      status: 'failed',
      error_message: error.message || 'Instagram publish failed.'
    });
    throw error;
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const admin = await requireAdmin(env, request);
    if (!admin) return json({ ok: false, error: 'Admin authorization required.' }, 401);

    const body = await request.json().catch(() => ({}));
    const locationId = body.locationId;
    if (!locationId) return json({ ok: false, error: 'locationId is required.' }, 400);

    const existing = await findExistingPost(env, locationId);
    if (existing?.status === 'published') {
      return json({ ok: true, skipped: true, reason: 'Location was already posted to Instagram.', post: existing });
    }

    const location = await fetchLocation(env, locationId);
    if (!location) return json({ ok: false, error: 'Location not found.' }, 404);
    if (location.status !== 'approved') return json({ ok: false, error: 'Location must be approved before posting to Instagram.' }, 409);

    const fallbackPhoto = await fetchLocationPhoto(env, location.id);
    const requestedImageUrls = normalizeImageUrls(body.imageUrls || body.imageUrl);
    const imageUrls = requestedImageUrls.length
      ? requestedImageUrls
      : (fallbackPhoto ? [publicStorageUrl(env, fallbackPhoto.storage_path)] : []);
    if (!imageUrls.length) {
      return json({ ok: false, error: 'Add at least one public JPEG image URL before posting.' }, 400);
    }
    if (imageUrls.some(url => !isPublishableJpegUrl(url))) {
      return json({ ok: false, error: 'Instagram publishing needs public HTTPS JPEG URLs.' }, 400);
    }

    const post = await publishLocation(env, location, {
      caption: String(body.caption || '').trim() || captionForLocation(env, location),
      imageUrls,
      locationTag: body.locationTag,
      instagramLocationId: body.instagramLocationId,
      photoId: fallbackPhoto?.id || null
    }, admin.id, existing);
    return json({ ok: true, post });
  } catch (error) {
    return json({ ok: false, error: error.message || 'Instagram publish failed.' }, 500);
  }
}
