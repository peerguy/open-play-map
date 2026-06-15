(function () {
  const config = window.OpenPlaySupabaseConfig || {};
  const UI_RELIABILITY = {
    confirmed: 'Confirmed',
    sometimes: 'Sometimes active',
    uncertain: 'Uncertain'
  };
  const DB_RELIABILITY = {
    Confirmed: 'confirmed',
    'Sometimes active': 'sometimes',
    Uncertain: 'uncertain',
    confirmed: 'confirmed',
    sometimes: 'sometimes',
    uncertain: 'uncertain'
  };
  const PHOTO_BUCKET = 'open-play-photos';
  const PHOTO_MAX_FILES = 4;
  const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
  const PHOTO_TARGET_BYTES = Math.floor(PHOTO_MAX_BYTES * 0.94);
  const PHOTO_MAX_DIMENSION = 2400;
  const PHOTO_MIN_DIMENSION = 900;
  const PHOTO_COMPRESSION_QUALITIES = [0.86, 0.78, 0.7, 0.62];
  const PHOTO_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  function isConfigured() {
    return Boolean(config.url && config.anonKey);
  }

  function client() {
    return window.OpenPlaySupabaseClient?.getClient?.() || null;
  }

  function dateOnly(value) {
    return value ? String(value).slice(0, 10) : '';
  }

  function normalizeReliability(value) {
    if (!value) return null;
    return DB_RELIABILITY[value] || DB_RELIABILITY[String(value).trim()] || null;
  }

  function displayReliability(value) {
    return UI_RELIABILITY[value] || value || '';
  }

  function publicStorageUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path) || path.startsWith('assets/')) return path;
    const encodedPath = String(path).split('/').map(encodeURIComponent).join('/');
    return `${config.url}/storage/v1/object/public/${PHOTO_BUCKET}/${encodedPath}`;
  }

  function mapPhotoUrl(photo) {
    if (typeof photo === 'string') return publicStorageUrl(photo);
    return publicStorageUrl(photo?.storage_path || photo?.url || '');
  }

  function mapLocationPhotos(photos = []) {
    return photos
      .filter(photo => !photo.status || photo.status === 'approved')
      .map(mapPhotoUrl)
      .filter(Boolean);
  }

  function safeFilePart(value) {
    return String(value || 'photo')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'photo';
  }

  function normalizePhotoFiles(files = []) {
    return Array.from(files || []).filter(file => file && typeof file === 'object' && 'size' in file && 'type' in file);
  }

  function validatePhotoFiles(files = []) {
    const selected = normalizePhotoFiles(files);
    if (selected.length > PHOTO_MAX_FILES) {
      throw new Error(`Upload up to ${PHOTO_MAX_FILES} photos at a time.`);
    }

    selected.forEach(file => {
      if (!PHOTO_TYPES[file.type]) {
        throw new Error('Photos must be JPG, PNG, or WebP images.');
      }
    });

    return selected;
  }

  function validatePhotoUploadSizes(files = []) {
    files.forEach(file => {
      if (file.size > PHOTO_MAX_BYTES) {
        throw new Error('That photo could not be compressed under 5 MB. Try a smaller image.');
      }
    });
  }

  function canCompressPhotos() {
    return Boolean(
      typeof document !== 'undefined' &&
      typeof URL !== 'undefined' &&
      typeof URL.createObjectURL === 'function' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      HTMLCanvasElement.prototype.toBlob
    );
  }

  function loadPhotoImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read that photo. Try a JPG, PNG, or WebP image.'));
      };
      image.src = objectUrl;
    });
  }

  function photoCanvasSize(image, maxDimension) {
    const sourceWidth = image.naturalWidth || image.width || 1;
    const sourceHeight = image.naturalHeight || image.height || 1;
    const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    return {
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale))
    };
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error('Unable to compress that photo. Try a smaller image.'));
      }, type, quality);
    });
  }

  function compressedPhotoName(file) {
    const basename = safeFilePart(String(file.name || 'photo').replace(/\.[^.]+$/, ''));
    return `${basename}-compressed.jpg`;
  }

  function photoBlobToFile(sourceFile, blob) {
    return new File([blob], compressedPhotoName(sourceFile), {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
  }

  async function compressPhotoFile(file) {
    if (file.size <= PHOTO_MAX_BYTES) return file;
    if (!canCompressPhotos()) {
      throw new Error('That photo is over 5 MB and this browser cannot compress it. Try a smaller JPG, PNG, or WebP image.');
    }

    const image = await loadPhotoImage(file);
    const sourceWidth = image.naturalWidth || image.width || 1;
    const sourceHeight = image.naturalHeight || image.height || 1;
    let maxDimension = Math.min(PHOTO_MAX_DIMENSION, Math.max(sourceWidth, sourceHeight));
    let bestBlob = null;

    while (maxDimension >= PHOTO_MIN_DIMENSION) {
      const { width, height } = photoCanvasSize(image, maxDimension);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to compress that photo. Try a smaller image.');

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      for (const quality of PHOTO_COMPRESSION_QUALITIES) {
        const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
        if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
        if (blob.size <= PHOTO_TARGET_BYTES) return photoBlobToFile(file, blob);
      }

      maxDimension = Math.floor(maxDimension * 0.82);
    }

    if (bestBlob && bestBlob.size <= PHOTO_MAX_BYTES) return photoBlobToFile(file, bestBlob);
    throw new Error('That photo is too large to compress under 5 MB. Try a smaller image.');
  }

  async function preparePhotoFiles(files = []) {
    const selected = validatePhotoFiles(files);
    const prepared = [];

    for (const file of selected) {
      prepared.push(await compressPhotoFile(file));
    }

    return prepared;
  }

  function formatTime(value) {
    if (!value) return '';
    const [hourValue, minuteValue] = String(value).split(':');
    let hour = Number(hourValue);
    const minute = Number(minuteValue || 0);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return String(value);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour %= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  function slotHours(slot) {
    const start = formatTime(slot.start_time);
    const end = formatTime(slot.end_time);
    if (start && end) return `${start}-${end}`;
    return 'TBD';
  }

  function parseTime(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  }

  function parseDays(value) {
    const text = String(value || '').trim();
    if (!text || /tbd/i.test(text)) return [];
    return text.split(',').map(day => day.trim()).filter(Boolean);
  }

  function slugFromCourt(court = {}) {
    return court.id || String(court.name || 'location')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80);
  }

  async function fetchLocationById(supabase, locationId) {
    const { data, error } = await supabase
      .from('locations')
      .select('*,open_play_slots(*),photos(id,storage_path,status)')
      .eq('id', locationId)
      .single();

    if (error) throw error;
    return mapLocation(data);
  }

  function skillLevel(record) {
    const levels = Array.isArray(record.skill_levels) ? record.skill_levels.filter(Boolean) : [];
    return levels.length ? levels.join(', ') : 'unknown';
  }

  function freeStatus(record) {
    if (typeof record.is_free === 'boolean') return record.is_free;
    if (record.access === 'public') return true;
    if (['paid', 'private', 'club'].includes(record.access)) return false;
    return null;
  }

  function mapLocation(record) {
    return {
      id: record.slug || record.id,
      remoteId: record.id,
      name: record.name,
      address: record.address || `${record.city || ''}, ${record.state || ''}`.replace(/^, |, $/g, ''),
      city: record.city || '',
      state: record.state || '',
      country: record.country || 'USA',
      latitude: Number(record.latitude),
      longitude: Number(record.longitude),
      icon: 'OP',
      access: record.access || 'unknown',
      isFree: freeStatus(record),
      openPlay: (record.open_play_slots || []).map(slot => ({
        days: Array.isArray(slot.days) && slot.days.length ? slot.days.join(', ') : 'Days TBD',
        hours: slotHours(slot),
        startTime: formatTime(slot.start_time),
        endTime: formatTime(slot.end_time),
        notes: slot.notes || ''
      })),
      estimatedSkillLevel: skillLevel(record),
      skillLevels: Array.isArray(record.skill_levels) ? record.skill_levels.filter(Boolean) : [],
      courts: {
        count: record.court_count,
        surface: record.surface || 'unknown',
        indoorOutdoor: record.indoor_outdoor || 'unknown'
      },
      photos: mapLocationPhotos(record.photos || []),
      notes: record.notes || '',
      sourceUrl: record.source_url || '',
      lastVerified: record.last_verified || '',
      status: record.status || 'approved',
      userSubmitted: Boolean(record.submitted_by),
      submittedBy: record.submitted_by || '',
      submittedByUsername: record.submitted_by ? 'Community member' : '',
      createdAt: dateOnly(record.created_at),
      updatedAt: dateOnly(record.updated_at),
      approvedAt: dateOnly(record.approved_at)
    };
  }

  function reviewsToMap(reviews) {
    return (reviews || []).reduce((map, review) => {
      if (!map[review.courtId]) map[review.courtId] = [];
      map[review.courtId].push(review);
      return map;
    }, {});
  }

  function mapReview(record, lookups = {}) {
    const location = record.locations || lookups.locations?.get?.(record.location_id) || {};
    const profile = record.profiles || lookups.profiles?.get?.(record.user_id) || {};
    return {
      id: record.id,
      remoteId: record.id,
      courtId: record.location_slug || location.slug || record.location_id,
      remoteLocationId: record.location_id,
      courtName: record.location_name || location.name || '',
      userId: record.user_id,
      username: record.username || profile.username || 'Player',
      skillLevel: record.profile_skill_level || profile.skill_level || '',
      body: record.body || '',
      skill: Array.isArray(record.skill_levels) && record.skill_levels.length ? record.skill_levels.join(', ') : 'unknown',
      skillLevels: Array.isArray(record.skill_levels) ? record.skill_levels.filter(Boolean) : [],
      crowdLevel: record.crowd || '',
      bestTime: record.best_time || '',
      openPlayReliability: displayReliability(record.reliability),
      netSetup: record.net_setup || '',
      playFormat: record.play_format || '',
      beginnerFriendliness: record.beginner_friendly || '',
      fees: record.fees || '',
      amenities: record.amenities || '',
      lighting: record.lighting || '',
      schedulingApp: record.scheduling_app || '',
      visited: record.visited_on || '',
      createdAt: dateOnly(record.created_at),
      createdAtTimestamp: record.created_at || '',
      updatedAt: dateOnly(record.updated_at),
      updatedAtTimestamp: record.updated_at || '',
      status: record.status || 'published'
    };
  }

  function mapCredit(record, profiles = new Map()) {
    const profile = record.profiles || profiles.get(record.user_id) || {};
    return {
      id: record.id,
      userId: record.user_id,
      username: profile.username || 'Player',
      action: record.action,
      targetType: record.target_type || '',
      targetId: record.target_id || '',
      activeCreditsDelta: Number(record.active_delta || 0),
      lifetimeCreditsDelta: Number(record.lifetime_delta || 0),
      createdAt: dateOnly(record.created_at),
      month: dateOnly(record.created_at).slice(0, 7),
      status: record.status || 'approved'
    };
  }

  function mapReport(record, lookups = {}) {
    const metadata = record.metadata || {};
    const reporter = record.profiles || lookups.profiles?.get?.(record.reporter_id) || {};
    const reportedReview = lookups.reviewsById?.get?.(record.target_id);
    const location = record.target_type === 'review'
      ? lookups.locations?.get?.(reportedReview?.remoteLocationId || reportedReview?.location_id)
      : lookups.locations?.get?.(record.target_id);

    return {
      id: record.id,
      remoteId: record.id,
      targetType: record.target_type,
      targetId: record.target_type === 'review'
        ? (location?.slug || metadata.location_slug || record.target_id)
        : (location?.slug || metadata.location_slug || record.target_id),
      remoteTargetId: record.target_id,
      targetName: metadata.target_name || location?.name || reportedReview?.courtName || '',
      reviewId: record.target_type === 'review' ? record.target_id : '',
      reason: record.reason || '',
      userId: record.reporter_id || '',
      username: reporter.username || metadata.username || 'Unknown',
      createdAt: dateOnly(record.created_at),
      status: record.status || 'open'
    };
  }

  function mapSuggestedEdit(record, lookups = {}) {
    const location = record.locations || lookups.locations?.get?.(record.location_id) || {};
    const submitter = record.profiles || lookups.profiles?.get?.(record.submitted_by) || {};
    const suggestedLocation = record.suggested_location || {};
    const locationId = location.slug || suggestedLocation.id || record.location_id;
    return {
      id: record.id,
      remoteId: record.id,
      locationId,
      remoteLocationId: record.location_id,
      locationName: location.name || suggestedLocation.name || 'Location',
      suggestedLocation: {
        ...suggestedLocation,
        id: locationId,
        remoteId: record.location_id
      },
      reason: record.note || '',
      userId: record.submitted_by,
      username: submitter.username || 'Player',
      createdAt: dateOnly(record.created_at),
      status: record.status || 'pending',
      approvedAt: record.status === 'approved' ? dateOnly(record.reviewed_at) : '',
      rejectedAt: record.status === 'rejected' ? dateOnly(record.reviewed_at) : ''
    };
  }

  function mapPhoto(record, lookups = {}) {
    const location = record.locations || lookups.locations?.get?.(record.location_id) || {};
    const uploader = record.profiles || lookups.profiles?.get?.(record.uploaded_by) || {};
    return {
      id: record.id,
      remoteId: record.id,
      locationId: location.slug || record.location_id,
      remoteLocationId: record.location_id,
      reviewId: record.review_id || '',
      uploadedBy: record.uploaded_by || '',
      username: uploader.username || 'Player',
      storagePath: record.storage_path,
      url: publicStorageUrl(record.storage_path),
      caption: record.caption || '',
      status: record.status || 'pending',
      locationName: location.name || 'Location',
      createdAt: dateOnly(record.created_at),
      createdAtTimestamp: record.created_at || ''
    };
  }

  async function request(path) {
    if (!isConfigured()) return null;

    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed: ${response.status}`);
    }

    return response.json();
  }

  async function fetchApprovedLocations() {
    const rows = await request('locations?select=*,open_play_slots(*),photos(id,storage_path,status)&status=eq.approved&order=name.asc');
    if (!rows) return null;
    return rows.map(mapLocation);
  }

  async function fetchAdminLocations() {
    const supabase = client();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('locations')
      .select('*,open_play_slots(*),photos(id,storage_path,status)')
      .order('status', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapLocation);
  }

  async function updateLocationStatus(locationId, status, actorId = null) {
    const supabase = client();
    if (!supabase || !locationId) throw new Error('Supabase is not configured.');

    const payload = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'approved') {
      payload.approved_at = new Date().toISOString();
      if (actorId) payload.approved_by = actorId;
    }

    const { data, error } = await supabase
      .from('locations')
      .update(payload)
      .eq('id', locationId)
      .select('*,open_play_slots(*)')
      .single();

    if (error) throw error;
    return mapLocation(data);
  }

  async function saveAdminLocation(court) {
    const supabase = client();
    if (!supabase || !court?.remoteId) throw new Error('Supabase is not configured.');

    const payload = {
      name: court.name,
      address: court.address,
      city: court.city,
      state: court.state,
      country: court.country || 'USA',
      latitude: court.latitude,
      longitude: court.longitude,
      access: court.access || 'unknown',
      is_free: court.isFree,
      court_count: court.courts?.count ?? null,
      surface: court.courts?.surface || null,
      indoor_outdoor: court.courts?.indoorOutdoor || 'unknown',
      skill_levels: Array.isArray(court.skillLevels) ? court.skillLevels : [],
      notes: court.notes || null,
      status: court.status || 'approved',
      last_verified: court.lastVerified || null,
      updated_at: new Date().toISOString()
    };

    const { error: locationError } = await supabase
      .from('locations')
      .update(payload)
      .eq('id', court.remoteId);

    if (locationError) throw locationError;

    const { error: deleteSlotsError } = await supabase
      .from('open_play_slots')
      .delete()
      .eq('location_id', court.remoteId);

    if (deleteSlotsError) throw deleteSlotsError;

    const slots = (court.openPlay || [])
      .map(slot => ({
        location_id: court.remoteId,
        days: parseDays(slot.days),
        start_time: parseTime(slot.startTime || ''),
        end_time: parseTime(slot.endTime || ''),
        notes: slot.notes || null
      }))
      .filter(slot => slot.days.length || slot.start_time || slot.end_time || slot.notes);

    if (slots.length) {
      const { error: insertSlotsError } = await supabase
        .from('open_play_slots')
        .insert(slots);

      if (insertSlotsError) throw insertSlotsError;
    }

    return fetchLocationById(supabase, court.remoteId);
  }

  function locationPayload(court, user, status = 'pending') {
    return {
      slug: slugFromCourt(court),
      name: court.name,
      address: court.address || null,
      city: court.city || null,
      state: court.state || null,
      country: court.country || 'USA',
      latitude: court.latitude,
      longitude: court.longitude,
      access: court.access || 'unknown',
      is_free: typeof court.isFree === 'boolean' ? court.isFree : court.access === 'public',
      court_count: court.courts?.count ?? null,
      surface: court.courts?.surface || null,
      indoor_outdoor: court.courts?.indoorOutdoor || 'unknown',
      skill_levels: Array.isArray(court.skillLevels) ? court.skillLevels : [],
      notes: court.notes || null,
      source_url: court.sourceUrl || null,
      last_verified: court.lastVerified || null,
      status,
      submitted_by: user?.id || null,
      updated_at: new Date().toISOString()
    };
  }

  function slotPayloads(court, locationId) {
    return (court.openPlay || [])
      .map(slot => ({
        location_id: locationId,
        days: parseDays(slot.days),
        start_time: parseTime(slot.startTime || ''),
        end_time: parseTime(slot.endTime || ''),
        notes: slot.notes || null
      }))
      .filter(slot => slot.days.length || slot.start_time || slot.end_time || slot.notes);
  }

  function photoStoragePath({ userId, locationId, reviewId = '', file, index }) {
    const extension = PHOTO_TYPES[file.type] || safeFilePart(file.name).split('.').pop() || 'jpg';
    const basename = safeFilePart(String(file.name || 'photo').replace(/\.[^.]+$/, ''));
    const timestamp = Date.now().toString(36);
    const scope = reviewId ? `reviews/${reviewId}` : `locations/${locationId}`;
    return `${userId}/${scope}/${timestamp}-${index + 1}-${basename}.${extension}`;
  }

  async function uploadPhotoFiles({ locationId, reviewId = null, user, files = [] }) {
    const supabase = client();
    const selected = validatePhotoFiles(files);
    validatePhotoUploadSizes(selected);
    if (!selected.length) return [];
    if (!supabase || !locationId || !user?.id) throw new Error('Supabase is not configured.');

    const uploaded = [];
    for (const [index, file] of selected.entries()) {
      const storagePath = photoStoragePath({ userId: user.id, locationId, reviewId, file, index });
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '31536000',
          contentType: file.type,
          upsert: false
        });

      if (uploadError) throw uploadError;
      uploaded.push(storagePath);
    }

    return uploaded;
  }

  async function insertPhotoRows({ locationId, reviewId = null, user, storagePaths = [] }) {
    const supabase = client();
    if (!storagePaths.length) return [];
    if (!supabase || !locationId || !user?.id) throw new Error('Supabase is not configured.');

    const rows = storagePaths.map(storagePath => ({
      location_id: locationId,
      review_id: reviewId,
      uploaded_by: user.id,
      storage_path: storagePath,
      status: 'pending'
    }));

    const { data, error } = await supabase
      .from('photos')
      .insert(rows)
      .select('*');

    if (error) throw error;
    return data || [];
  }

  async function submitLocationPhotos(court, user, photoFiles = []) {
    const supabase = client();
    if (!supabase || !court?.remoteId || !user?.id) throw new Error('Supabase is not configured.');
    const preparedPhotoFiles = await preparePhotoFiles(photoFiles);

    const storagePaths = await uploadPhotoFiles({
      locationId: court.remoteId,
      user,
      files: preparedPhotoFiles
    });

    return insertPhotoRows({
      locationId: court.remoteId,
      user,
      storagePaths
    });
  }

  async function submitLocation(court, user, photoFiles = []) {
    const supabase = client();
    if (!supabase || !user?.id) throw new Error('Supabase is not configured.');
    const preparedPhotoFiles = await preparePhotoFiles(photoFiles);

    let payload = locationPayload(court, user, 'pending');
    let result = await supabase
      .from('locations')
      .insert(payload)
      .select('*,open_play_slots(*)')
      .single();

    if (result.error && String(result.error.message || '').toLowerCase().includes('duplicate')) {
      payload = {
        ...payload,
        slug: `${payload.slug}-${Date.now().toString(36)}`
      };
      result = await supabase
        .from('locations')
        .insert(payload)
        .select('*,open_play_slots(*)')
        .single();
    }

    if (result.error) throw result.error;

    const slots = slotPayloads(court, result.data.id);
    if (slots.length) {
      const { error: slotError } = await supabase.from('open_play_slots').insert(slots);
      if (slotError) throw slotError;
    }

    const storagePaths = await uploadPhotoFiles({
      locationId: result.data.id,
      user,
      files: preparedPhotoFiles
    });
    await insertPhotoRows({
      locationId: result.data.id,
      user,
      storagePaths
    });

    return fetchLocationById(supabase, result.data.id);
  }

  function reviewPayload(court, review, user) {
    return {
      location_id: court.remoteId,
      user_id: user.id,
      body: review.body || null,
      visited_on: review.visited || null,
      skill_levels: Array.isArray(review.skillLevels) ? review.skillLevels : [],
      crowd: review.crowdLevel || null,
      best_time: review.bestTime || null,
      reliability: normalizeReliability(review.openPlayReliability),
      net_setup: review.netSetup || null,
      play_format: review.playFormat || null,
      beginner_friendly: review.beginnerFriendliness || null,
      fees: review.fees || null,
      amenities: review.amenities || null,
      lighting: review.lighting || null,
      scheduling_app: review.schedulingApp || null,
      status: 'published',
      updated_at: new Date().toISOString()
    };
  }

  async function submitReview(court, review, user, photoFiles = []) {
    const supabase = client();
    if (!supabase || !court?.remoteId || !user?.id) throw new Error('Supabase is not configured.');
    const preparedPhotoFiles = await preparePhotoFiles(photoFiles);

    const { data, error } = await supabase
      .from('reviews')
      .upsert(reviewPayload(court, review, user), { onConflict: 'location_id,user_id' })
      .select('*')
      .single();

    if (error) throw error;

    const storagePaths = await uploadPhotoFiles({
      locationId: court.remoteId,
      reviewId: data.id,
      user,
      files: preparedPhotoFiles
    });
    await insertPhotoRows({
      locationId: court.remoteId,
      reviewId: data.id,
      user,
      storagePaths
    });

    return mapReview(data, {
      locations: new Map([[court.remoteId, { slug: court.id, name: court.name }]]),
      profiles: new Map([[user.id, { username: user.username, skill_level: user.skillLevel }]])
    });
  }

  async function fetchReviewMap() {
    const supabase = client();
    if (!supabase) return null;

    const { data, error } = await supabase.rpc('location_reviews');
    if (error) throw error;
    return reviewsToMap((data || []).map(mapReview));
  }

  async function fetchOwnReports() {
    const supabase = client();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapReport);
  }

  async function submitReport({ targetType, targetId, reason, metadata = {} }) {
    const supabase = client();
    if (!supabase || !targetType || !targetId) throw new Error('Supabase is not configured.');

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const userId = sessionData.session?.user?.id;
    if (!userId) throw new Error('You must be signed in.');

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: userId,
        target_type: targetType,
        target_id: targetId,
        reason,
        metadata
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapReport(data);
  }

  async function submitSuggestedEdit(currentLocation, suggestedLocation, reason, user) {
    const supabase = client();
    if (!supabase || !currentLocation?.remoteId || !user?.id) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('suggested_edits')
      .insert({
        location_id: currentLocation.remoteId,
        submitted_by: user.id,
        note: reason,
        suggested_location: {
          ...suggestedLocation,
          id: currentLocation.id,
          remoteId: currentLocation.remoteId
        },
        status: 'pending'
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapSuggestedEdit(data, {
      locations: new Map([[currentLocation.remoteId, { slug: currentLocation.id, name: currentLocation.name }]]),
      profiles: new Map([[user.id, { username: user.username }]])
    });
  }

  async function updateSuggestedEditStatus(editId, status, actorId = null) {
    const supabase = client();
    if (!supabase || !editId) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('suggested_edits')
      .update({
        status,
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', editId)
      .select('*')
      .single();

    if (error) throw error;
    return mapSuggestedEdit(data);
  }

  async function approveSuggestedEdit(edit, nextCourt, actorId = null) {
    if (!edit?.remoteId) throw new Error('A database-backed suggested edit is required.');
    const savedCourt = await saveAdminLocation(nextCourt);
    await updateSuggestedEditStatus(edit.remoteId, 'approved', actorId);
    return savedCourt;
  }

  async function rejectSuggestedEdit(editId, actorId = null) {
    return updateSuggestedEditStatus(editId, 'rejected', actorId);
  }

  async function updateReportStatus(reportId, status, actorId = null) {
    const supabase = client();
    if (!supabase || !reportId) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('reports')
      .update({
        status,
        resolved_by: actorId,
        resolved_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select('*')
      .single();

    if (error) throw error;
    return mapReport(data);
  }

  async function removeReviewForReport(reviewId, reportId, actorId = null) {
    const supabase = client();
    if (!supabase || !reviewId) throw new Error('Supabase is not configured.');

    const { error: reviewError } = await supabase
      .from('reviews')
      .update({
        status: 'removed',
        updated_at: new Date().toISOString()
      })
      .eq('id', reviewId);

    if (reviewError) throw reviewError;
    if (reportId) {
      await updateReportStatus(reportId, 'resolved', actorId);
    }
  }

  async function updateAdminReview(reviewId, review = {}) {
    const supabase = client();
    if (!supabase || !reviewId) throw new Error('Supabase is not configured.');

    const status = ['published', 'hidden', 'removed'].includes(review.status)
      ? review.status
      : 'published';
    const payload = {
      body: review.body || null,
      visited_on: review.visited || null,
      skill_levels: Array.isArray(review.skillLevels) ? review.skillLevels : [],
      crowd: review.crowdLevel || null,
      best_time: review.bestTime || null,
      reliability: normalizeReliability(review.openPlayReliability),
      net_setup: review.netSetup || null,
      play_format: review.playFormat || null,
      beginner_friendly: review.beginnerFriendliness || null,
      fees: review.fees || null,
      amenities: review.amenities || null,
      lighting: review.lighting || null,
      scheduling_app: review.schedulingApp || null,
      status,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('reviews')
      .update(payload)
      .eq('id', reviewId)
      .select('*,locations(slug,name),profiles:user_id(username,skill_level)')
      .single();

    if (error) throw error;
    return mapReview(data);
  }

  async function removeAdminPhoto(photoId, storagePath = '') {
    const supabase = client();
    if (!supabase || !photoId) throw new Error('Supabase is not configured.');

    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .remove([storagePath]);
      if (storageError) throw storageError;
    }

    const { error } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (error) throw error;
    return { id: photoId, remoteId: photoId, storagePath, status: 'removed' };
  }

  async function updatePhotoStatus(photoId, status) {
    const supabase = client();
    if (!supabase || !photoId) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .from('photos')
      .update({ status })
      .eq('id', photoId)
      .select('*,locations(slug,name),profiles:uploaded_by(username)')
      .single();

    if (error) throw error;
    return mapPhoto(data);
  }

  async function fetchCurrentUserContributions(userId) {
    const supabase = client();
    if (!supabase || !userId) return null;

    const [locationsResult, reviewsResult, creditsResult] = await Promise.all([
      supabase
        .from('locations')
        .select('*,open_play_slots(*)')
        .eq('submitted_by', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('*,locations(slug,name)')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('credits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    ]);

    if (locationsResult.error) throw locationsResult.error;
    if (reviewsResult.error) throw reviewsResult.error;
    if (creditsResult.error) throw creditsResult.error;

    const locations = (locationsResult.data || []).map(mapLocation);
    const locationLookup = new Map(locations.map(location => [location.remoteId, { slug: location.id, name: location.name }]));

    return {
      locations,
      reviews: reviewsToMap((reviewsResult.data || []).map(review => mapReview(review, { locations: locationLookup }))),
      credits: (creditsResult.data || []).map(mapCredit)
    };
  }

  async function fetchPublicLeaderboard() {
    const supabase = client();
    if (!supabase) return null;

    const { data, error } = await supabase.rpc('public_leaderboard');
    if (error) throw error;
    return (data || []).map(row => ({
      user: {
        id: row.user_id,
        username: row.username || 'Player',
        email: ''
      },
      active: Number(row.active_credits || 0),
      lifetime: Number(row.lifetime_credits || 0)
    }));
  }

  async function fetchPublicMonthlyDrawings() {
    const supabase = client();
    if (!supabase) return null;

    const { data, error } = await supabase.rpc('public_monthly_drawings');
    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      username: row.username || 'Monthly winner',
      month: row.drawing_month,
      prize: row.prize,
      activeCreditsAtDraw: row.active_credits_at_draw,
      drawnAt: dateOnly(row.drawn_at)
    }));
  }

  async function fetchAdminCollections() {
    const supabase = client();
    if (!supabase) return null;

    const [profilesResult, locationsResult, reviewsResult, reportsResult, editsResult, creditsResult, photosResult] = await Promise.all([
      supabase.from('profiles').select('id,email,username,role,skill_level,bio,avatar_url,created_at'),
      supabase.from('locations').select('id,slug,name'),
      supabase.from('reviews').select('*').order('created_at', { ascending: false }),
      supabase.from('reports').select('*').order('created_at', { ascending: false }),
      supabase.from('suggested_edits').select('*').order('created_at', { ascending: false }),
      supabase.from('credits').select('*').order('created_at', { ascending: false }),
      supabase.from('photos').select('*').order('created_at', { ascending: false })
    ]);

    [profilesResult, locationsResult, reviewsResult, reportsResult, editsResult, creditsResult, photosResult]
      .forEach(result => {
        if (result.error) throw result.error;
      });

    const profiles = new Map((profilesResult.data || []).map(profile => [profile.id, profile]));
    const locations = new Map((locationsResult.data || []).map(location => [location.id, location]));
    const reviews = (reviewsResult.data || []).map(review => mapReview(review, { profiles, locations }));
    const reviewsById = new Map(reviews.map(review => [review.id, review]));

    return {
      reviews: reviewsToMap(reviews),
      reports: (reportsResult.data || []).map(report => mapReport(report, { profiles, locations, reviewsById })),
      suggestedEdits: (editsResult.data || []).map(edit => mapSuggestedEdit(edit, { profiles, locations })),
      credits: (creditsResult.data || []).map(credit => mapCredit(credit, profiles)),
      photos: (photosResult.data || []).map(photo => mapPhoto(photo, { profiles, locations }))
    };
  }

  window.OpenPlaySupabase = {
    isConfigured,
    fetchApprovedLocations,
    fetchAdminLocations,
    updateLocationStatus,
    saveAdminLocation,
    submitLocation,
    submitLocationPhotos,
    submitReview,
    fetchReviewMap,
    fetchOwnReports,
    submitReport,
    submitSuggestedEdit,
    approveSuggestedEdit,
    rejectSuggestedEdit,
    updateReportStatus,
    removeReviewForReport,
    updateAdminReview,
    removeAdminPhoto,
    updatePhotoStatus,
    fetchCurrentUserContributions,
    fetchPublicLeaderboard,
    fetchPublicMonthlyDrawings,
    fetchAdminCollections
  };
})();
