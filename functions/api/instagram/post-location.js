const PHOTO_BUCKET = 'open-play-photos';
const INSTAGRAM_MAX_IMAGES = 10;
const INSTAGRAM_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const INSTAGRAM_IMAGE_PROBE_BYTES = 1024 * 1024;
const INSTAGRAM_MIN_IMAGE_WIDTH = 320;
const INSTAGRAM_MAX_IMAGE_WIDTH = 1440;
const INSTAGRAM_MIN_ASPECT_RATIO = 4 / 5;
const INSTAGRAM_MAX_ASPECT_RATIO = 1.91;
const DEFAULT_INSTAGRAM_COLLABORATORS = ['scooppickleball'];
const INSTAGRAM_MAX_COLLABORATORS = 5;

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
    place
      ? `Calling all pickleball players near ${place}.`
      : 'Calling all local pickleball players.',
    '',
    `Have you played at ${location.name || 'this open play location'}? Check it out on the Scoop Open Play Map and help local players by adding a quick review, uploading pictures, or confirming the open play info is accurate.`,
    '',
    "When you sign up or contribute helpful information, you'll get a chance to win a Scoop paddle or $100 worth of gear from the Scoop Pickleball store.",
    '',
    'View this spot:',
    locationUrl(env, location),
    '',
    '#pickleball #openplay #scooppickleball'
  ].filter(line => line !== undefined && line !== null).join('\n').trim();
}

function normalizeImageUrls(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .flatMap(value => String(value || '').split(/\r?\n|,/))
    .map(value => value.trim())
    .filter(Boolean))];
}

function parsePublicHttpsUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Image URLs must be valid public HTTPS URLs.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Image URLs must use HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('Image URLs cannot include embedded credentials.');
  }

  const hostname = url.hostname.toLowerCase();
  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  const first = ipv4 ? Number(ipv4[1]) : null;
  const second = ipv4 ? Number(ipv4[2]) : null;
  const isPrivateIpv4 = ipv4 && (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    isPrivateIpv4
  ) {
    throw new Error('Image URLs must be publicly reachable.');
  }

  return url;
}

function instagramLocationId(value) {
  const text = String(value || '').trim();
  return /^\d+$/.test(text) ? text : '';
}

function normalizeCollaboratorUsernames(values = DEFAULT_INSTAGRAM_COLLABORATORS) {
  const source = values === undefined || values === null ? DEFAULT_INSTAGRAM_COLLABORATORS : values;
  const usernames = (Array.isArray(source) ? source : [source])
    .flatMap(value => String(value || '').split(/\r?\n|,/))
    .map(value => value.trim().replace(/^@+/, '').toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(usernames)];
  if (unique.length > INSTAGRAM_MAX_COLLABORATORS) {
    throw new Error(`Instagram accepts up to ${INSTAGRAM_MAX_COLLABORATORS} collaborators.`);
  }
  const invalid = unique.find(username => !/^[a-z0-9._]{1,30}$/.test(username));
  if (invalid) {
    throw new Error(`Instagram collaborator "${invalid}" is not a valid username.`);
  }
  return unique;
}

function contentLength(headers) {
  const range = headers.get('content-range') || '';
  const rangeTotal = range.match(/\/(\d+)$/)?.[1];
  const length = rangeTotal || headers.get('content-length');
  const value = Number(length);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

async function readLimitedBytes(response, byteLimit) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > byteLimit) throw new Error('Image is too large.');
    return buffer;
  }

  const chunks = [];
  let total = 0;
  while (total < byteLimit) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    const remaining = byteLimit - total;
    const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
    chunks.push(chunk);
    total += chunk.byteLength;
  }
  reader.cancel?.();

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function jpegDimensions(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 3 < bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (offset + 1 >= bytes.length) return null;

    const length = (bytes[offset] << 8) + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;

    const isStartOfFrame = (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    );
    if (isStartOfFrame) {
      if (offset + 6 >= bytes.length) return null;
      return {
        height: (bytes[offset + 3] << 8) + bytes[offset + 4],
        width: (bytes[offset + 5] << 8) + bytes[offset + 6]
      };
    }

    offset += length;
  }

  return null;
}

function validateInstagramImageShape(dimensions) {
  if (!dimensions?.width || !dimensions?.height) {
    throw new Error('Could not read JPEG dimensions.');
  }

  const ratio = dimensions.width / dimensions.height;
  if (dimensions.width < INSTAGRAM_MIN_IMAGE_WIDTH) {
    throw new Error(`Image width must be at least ${INSTAGRAM_MIN_IMAGE_WIDTH}px.`);
  }
  if (dimensions.width > INSTAGRAM_MAX_IMAGE_WIDTH) {
    throw new Error(`Image width must be ${INSTAGRAM_MAX_IMAGE_WIDTH}px or less.`);
  }
  if (ratio < INSTAGRAM_MIN_ASPECT_RATIO || ratio > INSTAGRAM_MAX_ASPECT_RATIO) {
    throw new Error('Image aspect ratio must be between 4:5 and 1.91:1.');
  }
}

async function inspectInstagramImageUrl(imageUrl) {
  const url = parsePublicHttpsUrl(imageUrl);
  const response = await fetch(url.toString(), {
    headers: {
      accept: 'image/jpeg,image/*;q=0.8',
      range: `bytes=0-${INSTAGRAM_IMAGE_PROBE_BYTES - 1}`,
      'user-agent': 'OpenPlayMapInstagramImageCheck/1.0'
    },
    redirect: 'follow'
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`Image URL returned HTTP ${response.status}.`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('image/jpeg') && !contentType.includes('image/jpg')) {
    throw new Error('Image URL must return a JPEG content type.');
  }

  const sizeBytes = contentLength(response.headers);
  if (sizeBytes === null) {
    throw new Error('Image URL must return a content length.');
  }
  if (sizeBytes > INSTAGRAM_MAX_IMAGE_BYTES) {
    throw new Error('Image must be 8 MB or smaller.');
  }

  const bytes = await readLimitedBytes(response, Math.min(INSTAGRAM_IMAGE_PROBE_BYTES, INSTAGRAM_MAX_IMAGE_BYTES));
  const dimensions = jpegDimensions(bytes);
  validateInstagramImageShape(dimensions);

  return {
    url: url.toString(),
    contentType,
    sizeBytes,
    width: dimensions.width,
    height: dimensions.height,
    aspectRatio: Number((dimensions.width / dimensions.height).toFixed(4))
  };
}

async function inspectInstagramImageUrls(imageUrls) {
  const urls = normalizeImageUrls(imageUrls);
  if (!urls.length) throw new Error('Add at least one public JPEG image URL before posting.');
  if (urls.length > INSTAGRAM_MAX_IMAGES) throw new Error(`Instagram accepts up to ${INSTAGRAM_MAX_IMAGES} images.`);

  const results = [];
  for (const [index, url] of urls.entries()) {
    try {
      results.push(await inspectInstagramImageUrl(url));
    } catch (error) {
      throw new Error(`Image ${index + 1}: ${error.message || 'Image is not publishable.'}`);
    }
  }
  return results;
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
    && /(image_urls|location_tag|instagram_location_id|collaborator_usernames)|column .* does not exist/i.test(error.message || '');
}

function legacyPostPayload(payload) {
  const {
    image_urls: _imageUrls,
    location_tag: _locationTag,
    instagram_location_id: _instagramLocationId,
    collaborator_usernames: _collaboratorUsernames,
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

function applyCollaborators(params, collaborators = []) {
  if (collaborators.length) params.collaborators = collaborators.join(',');
  return params;
}

async function createSingleImageContainer(env, imageUrl, caption, locationId = '', collaborators = []) {
  const params = { image_url: imageUrl, caption };
  if (locationId) params.location_id = locationId;
  applyCollaborators(params, collaborators);
  return await instagramRequest(env, `${requiredEnv(env, 'INSTAGRAM_IG_USER_ID')}/media`, params);
}

async function createCarouselContainer(env, imageUrls, caption, locationId = '', collaborators = []) {
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
  applyCollaborators(params, collaborators);

  return await instagramRequest(env, `${requiredEnv(env, 'INSTAGRAM_IG_USER_ID')}/media`, params);
}

async function publishLocation(env, location, options, actorId, existingPost = null) {
  const imageUrls = options.imageUrls;
  const imageUrl = imageUrls[0];
  const caption = options.caption || captionForLocation(env, location);
  const locationId = instagramLocationId(options.instagramLocationId);
  const collaborators = normalizeCollaboratorUsernames(options.collaborators);
  const payload = {
    photo_id: options.photoId || null,
    status: 'pending',
    caption,
    image_url: imageUrl,
    image_urls: imageUrls,
    location_tag: String(options.locationTag || '').trim() || null,
    instagram_location_id: locationId || null,
    collaborator_usernames: collaborators,
    error_message: null,
    requested_by: actorId
  };
  let postRecord = await savePostRecord(env, location.id, payload, existingPost);

  try {
    const container = imageUrls.length > 1
      ? await createCarouselContainer(env, imageUrls, caption, locationId, collaborators)
      : await createSingleImageContainer(env, imageUrl, caption, locationId, collaborators);
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
    if (imageUrls.length > INSTAGRAM_MAX_IMAGES) {
      return json({ ok: false, error: `Instagram accepts up to ${INSTAGRAM_MAX_IMAGES} images.` }, 400);
    }

    try {
      await inspectInstagramImageUrls(imageUrls);
    } catch (error) {
      return json({ ok: false, error: error.message || 'Instagram publishing needs public HTTPS JPEG URLs.' }, 400);
    }

    const post = await publishLocation(env, location, {
      caption: String(body.caption || '').trim() || captionForLocation(env, location),
      imageUrls,
      locationTag: body.locationTag,
      instagramLocationId: body.instagramLocationId,
      collaborators: body.collaborators ?? body.collaboratorUsernames,
      photoId: fallbackPhoto?.id || null
    }, admin.id, existing);
    return json({ ok: true, post });
  } catch (error) {
    return json({ ok: false, error: error.message || 'Instagram publish failed.' }, 500);
  }
}

export async function onRequestPreflightImages({ request, env }) {
  try {
    const admin = await requireAdmin(env, request);
    if (!admin) return json({ ok: false, error: 'Admin authorization required.' }, 401);

    const body = await request.json().catch(() => ({}));
    const results = await inspectInstagramImageUrls(body.imageUrls || body.imageUrl);
    return json({ ok: true, results });
  } catch (error) {
    return json({ ok: false, error: error.message || 'Image is not ready for Instagram.' }, 400);
  }
}
