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

  function skillLevel(record) {
    const levels = Array.isArray(record.skill_levels) ? record.skill_levels.filter(Boolean) : [];
    return levels.length ? levels.join(', ') : 'unknown';
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
      isFree: Boolean(record.is_free),
      openPlay: (record.open_play_slots || []).map(slot => ({
        days: Array.isArray(slot.days) && slot.days.length ? slot.days.join(', ') : 'Days TBD',
        hours: slotHours(slot),
        notes: slot.notes || ''
      })),
      estimatedSkillLevel: skillLevel(record),
      courts: {
        count: record.court_count,
        surface: record.surface || 'unknown',
        indoorOutdoor: record.indoor_outdoor || 'unknown'
      },
      photos: [],
      notes: record.notes || '',
      sourceUrl: record.source_url || '',
      lastVerified: record.last_verified || '',
      status: record.status || 'approved'
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

  window.OpenPlaySupabase = {
    isConfigured,
    fetchApprovedLocations
  };
})();
