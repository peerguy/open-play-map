(function () {
  const config = window.OpenPlaySupabaseConfig || {};

  function isConfigured() {
    return Boolean(config.url && config.anonKey);
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

  async function fetchLocationById(supabase, locationId) {
    const { data, error } = await supabase
      .from('locations')
      .select('*,open_play_slots(*)')
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
      photos: [],
      notes: record.notes || '',
      sourceUrl: record.source_url || '',
      lastVerified: record.last_verified || '',
      status: record.status || 'approved',
      createdAt: record.created_at?.slice(0, 10) || '',
      updatedAt: record.updated_at?.slice(0, 10) || '',
      approvedAt: record.approved_at?.slice(0, 10) || ''
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
    const rows = await request('locations?select=*,open_play_slots(*)&status=eq.approved&order=name.asc');
    if (!rows) return null;
    return rows.map(mapLocation);
  }

  async function fetchAdminLocations() {
    const supabase = window.OpenPlaySupabaseClient?.getClient?.();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('locations')
      .select('*,open_play_slots(*)')
      .order('status', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapLocation);
  }

  async function updateLocationStatus(locationId, status, actorId = null) {
    const supabase = window.OpenPlaySupabaseClient?.getClient?.();
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
    const supabase = window.OpenPlaySupabaseClient?.getClient?.();
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

  window.OpenPlaySupabase = {
    isConfigured,
    fetchApprovedLocations,
    fetchAdminLocations,
    updateLocationStatus,
    saveAdminLocation
  };
})();
