const STORAGE_KEY = 'open-play-map-submissions';
const MAP_STYLE_KEY = 'open-play-map-style';
const REVIEWS_KEY = 'open-play-map-reviews';
const CREDITS_KEY = 'open-play-map-credits';
const DELETED_LOCATIONS_KEY = 'open-play-map-deleted-locations';
const REPORTS_KEY = 'open-play-map-reports';
const EDITS_KEY = 'open-play-map-suggested-edits';
const DEFAULT_ICON = 'OP';

const DAILY_LOCATION_LIMIT = 3;
const DAILY_REVIEW_LIMIT = 10;
const MIN_REVIEW_FIELDS = 3;

const CREDIT_VALUES = {
  'add-review': 1,
  'add-photo': 2,
  'add-location': 5
};

const SKILL_LEVELS = {
  beginner: 'Beginner: Under 3.0',
  intermediate: 'Intermediate: 3.0-4.0',
  advanced: 'Advanced: 4.0+'
};

const COMPACT_SKILL_LEVELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced'
};

const LOCATION_SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];

const initialMapZoom = window.matchMedia('(max-width: 760px)').matches ? 3 : 4;
const map = L.map('map', { scrollWheelZoom: true }).setView([39.5, -98.35], initialMapZoom);

const tileStyles = {
  positron: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    }
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }
  }
};

const state = {
  courts: [],
  markers: new Map(),
  markerLayer: L.layerGroup().addTo(map),
  draftMarker: null,
  activeTileLayer: null,
  editingId: null,
  reviewCourtId: null,
  currentUser: null,
  areaSearchActive: false,
  activeInfoCourtId: null,
  suggestingEditId: null,
  openCardMenuId: null,
  reviewMap: null,
  ownReports: null,
  lastTrackedHeaderSearch: '',
  lastTrackedPlaceSearch: '',
  popupCloseTimer: null,
  hoveringPopup: false,
  photoLightbox: {
    element: null,
    image: null,
    caption: null,
    previousButton: null,
    nextButton: null,
    closeButton: null,
    photos: [],
    courtName: '',
    index: 0,
    trigger: null
  }
};

const elements = {
  siteHeader: document.querySelector('.site-header'),
  search: document.querySelector('#search'),
  filterToggle: document.querySelector('#filterToggle'),
  filterPanel: document.querySelector('#filterPanel'),
  filterCount: document.querySelector('#filterCount'),
  resetFilters: document.querySelector('#resetFilters'),
  accessFilter: document.querySelector('#accessFilter'),
  skillFilter: document.querySelector('#skillFilter'),
  dayFilter: document.querySelector('#dayFilter'),
  timeFilter: document.querySelector('#timeFilter'),
  settingFilter: document.querySelector('#settingFilter'),
  reliabilityFilter: document.querySelector('#reliabilityFilter'),
  mapStyle: document.querySelector('#mapStyle'),
  mapInfoBox: document.querySelector('#mapInfoBox'),
  resultCount: document.querySelector('#resultCount'),
  courtList: document.querySelector('#courtList'),
  mobileSheetHandle: document.querySelector('.mobile-sheet-handle'),
  mobileResultsBar: document.querySelector('.mobile-results-bar'),
  submitDialog: document.querySelector('#submitDialog'),
  locationForm: document.querySelector('#locationForm'),
  submitEyebrow: document.querySelector('#submitDialog .form-header .eyebrow'),
  submitTitle: document.querySelector('#submitDialog .form-header h2'),
  submitButton: document.querySelector('#submitDialog .form-actions .primary-button'),
  formHint: document.querySelector('#formHint'),
  suggestEditNote: document.querySelector('#suggestEditNote'),
  suggestEditReason: document.querySelector('#suggestEditReason'),
  newName: document.querySelector('#newName'),
  newAddress: document.querySelector('#newAddress'),
  newCity: document.querySelector('#newCity'),
  newState: document.querySelector('#newState'),
  newLat: document.querySelector('#newLat'),
  newLng: document.querySelector('#newLng'),
  newAccess: document.querySelector('#newAccess'),
  openPlayFeeField: document.querySelector('#openPlayFeeField'),
  newOpenPlayFee: document.querySelector('#newOpenPlayFee'),
  newCourtCount: document.querySelector('#newCourtCount'),
  newSkill: document.querySelector('#newSkill'),
  newDays: document.querySelector('#newDays'),
  newDaysSummary: document.querySelector('#newDaysSummary'),
  openDayAll: document.querySelector('#openDayAll'),
  newTimeWindows: document.querySelector('#newTimeWindows'),
  addTimeWindow: document.querySelector('#addTimeWindow'),
  newNotes: document.querySelector('#newNotes'),
  newPhotos: document.querySelector('#newPhotos'),
  placeSearch: document.querySelector('#placeSearch'),
  placeSearchButton: document.querySelector('#placeSearchButton'),
  placeResults: document.querySelector('#placeResults'),
  headerPlaceResults: document.querySelector('#headerPlaceResults'),
  userPanel: document.querySelector('#userPanel'),
  reviewDialog: document.querySelector('#reviewDialog'),
  reviewForm: document.querySelector('#reviewForm'),
  reviewTitle: document.querySelector('#reviewTitle'),
  reviewRequirement: document.querySelector('#reviewRequirement'),
  reviewVisited: document.querySelector('#reviewVisited'),
  reviewSkill: document.querySelector('#reviewSkill'),
  reviewCrowd: document.querySelector('#reviewCrowd'),
  reviewBestTime: document.querySelector('#reviewBestTime'),
  reviewReliability: document.querySelector('#reviewReliability'),
  reviewNetSetup: document.querySelector('#reviewNetSetup'),
  reviewPlayFormat: document.querySelector('#reviewPlayFormat'),
  reviewBeginnerFriendly: document.querySelector('#reviewBeginnerFriendly'),
  reviewFees: document.querySelector('#reviewFees'),
  reviewAmenities: document.querySelector('#reviewAmenities'),
  reviewLighting: document.querySelector('#reviewLighting'),
  reviewSchedulingApp: document.querySelector('#reviewSchedulingApp'),
  reviewBody: document.querySelector('#reviewBody'),
  reviewPhotos: document.querySelector('#reviewPhotos'),
  reviewHint: document.querySelector('#reviewHint')
};

function trackAnalyticsEvent(name, properties = {}) {
  window.OpenPlayAnalytics?.track(name, properties);
}

function trackLocationView(court, source) {
  trackAnalyticsEvent('location_view', {
    location_id: court.id,
    location_name: court.name,
    city: court.city,
    state: court.state,
    source
  });
}

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function setMapStyle(styleName) {
  const style = tileStyles[styleName] || tileStyles.positron;
  if (state.activeTileLayer) {
    state.activeTileLayer.remove();
  }
  state.activeTileLayer = L.tileLayer(style.url, style.options).addTo(map);
  localStorage.setItem(MAP_STYLE_KEY, tileStyles[styleName] ? styleName : 'positron');
}

function slugify(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `location-${Date.now()}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function closeCardMenus() {
  document.querySelectorAll('.court-card.is-menu-open').forEach(card => {
    card.classList.remove('is-menu-open');
    card.querySelector('[data-card-menu-toggle]')?.setAttribute('aria-expanded', 'false');
    const menu = card.querySelector('[data-card-menu]');
    if (menu) menu.hidden = true;
  });
  state.openCardMenuId = null;
}

function closeLocationMenus() {
  document.querySelectorAll('[data-location-menu-wrapper].is-menu-open').forEach(wrapper => {
    wrapper.classList.remove('is-menu-open');
    wrapper.querySelector('[data-location-menu-toggle]')?.setAttribute('aria-expanded', 'false');
    const menu = wrapper.querySelector('[data-location-menu]');
    if (menu) menu.hidden = true;
  });
}

function bindLocationMenu(container) {
  const wrapper = container.querySelector('[data-location-menu-wrapper]');
  const toggle = wrapper?.querySelector('[data-location-menu-toggle]');
  const menu = wrapper?.querySelector('[data-location-menu]');
  if (!wrapper || !toggle || !menu) return;

  toggle.addEventListener('click', event => {
    event.stopPropagation();
    const isOpen = wrapper.classList.contains('is-menu-open');
    closeLocationMenus();
    if (isOpen) return;
    wrapper.classList.add('is-menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
  });

  wrapper.addEventListener('click', event => {
    event.stopPropagation();
  });
}

function locationShareUrl(court) {
  const url = new URL(window.location.href);
  url.hash = '';
  url.searchParams.set('location', court.id);
  return url.toString();
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard copy failed');
}

function selectedPhotoFiles(input) {
  return Array.from(input?.files || []);
}

function photoUrl(photo) {
  if (typeof photo === 'string') return photo.trim();
  return String(photo?.url || photo?.storagePath || photo?.storage_path || '').trim();
}

function photoReviewId(photo) {
  return String(photo?.reviewId || photo?.review_id || '').trim();
}

function formatPhotoDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  return text;
}

function reviewMatchesPhoto(review, photo) {
  const reviewId = photoReviewId(photo);
  return Boolean(reviewId && [review?.remoteId, review?.id].filter(Boolean).map(String).includes(reviewId));
}

function reviewForPhoto(court, photo) {
  return getCourtReviews(court?.id).find(review => reviewMatchesPhoto(review, photo)) || null;
}

function photoSubmittedBy(photo, court, review = null) {
  if (photo?.username) return photo.username;
  if (review?.username) return review.username;
  if (photo?.uploadedBy && photo.uploadedBy === court?.submittedBy && court?.submittedByUsername) return court.submittedByUsername;
  return court?.submittedByUsername || 'Player';
}

function courtPhotoList(court) {
  return (court?.photos || [])
    .map((photo, index) => {
      const url = photoUrl(photo);
      if (!url) return null;
      const source = typeof photo === 'object' ? photo : {};
      const review = reviewForPhoto(court, source);
      const submittedBy = photoSubmittedBy(source, court, review);
      const submittedAt = formatPhotoDateTime(source.createdAtTimestamp || source.created_at || source.createdAt || '');
      return {
        ...source,
        id: source.id || source.remoteId || url,
        url,
        reviewId: photoReviewId(source),
        username: submittedBy,
        createdAt: source.createdAt || '',
        createdAtTimestamp: source.createdAtTimestamp || source.created_at || '',
        submittedText: submittedAt ? `submitted by ${submittedBy} at ${submittedAt}` : `submitted by ${submittedBy}`,
        globalIndex: index
      };
    })
    .filter(Boolean);
}

function ensurePhotoLightbox() {
  if (state.photoLightbox.element) return state.photoLightbox.element;

  const lightbox = document.createElement('div');
  lightbox.className = 'photo-lightbox';
  lightbox.hidden = true;
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Photo viewer');
  lightbox.innerHTML = `
    <div class="photo-lightbox-panel">
      <button class="photo-lightbox-close" type="button" aria-label="Close photo viewer">&times;</button>
      <button class="photo-lightbox-nav photo-lightbox-prev" type="button" aria-label="Previous photo">&#8249;</button>
      <figure class="photo-lightbox-frame">
        <div class="photo-lightbox-image-wrap">
          <img class="photo-lightbox-image" alt="" />
        </div>
        <figcaption class="photo-lightbox-caption" aria-live="polite"></figcaption>
      </figure>
      <button class="photo-lightbox-nav photo-lightbox-next" type="button" aria-label="Next photo">&#8250;</button>
    </div>
  `;

  state.photoLightbox.element = lightbox;
  state.photoLightbox.image = lightbox.querySelector('.photo-lightbox-image');
  state.photoLightbox.caption = lightbox.querySelector('.photo-lightbox-caption');
  state.photoLightbox.previousButton = lightbox.querySelector('.photo-lightbox-prev');
  state.photoLightbox.nextButton = lightbox.querySelector('.photo-lightbox-next');
  state.photoLightbox.closeButton = lightbox.querySelector('.photo-lightbox-close');

  state.photoLightbox.closeButton.addEventListener('click', closePhotoLightbox);
  state.photoLightbox.previousButton.addEventListener('click', () => stepPhotoLightbox(-1));
  state.photoLightbox.nextButton.addEventListener('click', () => stepPhotoLightbox(1));
  lightbox.addEventListener('click', event => {
    if (event.target === lightbox) closePhotoLightbox();
  });

  document.body.append(lightbox);
  return lightbox;
}

function updatePhotoLightbox() {
  const { photos, index, courtName, image, caption, previousButton, nextButton } = state.photoLightbox;
  if (!photos.length || !image || !caption) return;

  const photo = photos[index];
  const counter = `${index + 1} of ${photos.length}`;
  image.src = photo.url;
  image.alt = `${courtName} photo ${index + 1}`;
  caption.textContent = `${courtName} · ${counter} · ${photo.submittedText}`;

  const hasMultiplePhotos = photos.length > 1;
  previousButton.hidden = !hasMultiplePhotos;
  nextButton.hidden = !hasMultiplePhotos;
}

function openPhotoLightbox(courtId, index = 0, trigger = null) {
  const court = state.courts.find(item => item.id === courtId);
  const photos = courtPhotoList(court);
  if (!court || !photos.length) return;

  const lightbox = ensurePhotoLightbox();
  const nextIndex = Math.max(0, Math.min(Number(index) || 0, photos.length - 1));
  state.photoLightbox.photos = photos;
  state.photoLightbox.courtName = court.name || 'Location';
  state.photoLightbox.index = nextIndex;
  state.photoLightbox.trigger = trigger;
  lightbox.hidden = false;
  document.body.classList.add('has-photo-lightbox');
  closeCardMenus();
  closeLocationMenus();
  updatePhotoLightbox();
  requestAnimationFrame(() => state.photoLightbox.closeButton?.focus());
}

function closePhotoLightbox() {
  const { element, image, trigger } = state.photoLightbox;
  if (!element || element.hidden) return;
  element.hidden = true;
  document.body.classList.remove('has-photo-lightbox');
  if (image) image.removeAttribute('src');
  state.photoLightbox.photos = [];
  state.photoLightbox.courtName = '';
  state.photoLightbox.index = 0;
  state.photoLightbox.trigger = null;
  trigger?.focus?.();
}

function stepPhotoLightbox(delta) {
  const { photos } = state.photoLightbox;
  if (photos.length <= 1) return;
  state.photoLightbox.index = (state.photoLightbox.index + delta + photos.length) % photos.length;
  updatePhotoLightbox();
}

function bindPhotoLightboxButtons(container) {
  container.querySelectorAll('[data-photo-lightbox-index]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openPhotoLightbox(button.dataset.photoCourtId, Number(button.dataset.photoLightboxIndex), button);
    });
  });
}

async function shareLocation(court) {
  try {
    await copyTextToClipboard(locationShareUrl(court));
    window.alert('Share link copied.');
  } catch (error) {
    console.error(error);
    window.prompt('Copy this location link:', locationShareUrl(court));
  }
}

function getSavedReviews() {
  if (state.reviewMap) return state.reviewMap;
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveReviews(reviews) {
  if (state.reviewMap) {
    state.reviewMap = reviews;
  }
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
}

function getSavedReports() {
  if (Array.isArray(state.ownReports)) return state.ownReports;
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveReports(reports) {
  if (Array.isArray(state.ownReports)) {
    state.ownReports = reports;
  }
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

function getSavedSuggestedEdits() {
  try {
    return JSON.parse(localStorage.getItem(EDITS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSuggestedEdits(edits) {
  localStorage.setItem(EDITS_KEY, JSON.stringify(edits));
}

function savedSubmissionCountForToday(userId) {
  return getSavedSubmissions()
    .filter(court => court.submittedBy === userId && court.createdAt === todayIso())
    .length;
}

function savedReviewCountForToday(userId) {
  return Object.values(getSavedReviews())
    .flat()
    .filter(review => review.userId === userId && (review.createdAt === todayIso() || review.updatedAt === todayIso()))
    .length;
}

function reportExists({ targetType, targetId, reviewId = '' }) {
  if (!state.currentUser) return false;
  return getSavedReports().some(report => (
    report.userId === state.currentUser.id
    && report.targetType === targetType
    && report.targetId === targetId
    && (report.reviewId || '') === reviewId
  ));
}

function saveReport({ targetType, targetId, targetName, reviewId = '', reason }) {
  if (!state.currentUser) return false;
  const reports = getSavedReports();
  if (reportExists({ targetType, targetId, reviewId })) return false;
  reports.push({
    id: `report-${Date.now()}-${reports.length}`,
    targetType,
    targetId,
    targetName,
    reviewId,
    reason,
    userId: state.currentUser.id,
    username: state.currentUser.username,
    createdAt: todayIso(),
    status: 'open'
  });
  saveReports(reports);
  return true;
}

function getSavedCredits() {
  try {
    return JSON.parse(localStorage.getItem(CREDITS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveCredits(credits) {
  localStorage.setItem(CREDITS_KEY, JSON.stringify(credits));
}

function awardCredits({ action, targetType, targetId, status = 'approved' }) {
  if (!state.currentUser || !CREDIT_VALUES[action]) return;
  const creditValue = CREDIT_VALUES[action];
  const credits = getSavedCredits();
  credits.push({
    id: `credit-${Date.now()}-${credits.length}`,
    userId: state.currentUser.id,
    username: state.currentUser.username,
    action,
    targetType,
    targetId,
    activeCreditsDelta: creditValue,
    lifetimeCreditsDelta: creditValue,
    createdAt: todayIso(),
    month: todayIso().slice(0, 7),
    status
  });
  saveCredits(credits);
}

function normalizeSkillLevel(value, fallback = '') {
  return Object.hasOwn(SKILL_LEVELS, value) ? value : fallback;
}

function skillLevelLabel(value) {
  return SKILL_LEVELS[normalizeSkillLevel(value)] || '';
}

function compactSkillLevelLabel(value) {
  const normalized = normalizeSkillLevel(value, '');
  return COMPACT_SKILL_LEVELS[normalized] || value || '';
}

function formatLocationSkillLevel(skills) {
  const selected = skills.filter(skill => LOCATION_SKILL_LEVELS.includes(skill));
  return selected.length ? selected.join(', ') : 'unknown';
}

function normalizeOpenPlayFee(value) {
  if (value === '' || value === null || value === undefined) return null;
  const fee = Number(value);
  if (!Number.isFinite(fee) || fee <= 0) return null;
  return Math.round(fee * 100) / 100;
}

function formatOpenPlayFee(value) {
  const fee = normalizeOpenPlayFee(value);
  if (fee === null) return '';
  return `$${Number.isInteger(fee) ? fee : fee.toFixed(2)}`;
}

function openPlayFeeLabel(court = {}) {
  return formatOpenPlayFee(court.openPlayFee);
}

function accessLabel(court = {}) {
  const feeLabel = openPlayFeeLabel(court);
  if (feeLabel) return `Public fee (${feeLabel})`;
  if (court.isFree === false || court.access === 'paid') return 'Paid/public fee';
  return 'Free/public';
}

function updateOpenPlayFeeField() {
  if (!elements.openPlayFeeField || !elements.newOpenPlayFee || !elements.newAccess) return;
  const requiresFee = elements.newAccess.value === 'paid';
  elements.newOpenPlayFee.disabled = !requiresFee;
  elements.newOpenPlayFee.required = requiresFee;
  if (!requiresFee) elements.newOpenPlayFee.value = '';
}

function selectedLocationSkills() {
  return [...elements.newSkill.querySelectorAll('input[name="skillLevel"]:checked')]
    .map(input => input.value);
}

function selectedReviewSkills() {
  return [...elements.reviewSkill.querySelectorAll('input[name="reviewSkillLevel"]:checked')]
    .map(input => input.value);
}

function setSelectedLocationSkills(value) {
  const selected = new Set(Array.isArray(value)
    ? value
    : LOCATION_SKILL_LEVELS.filter(skill => normalize(value).includes(skill)));
  elements.newSkill.querySelectorAll('input[name="skillLevel"]').forEach(input => {
    input.checked = selected.has(input.value);
  });
}

function setSelectedReviewSkills(value) {
  const selected = new Set(Array.isArray(value)
    ? value
    : LOCATION_SKILL_LEVELS.filter(skill => normalize(value).includes(skill)));
  elements.reviewSkill.querySelectorAll('input[name="reviewSkillLevel"]').forEach(input => {
    input.checked = selected.has(input.value);
  });
}

function selectedOpenPlayDays() {
  return [...elements.newDays.querySelectorAll('input[name="openDay"]:checked')]
    .map(input => input.value);
}

function updateOpenPlayDaysSummary() {
  const days = selectedOpenPlayDays();
  if (elements.openDayAll) {
    elements.openDayAll.checked = days.length === elements.newDays.querySelectorAll('input[name="openDay"]').length;
  }
  elements.newDaysSummary.textContent = days.length ? days.join(', ') : 'Select days';
}

function setSelectedOpenPlayDays(value = '') {
  const normalizedValue = normalize(value);
  const expandedValue = normalizedValue.includes('daily')
    ? 'monday tuesday wednesday thursday friday saturday sunday'
    : normalizedValue.includes('weekdays')
      ? 'monday tuesday wednesday thursday friday'
      : normalizedValue.includes('weekends')
        ? 'saturday sunday'
        : normalizedValue;
  const selected = new Set();
  elements.newDays.querySelectorAll('input[name="openDay"]').forEach(input => {
    const isSelected = expandedValue.includes(normalize(input.value));
    input.checked = isSelected;
    if (isSelected) selected.add(input.value);
  });
  updateOpenPlayDaysSummary();
}

function formatTimeOption(minutes) {
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

function timeSelectOptions(selected = '') {
  const options = ['<option value="">Select time</option>'];
  for (let offset = 0; offset < 24 * 60; offset += 30) {
    const minutes = (6 * 60 + offset) % (24 * 60);
    const label = formatTimeOption(minutes);
    options.push(`<option value="${label}"${selected === label ? ' selected' : ''}>${label}</option>`);
  }
  return options.join('');
}

function addTimeWindow(slot = {}) {
  const row = document.createElement('div');
  row.className = 'time-window-row';
  row.innerHTML = `
    <label>Start
      <select data-time-start size="6">${timeSelectOptions(slot.start || '')}</select>
    </label>
    <label>End
      <select data-time-end size="6">${timeSelectOptions(slot.end || '')}</select>
    </label>
    <button class="icon-button time-window-remove" type="button" aria-label="Remove time window">×</button>
  `;
  row.querySelector('.time-window-remove').addEventListener('click', () => {
    if (elements.newTimeWindows.children.length > 1) {
      row.remove();
    } else {
      row.querySelector('[data-time-start]').value = '';
      row.querySelector('[data-time-end]').value = '';
    }
  });
  elements.newTimeWindows.append(row);
}

function resetTimeWindows(slots = [{}]) {
  elements.newTimeWindows.replaceChildren();
  const nextSlots = slots.length ? slots : [{}];
  nextSlots.forEach(slot => addTimeWindow(slot));
}

function parseOpenPlayHours(hours = '') {
  const [start = '', end = ''] = String(hours).split(/[–-]/).map(value => value.trim());
  return { start, end };
}

function getOpenPlaySlots() {
  const days = selectedOpenPlayDays().join(', ') || 'Days TBD';
  const slots = [...elements.newTimeWindows.querySelectorAll('.time-window-row')]
    .map(row => ({
      start: row.querySelector('[data-time-start]').value,
      end: row.querySelector('[data-time-end]').value
    }))
    .filter(slot => slot.start && slot.end)
    .map(slot => ({
      days,
      hours: `${slot.start}–${slot.end}`,
      startTime: slot.start,
      endTime: slot.end,
      notes: 'User-submitted open play info; verify before going.'
    }));

  return slots.length ? slots : [{
    days,
    hours: 'Hours TBD',
    startTime: '',
    endTime: '',
    notes: 'User-submitted open play info; verify before going.'
  }];
}

function editableLocationSnapshot(court = {}) {
  return {
    name: court.name || '',
    address: court.address || '',
    city: court.city || '',
    state: court.state || '',
    latitude: Number.isFinite(Number(court.latitude)) ? Number(court.latitude) : '',
    longitude: Number.isFinite(Number(court.longitude)) ? Number(court.longitude) : '',
    access: court.access || (court.isFree === false ? 'paid' : 'public'),
    openPlayFee: normalizeOpenPlayFee(court.openPlayFee) ?? '',
    courtCount: court.courts?.count ?? '',
    skillLevels: [...(Array.isArray(court.skillLevels) ? court.skillLevels : selectedSkillsFromText(court.estimatedSkillLevel))].sort(),
    openPlay: (court.openPlay || []).map(slot => ({
      days: slot.days || '',
      hours: slot.hours || '',
      startTime: slot.startTime || '',
      endTime: slot.endTime || ''
    })),
    notes: court.notes || '',
    photos: (court.photos || []).map(photoUrl).filter(Boolean)
  };
}

function selectedSkillsFromText(value = '') {
  const normalized = normalize(value);
  return LOCATION_SKILL_LEVELS.filter(skill => normalized.includes(skill));
}

function hasEditableLocationChanges(current, suggested) {
  return JSON.stringify(editableLocationSnapshot(current)) !== JSON.stringify(editableLocationSnapshot(suggested));
}

function plainClone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function saveSuggestedLocationEdit(currentLocation, suggestedLocation, reason) {
  if (currentLocation.remoteId && window.OpenPlaySupabase?.submitSuggestedEdit) {
    return await window.OpenPlaySupabase.submitSuggestedEdit(currentLocation, suggestedLocation, reason, state.currentUser);
  }

  const edits = getSavedSuggestedEdits();
  edits.push({
    id: `suggested-edit-${Date.now()}-${edits.length}`,
    locationId: currentLocation.id,
    locationName: currentLocation.name,
    currentLocation: plainClone(currentLocation),
    suggestedLocation: plainClone(suggestedLocation),
    reason,
    userId: state.currentUser.id,
    username: state.currentUser.username,
    createdAt: todayIso(),
    status: 'pending'
  });
  saveSuggestedEdits(edits);
  return null;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    photo: user.photo || '',
    skillLevel: normalizeSkillLevel(user.skillLevel, ''),
    bio: user.bio || ''
  };
}

function isAdminUser(user) {
  return user?.role === 'admin';
}

function canEditLocations() {
  return isAdminUser(state.currentUser);
}

async function loadCurrentUser() {
  state.currentUser = await window.OpenPlayAuth?.currentUser?.() || null;
}

async function loadBackendCollections() {
  try {
    state.reviewMap = await window.OpenPlaySupabase?.fetchReviewMap?.() || null;
  } catch (error) {
    console.warn('Supabase review load failed. Falling back to local reviews.', error);
    state.reviewMap = null;
  }

  if (!state.currentUser) {
    state.ownReports = [];
    return;
  }

  try {
    state.ownReports = await window.OpenPlaySupabase?.fetchOwnReports?.() || [];
  } catch (error) {
    console.warn('Supabase report load failed. Falling back to local reports.', error);
    state.ownReports = null;
  }
}

function setCurrentUser(user) {
  state.currentUser = user;
  renderUserPanel();
  render();
  window.openPlayRenderMobileHeader?.();
  window.dispatchEvent(new CustomEvent('open-play-session-changed'));
}

function getCourtReviews(courtId) {
  const seenUserIds = new Set();
  return (getSavedReviews()[courtId] || []).filter(review => {
    if (!review.userId) return true;
    if (seenUserIds.has(review.userId)) return false;
    seenUserIds.add(review.userId);
    return true;
  });
}

function getCurrentUserReview(courtId) {
  if (!state.currentUser) return null;
  return (getSavedReviews()[courtId] || []).find(review => review.userId === state.currentUser.id) || null;
}

function userAvatar(user) {
  if (user?.photo) {
    return `<img src="${user.photo}" alt="" />`;
  }
  return `<span>${escapeHtml((user?.username || '?').slice(0, 2).toUpperCase())}</span>`;
}

function renderUserPanel() {
  if (!state.currentUser) {
    elements.userPanel.innerHTML = '<a class="secondary-button auth-open-button" href="account.html">Sign in / Join</a>';
  } else {
    elements.userPanel.innerHTML = `
      <div class="active-user">
        <a class="header-profile-link" href="account.html">
          <div class="user-avatar" aria-hidden="true">${userAvatar(state.currentUser)}</div>
          <strong>${escapeHtml(state.currentUser.username)}</strong>
        </a>
        <button class="logout-text-button" type="button" data-logout>Logout</button>
      </div>
    `;
  }

  elements.userPanel.querySelector('[data-logout]')?.addEventListener('click', async () => {
    try {
      await window.OpenPlayAuth?.signOut?.();
      setCurrentUser(null);
    } catch (error) {
      console.error(error);
    }
  });
  window.openPlayRenderMobileHeader?.();
}

function requireCurrentUser(message) {
  if (state.currentUser) return true;
  const target = new URL('account.html', location.href);
  target.searchParams.set('return', 'index.html');
  if (message) target.searchParams.set('notice', message);
  location.href = target.toString();
  return false;
}

function openDialog(dialog) {
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function closeDialog(dialog) {
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

function resetDialogScroll(dialog, form, { focusCloseButton = false } = {}) {
  const reset = () => {
    dialog.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    dialog.scrollTop = 0;
    dialog.scrollLeft = 0;
    form?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    if (form) {
      form.scrollTop = 0;
      form.scrollLeft = 0;
    }

    if (focusCloseButton && isMobileLayout()) {
      const activeElement = document.activeElement;
      if (activeElement?.matches?.('input, textarea, select')) {
        activeElement.blur();
      }
      form?.querySelector?.('[data-close-review], [data-close-submit]')?.focus({ preventScroll: true });
    }
  };

  reset();
  requestAnimationFrame(reset);
  setTimeout(reset, 80);
}

function getSavedSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function getDeletedLocationIds() {
  try {
    return JSON.parse(localStorage.getItem(DELETED_LOCATIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSubmissions(submissions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
}

function upsertSavedLocation(court) {
  const submissions = getSavedSubmissions();
  const index = submissions.findIndex(item => item.id === court.id);
  if (index >= 0) {
    submissions[index] = court;
  } else {
    submissions.push(court);
  }
  saveSubmissions(submissions);
}

function mergeSavedLocations(seedCourts, savedCourts) {
  const deletedIds = new Set(getDeletedLocationIds());
  const savedById = new Map(savedCourts.map(court => [court.id, court]));
  const seedIds = new Set(seedCourts.map(court => court.id));
  const approvedSavedCourts = savedCourts.filter(court => (court.status || 'approved') === 'approved');
  return [
    ...seedCourts
      .filter(court => !deletedIds.has(court.id))
      .map(court => savedById.get(court.id) || court),
    ...approvedSavedCourts.filter(court => !seedIds.has(court.id) && !deletedIds.has(court.id))
  ];
}

function createLocationIcon(court) {
  const feeLabel = openPlayFeeLabel(court);
  const isFeeMarker = Boolean(feeLabel);
  const feeSizeClass = isFeeMarker && feeLabel.length >= 6
    ? ' fee-marker-long'
    : isFeeMarker && feeLabel.length >= 4
      ? ' fee-marker-wide'
      : '';
  return L.divIcon({
    className: `location-marker op-marker${isFeeMarker ? ' fee-marker' : ''}${feeSizeClass}`,
    html: `<span><b>${feeLabel || DEFAULT_ICON}</b></span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 36],
    popupAnchor: [0, -32]
  });
}

function courtSearchText(court) {
  return normalize([
    court.name,
    court.address,
    court.city,
    court.state,
    court.access,
    openPlayFeeLabel(court),
    court.estimatedSkillLevel,
    court.notes,
    court.openPlay?.map(slot => `${slot.days} ${slot.hours} ${slot.notes}`).join(' ')
  ].join(' '));
}

const FILTER_DEFAULTS = {
  accessFilter: 'all',
  skillFilter: 'all',
  dayFilter: 'all',
  timeFilter: 'all',
  settingFilter: 'all',
  reliabilityFilter: 'all'
};

function selectedFilterValues() {
  return Object.fromEntries(Object.keys(FILTER_DEFAULTS).map(key => [key, elements[key].value]));
}

function activeFilterCount() {
  return Object.entries(selectedFilterValues())
    .filter(([key, value]) => value !== FILTER_DEFAULTS[key])
    .length;
}

function updateFilterCount() {
  const count = activeFilterCount();
  elements.filterCount.textContent = String(count);
  elements.filterCount.hidden = count === 0;
}

function resetFilters() {
  Object.entries(FILTER_DEFAULTS).forEach(([key, value]) => {
    elements[key].value = value;
  });
  render();
}

function matchesDayFilter(court, value) {
  if (value === 'all') return true;
  const courtDays = getOpenPlayDays(court);
  return courtDays.has(value);
}

function parseTimeToMinutes(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const period = match[3]?.toLowerCase();
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 24 || minute > 59) return null;
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function parseHourWindow(hours) {
  const parts = String(hours || '')
    .replace(/[–—]/g, '-')
    .split(/\s+-\s+|\s+to\s+|-/i)
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const endPeriod = parts[1].match(/\b(am|pm)\b/i)?.[1] || '';
  const startText = /\b(am|pm)\b/i.test(parts[0]) || !endPeriod ? parts[0] : `${parts[0]} ${endPeriod}`;
  const start = parseTimeToMinutes(startText);
  let end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function windowsOverlap(first, second) {
  return first.start < second.end && first.end > second.start;
}

function matchesTimeFilter(court, value) {
  if (value === 'all') return true;
  const buckets = {
    morning: { start: 5 * 60, end: 12 * 60 },
    afternoon: { start: 12 * 60, end: 17 * 60 },
    evening: { start: 17 * 60, end: 24 * 60 }
  };
  const bucket = buckets[value];
  if (!bucket) return true;
  return (court.openPlay || []).some(slot => {
    const window = parseHourWindow(slot.hours);
    return window && windowsOverlap(window, bucket);
  });
}

function matchesSettingFilter(court, value) {
  if (value === 'all') return true;
  const setting = normalize(court.courts?.indoorOutdoor);
  if (value === 'both') return setting.includes('both');
  return setting.includes(value) || setting.includes('both');
}

function latestReliability(court) {
  const reviews = getCourtReviews(court.id)
    .filter(review => review.openPlayReliability)
    .sort((a, b) => String(b.updatedAt || b.createdAt || b.visited || '').localeCompare(String(a.updatedAt || a.createdAt || a.visited || '')));
  if (reviews[0]) return normalize(reviews[0].openPlayReliability);
  if (court.lastVerified && court.openPlay?.length) return 'confirmed';
  return '';
}

function matchesReliabilityFilter(court, value) {
  if (value === 'all') return true;
  const reliability = latestReliability(court);
  if (value === 'sometimes') return reliability.includes('sometimes');
  return reliability.includes(value);
}

function matchesControls(court) {
  const query = normalize(elements.search.value).trim();
  const filters = selectedFilterValues();

  const matchesQuery = state.areaSearchActive || !query || courtSearchText(court).includes(query);
  const matchesAccess = filters.accessFilter === 'all' || (filters.accessFilter === 'free' ? court.isFree : !court.isFree);
  const matchesSkill = filters.skillFilter === 'all' || normalize(court.estimatedSkillLevel).includes(filters.skillFilter);

  return matchesQuery
    && matchesAccess
    && matchesSkill
    && matchesDayFilter(court, filters.dayFilter)
    && matchesTimeFilter(court, filters.timeFilter)
    && matchesSettingFilter(court, filters.settingFilter)
    && matchesReliabilityFilter(court, filters.reliabilityFilter);
}

function isCourtInMapView(court) {
  return typeof court.latitude === 'number'
    && typeof court.longitude === 'number'
    && map.getBounds().contains([court.latitude, court.longitude]);
}

function formatOpenPlay(court) {
  if (!court.openPlay?.length) return 'Open play: TBD';
  return court.openPlay
    .map(slot => `${slot.days || 'Days TBD'}: ${slot.hours || 'Hours TBD'}${slot.notes ? ` — ${slot.notes}` : ''}`)
    .join('<br>');
}

function selectedOpenPlayDaySet(court) {
  const selected = new Set();
  const daysText = normalize((court.openPlay || []).map(slot => slot.days).join(' '));
  const dayMap = [
    ['monday', 'mon'],
    ['tuesday', 'tue'],
    ['wednesday', 'wed'],
    ['thursday', 'thu'],
    ['friday', 'fri'],
    ['saturday', 'sat'],
    ['sunday', 'sun']
  ];

  if (daysText.includes('daily') || daysText.includes('all days')) {
    dayMap.forEach(([name]) => selected.add(name));
    return selected;
  }

  if (daysText.includes('weekdays')) {
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(day => selected.add(day));
  }

  if (daysText.includes('weekends')) {
    ['saturday', 'sunday'].forEach(day => selected.add(day));
  }

  dayMap.forEach(([name, abbreviation]) => {
    const abbreviationPattern = new RegExp(`\\b${abbreviation}\\b`);
    if (daysText.includes(name) || abbreviationPattern.test(daysText)) selected.add(name);
  });

  return selected;
}

function renderOpenPlaySummary(court, options = {}) {
  const selected = selectedOpenPlayDaySet(court);
  const hourWindows = [...new Set((court.openPlay || [])
    .map(slot => slot.hours || 'Hours TBD')
    .filter(Boolean))];
  const days = [
    ['monday', 'M', 'Monday'],
    ['tuesday', 'T', 'Tuesday'],
    ['wednesday', 'W', 'Wednesday'],
    ['thursday', 'T', 'Thursday'],
    ['friday', 'F', 'Friday'],
    ['saturday', 'S', 'Saturday'],
    ['sunday', 'S', 'Sunday']
  ];

  return `
    <div class="open-play-summary" aria-label="Open play days">
      <div class="day-chip-row">
        ${days.map(([key, label, fullName]) => `
          <span class="day-chip${selected.has(key) ? ' is-active' : ''}" title="${fullName}" aria-label="${fullName}: ${selected.has(key) ? 'open play available' : 'not selected'}">${label}</span>
        `).join('')}
      </div>
      <div class="open-play-hours-row">
        <div class="open-play-hours-list">
          ${(hourWindows.length ? hourWindows : ['Hours TBD']).map(hours => `<span class="open-play-hours">${escapeHtml(hours)}</span>`).join('')}
        </div>
        ${options.actionsHtml ? `<div class="open-play-inline-actions">${options.actionsHtml}</div>` : ''}
      </div>
    </div>
  `;
}

function courtCountLabel(court) {
  const count = Number(court.courts?.count);
  if (!Number.isFinite(count)) return '';
  return `${count} court${count === 1 ? '' : 's'}`;
}

function submitterLabel(court) {
  if (court.submittedByUsername) return `Submitted by ${escapeHtml(court.submittedByUsername)}`;
  if (court.userSubmitted) return 'Community submitted';
  return '';
}

function reviewDetailItems(review) {
  const reviewedSkill = review.skillLevels?.length
    ? review.skillLevels.map(skill => compactSkillLevelLabel(skill) || skill).join(', ')
    : review.skill && review.skill !== 'unknown'
      ? compactSkillLevelLabel(review.skill) || review.skill
      : '';
  const details = [
    ['Crowd', review.crowdLevel],
    ['Open play skill', reviewedSkill],
    ['Best time', review.bestTime],
    ['Reliability', review.openPlayReliability],
    ['Nets', review.netSetup],
    ['Format', review.playFormat],
    ['Beginner friendly', review.beginnerFriendliness],
    ['Fees', review.fees],
    ['Bathroom / water', review.amenities],
    ['Lighting', review.lighting],
    ['Scheduling app', review.schedulingApp]
  ].filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');

  if (!details.length) return '';

  return `
    <dl class="review-detail-grid">
      ${details.map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}

function renderReviewList(court, limit = 2) {
  const reviews = getCourtReviews(court.id);
  if (!reviews.length) return '<p class="review-empty">No player reviews yet.</p>';

  return reviews.slice(0, limit).map(review => `
    <article class="review-item" data-review-id="${escapeHtml(review.id || '')}">
      <div class="review-meta">
        <span class="review-author">
          <strong>${escapeHtml(review.username || 'Player')}</strong>
          ${review.skillLevel ? `<small>${escapeHtml(compactSkillLevelLabel(review.skillLevel))}</small>` : ''}
        </span>
        <span>${escapeHtml(review.visited || review.createdAt)}</span>
      </div>
      <div class="community-update-label">
        <span>Community review</span>
        ${review.updatedAt ? `<span>Review edited ${escapeHtml(review.updatedAt)}</span>` : ''}
      </div>
      ${review.body ? `<p>${escapeHtml(review.body)}</p>` : ''}
      ${reviewDetailItems(review)}
      ${renderReviewPhotoStrip(court, review)}
      <button class="report-button" type="button" data-report-review="${escapeHtml(review.id || '')}" data-court-id="${escapeHtml(court.id)}">Report review</button>
    </article>
  `).join('');
}

function renderPhotoButton(court, photo, index) {
  return `
    <button class="location-photo-button" type="button" data-photo-court-id="${escapeHtml(court.id)}" data-photo-lightbox-index="${index}" aria-label="Open ${escapeHtml(court.name)} photo ${index + 1}">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(`${court.name} photo ${index + 1}`)}" loading="lazy" />
    </button>
  `;
}

function renderReviewPhotoStrip(court, review) {
  const photos = courtPhotoList(court).filter(photo => reviewMatchesPhoto(review, photo));
  if (!photos.length) return '';

  return `
    <div class="location-photo-strip review-photo-strip">
      ${photos.map(photo => renderPhotoButton(court, photo, photo.globalIndex)).join('')}
    </div>
  `;
}

function renderPhotoStrip(court, limit = 3) {
  const allPhotos = courtPhotoList(court);
  const photos = allPhotos.slice(0, limit);
  if (!photos.length) return '';

  return `
    <div class="location-photo-strip">
      ${photos.map(photo => renderPhotoButton(court, photo, photo.globalIndex)).join('')}
    </div>
  `;
}

function locationMenuItems(court, { includeEdit = false, includeShare = false } = {}) {
  return `
    ${includeEdit && canEditLocations() ? `<button type="button" data-edit-location="${court.id}">Edit location</button>` : ''}
    ${canEditLocations() ? '' : `<button type="button" data-suggest-edit="${court.id}">Suggest edit</button>`}
    <button class="report-menu-item" type="button" data-report-location="${court.id}">Report</button>
    ${includeShare ? `<button type="button" data-share-location="${court.id}">Share link</button>` : ''}
  `;
}

function locationActionButtons(court, className = 'popup-edit', { includeEdit = true, includeShare = false, variant = 'popup' } = {}) {
  const isMapInfo = variant === 'map-info';
  return `
    <div class="location-action-row location-menu-action-row${isMapInfo ? ' map-info-action-row' : ''}">
      <div class="card-menu location-overflow-menu${isMapInfo ? ' map-info-menu' : ''}" data-location-menu-wrapper>
        <button class="card-menu-toggle location-menu-toggle" type="button" data-location-menu-toggle aria-expanded="false" aria-label="More options for ${escapeHtml(court.name)}">...</button>
        <div class="card-menu-panel location-menu-panel" data-location-menu hidden>
          ${locationMenuItems(court, { includeEdit, includeShare })}
        </div>
      </div>
      <button class="${className}" type="button" data-review-location="${court.id}">Review</button>
    </div>
  `;
}

function createPopup(court) {
  return `
    <div class="popup-title">${court.name}</div>
    <div>${court.city}, ${court.state}</div>
    <div>${accessLabel(court)}</div>
    <div>Skill: ${court.estimatedSkillLevel}</div>
    <div>${formatOpenPlay(court)}</div>
    ${submitterLabel(court) ? `<div class="popup-submitter">${submitterLabel(court)}</div>` : ''}
    ${locationActionButtons(court)}
  `;
}

function showMapInfoBox(court, options = {}) {
  state.activeInfoCourtId = court.id;
  setMobileMapFocus(true);
  document.body.classList.add('has-map-info-open');
  const courtCount = courtCountLabel(court);
  elements.mapInfoBox.hidden = false;
  elements.mapInfoBox.innerHTML = `
    <button class="icon-button map-info-close" type="button" aria-label="Close location info">×</button>
    <div class="map-info-content">
      <div class="map-info-header">
        <div>
          <div class="popup-title">${court.name}</div>
          <div class="map-info-meta">${court.city}, ${court.state}</div>
        </div>
      </div>
      <div class="map-info-row">${court.address || `${court.city}, ${court.state}`}</div>
      <div class="map-info-detail-grid">
        <div><span>Access</span><strong>${accessLabel(court)}</strong></div>
        <div><span>Skill</span><strong>${court.estimatedSkillLevel}</strong></div>
        ${courtCount ? `<div><span>Courts</span><strong>${courtCount}</strong></div>` : ''}
        <div><span>Setting</span><strong>${court.courts?.indoorOutdoor || 'unknown'}</strong></div>
        ${court.courts?.surface && court.courts.surface !== 'unknown' ? `<div><span>Surface</span><strong>${court.courts.surface}</strong></div>` : ''}
      </div>
      <div class="map-info-section">
        <h3>Open play</h3>
        <div class="map-info-open-play">${renderOpenPlaySummary(court)}</div>
      </div>
      ${court.notes ? `<div class="map-info-notes">${court.notes}</div>` : ''}
      ${renderPhotoStrip(court, court.photos?.length || 3)}
      ${submitterLabel(court) ? `<div class="map-info-row">${submitterLabel(court)}</div>` : ''}
      <div class="reviews-panel">
        <h3>Player reviews</h3>
        ${renderReviewList(court, getCourtReviews(court.id).length)}
      </div>
    </div>
    ${locationActionButtons(court, 'popup-edit', { includeEdit: true, includeShare: true, variant: 'map-info' })}
  `;

  elements.mapInfoBox.querySelector('.map-info-close').addEventListener('click', () => {
    elements.mapInfoBox.hidden = true;
    state.activeInfoCourtId = null;
    document.body.classList.remove('has-map-info-open');
    closeLocationMenus();
  });

  bindLocationMenu(elements.mapInfoBox);
  bindPhotoLightboxButtons(elements.mapInfoBox);

  elements.mapInfoBox.querySelector('[data-edit-location]')?.addEventListener('click', () => {
    closeLocationMenus();
    openEditDialog(court.id);
  });

  elements.mapInfoBox.querySelector('[data-review-location]').addEventListener('click', () => {
    closeLocationMenus();
    openReviewDialog(court.id);
  });

  elements.mapInfoBox.querySelector('[data-suggest-edit]')?.addEventListener('click', () => {
    closeLocationMenus();
    openSuggestEditDialog(court.id);
  });

  elements.mapInfoBox.querySelector('[data-report-location]')?.addEventListener('click', () => {
    closeLocationMenus();
    reportLocation(court.id);
  });

  elements.mapInfoBox.querySelector('[data-share-location]')?.addEventListener('click', async () => {
    closeLocationMenus();
    await shareLocation(court);
  });

  elements.mapInfoBox.querySelectorAll('[data-report-review]').forEach(button => {
    button.addEventListener('click', () => {
      reportReview(button.dataset.courtId, button.dataset.reportReview);
    });
  });

  positionMapInfoBox(court);
  if (options.centerInVisibleMap) {
    centerCourtInVisibleMap(court, options.zoom);
  }
}

function positionMapInfoBox(court) {
  if (elements.mapInfoBox.hidden || typeof court.latitude !== 'number' || typeof court.longitude !== 'number') return;

  if (isMobileLayout()) {
    elements.mapInfoBox.style.left = '';
    elements.mapInfoBox.style.top = '';
    elements.mapInfoBox.style.right = '';
    return;
  }

  const point = map.latLngToContainerPoint([court.latitude, court.longitude]);
  const mapSize = map.getSize();
  const boxWidth = elements.mapInfoBox.offsetWidth || 300;
  const boxHeight = elements.mapInfoBox.offsetHeight || 180;
  const gap = 14;

  let left = point.x - (boxWidth / 2);
  let top = point.y - boxHeight - gap;

  left = Math.max(12, Math.min(left, mapSize.x - boxWidth - 12));

  if (top < 12) {
    top = point.y + gap;
  }

  top = Math.max(12, Math.min(top, mapSize.y - boxHeight - 12));

  elements.mapInfoBox.style.left = `${left}px`;
  elements.mapInfoBox.style.top = `${top}px`;
  elements.mapInfoBox.style.right = 'auto';
}

function createCourtCard(court) {
  const card = document.createElement('article');
  card.className = `court-card${court.userSubmitted ? ' user-submitted' : ''}`;
  const reviews = getCourtReviews(court.id);
  const courtCount = courtCountLabel(court);
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="court-card-header">
      <h2><span class="court-icon" aria-hidden="true">${DEFAULT_ICON}</span>${court.name}</h2>
      <div class="card-actions">
        ${canEditLocations() ? `<button class="card-edit" type="button" data-edit-location="${court.id}" aria-label="Edit ${court.name}">Edit</button>` : ''}
          <div class="card-menu">
            <button class="card-menu-toggle" type="button" data-card-menu-toggle aria-expanded="false" aria-label="More options for ${escapeHtml(court.name)}">...</button>
            <div class="card-menu-panel" data-card-menu hidden>
              ${locationMenuItems(court, { includeShare: true })}
            </div>
          </div>
        </div>
    </div>
    <p class="meta">${court.address || `${court.city}, ${court.state}`}</p>
    <div class="badges">
      <span class="badge">${accessLabel(court)}</span>
      ${courtCount ? `<span class="badge">${courtCount}</span>` : ''}
      <span class="badge">${court.estimatedSkillLevel}</span>
      ${reviews.length ? `<span class="badge">${reviews.length} review${reviews.length === 1 ? '' : 's'}</span>` : ''}
    </div>
    ${renderOpenPlaySummary(court, {
      actionsHtml: `<button class="card-edit card-action-button card-review-inline" type="button" data-review-location="${court.id}" aria-label="Review ${escapeHtml(court.name)}">Review</button>`
    })}
  `;

  bindPhotoLightboxButtons(card);

  card.addEventListener('click', () => focusCourt(court.id, 'list_card'));
  card.querySelector('[data-card-menu-toggle]').addEventListener('click', event => {
    event.stopPropagation();
    const isOpen = card.classList.contains('is-menu-open');
    closeCardMenus();
    if (isOpen) return;
    card.classList.add('is-menu-open');
    card.querySelector('[data-card-menu-toggle]').setAttribute('aria-expanded', 'true');
    card.querySelector('[data-card-menu]').hidden = false;
    state.openCardMenuId = court.id;
  });
  card.querySelector('.card-menu').addEventListener('click', event => {
    event.stopPropagation();
  });
  card.querySelector('[data-edit-location]')?.addEventListener('click', event => {
    event.stopPropagation();
    closeCardMenus();
    openEditDialog(court.id);
  });
  card.querySelector('[data-review-location]').addEventListener('click', event => {
    event.stopPropagation();
    closeCardMenus();
    openReviewDialog(court.id);
  });
  card.querySelector('[data-suggest-edit]')?.addEventListener('click', event => {
    event.stopPropagation();
    closeCardMenus();
    openSuggestEditDialog(court.id);
  });
  card.querySelector('[data-share-location]').addEventListener('click', async event => {
    event.stopPropagation();
    closeCardMenus();
    await shareLocation(court);
  });
  card.querySelector('[data-report-location]').addEventListener('click', event => {
    event.stopPropagation();
    closeCardMenus();
    reportLocation(court.id);
  });
  card.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeCardMenus();
      return;
    }
    if (event.target.closest('button, a, input, select, textarea')) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      focusCourt(court.id, 'list_card_keyboard');
    }
  });

  return card;
}

function isMobileLayout() {
  return window.matchMedia('(max-width: 760px)').matches;
}

function syncMobileHeaderHeight() {
  if (!isMobileLayout()) {
    document.documentElement.style.removeProperty('--mobile-map-header-height');
    return;
  }
  const headerHeight = elements.siteHeader?.getBoundingClientRect().height;
  if (headerHeight) {
    document.documentElement.style.setProperty('--mobile-map-header-height', `${Math.ceil(headerHeight)}px`);
  }
}

function setMobileMapFocus(isMapFocused) {
  if (!isMobileLayout()) return;
  document.body.classList.toggle('mobile-map-focus', isMapFocused);
  if (isMapFocused) {
    document.body.classList.remove('mobile-list-full');
  }
  setTimeout(() => map.invalidateSize(), 180);
}

function setMobileListFull(isFullList) {
  if (!isMobileLayout()) return;
  document.body.classList.toggle('mobile-list-full', isFullList);
  if (isFullList) {
    document.body.classList.remove('mobile-map-focus');
  }
  setTimeout(() => map.invalidateSize(), 180);
}

function setMobileSheetMode(mode) {
  if (mode === 'full') {
    setMobileListFull(true);
    return;
  }
  if (mode === 'map') {
    setMobileMapFocus(true);
    return;
  }
  document.body.classList.remove('mobile-map-focus');
  document.body.classList.remove('mobile-list-full');
  setTimeout(() => map.invalidateSize(), 180);
}

function setupMobileSheetDrag() {
  const dragSurface = elements.mobileResultsBar;
  const sheet = dragSurface?.closest('.sidebar');
  if (!dragSurface || !sheet) return;

  let dragState = null;

  const currentMode = () => {
    if (document.body.classList.contains('mobile-list-full')) return 'full';
    if (document.body.classList.contains('mobile-map-focus')) return 'map';
    return 'half';
  };

  const previewDrag = deltaY => {
    const mode = dragState.mode;
    let offset = 0;

    if (mode === 'full') {
      offset = Math.max(0, Math.min(deltaY, sheet.getBoundingClientRect().height * 0.45));
    } else if (mode === 'half') {
      offset = Math.max(-110, Math.min(deltaY, sheet.getBoundingClientRect().height * 0.55));
    } else {
      offset = Math.min(0, Math.max(deltaY, -140));
    }

    sheet.style.setProperty('--mobile-sheet-drag-offset', `${Math.round(offset)}px`);
  };

  const finishDrag = event => {
    if (!dragState) return;
    const deltaY = (event.clientY ?? dragState.startY) - dragState.startY;
    const mode = dragState.mode;

    sheet.classList.remove('is-dragging');
    sheet.style.removeProperty('--mobile-sheet-drag-offset');

    if (Math.abs(deltaY) > 46) {
      if (deltaY < 0) {
        setMobileSheetMode(mode === 'map' ? 'half' : 'full');
      } else {
        setMobileSheetMode(mode === 'full' ? 'half' : 'map');
      }
    } else {
      setMobileSheetMode(mode);
    }

    dragState = null;
  };

  dragSurface.addEventListener('pointerdown', event => {
    if (!isMobileLayout() || event.button !== 0) return;
    if (event.target.closest('button') && event.target !== elements.mobileSheetHandle) return;

    dragState = {
      startY: event.clientY,
      mode: currentMode()
    };
    sheet.classList.add('is-dragging');
    dragSurface.setPointerCapture?.(event.pointerId);
  });

  dragSurface.addEventListener('pointermove', event => {
    if (!dragState) return;
    event.preventDefault();
    previewDrag(event.clientY - dragState.startY);
  }, { passive: false });

  dragSurface.addEventListener('pointerup', finishDrag);
  dragSurface.addEventListener('pointercancel', finishDrag);
}

function preventPageZoomOverMap() {
  const mapContainer = map.getContainer();
  const preventGesture = event => {
    if (event.target.closest?.('#map')) {
      event.preventDefault();
    }
  };

  mapContainer.addEventListener('gesturestart', preventGesture, { passive: false });
  mapContainer.addEventListener('gesturechange', preventGesture, { passive: false });
  mapContainer.addEventListener('touchmove', event => {
    if (event.touches?.length > 1) {
      event.preventDefault();
    }
  }, { passive: false });
}

function mobileOverlayVisibleBottom() {
  const mapRect = map.getContainer().getBoundingClientRect();
  let visibleBottom = mapRect.height;
  const overlays = [elements.mapInfoBox, document.querySelector('.map-page .sidebar')];

  overlays.forEach(overlay => {
    if (!overlay || overlay.hidden) return;
    const rect = overlay.getBoundingClientRect();
    const overlapsMap = rect.bottom > mapRect.top
      && rect.top < mapRect.bottom
      && rect.right > mapRect.left
      && rect.left < mapRect.right;

    if (overlapsMap && rect.top > mapRect.top) {
      visibleBottom = Math.min(visibleBottom, rect.top - mapRect.top);
    }
  });

  return Math.max(96, visibleBottom);
}

function centerCourtInVisibleMap(court, zoom = map.getZoom()) {
  if (!court || typeof court.latitude !== 'number' || typeof court.longitude !== 'number') return;

  if (!isMobileLayout()) {
    map.setView([court.latitude, court.longitude], zoom);
    return;
  }

  map.invalidateSize();
  const mapSize = map.getSize();
  const visibleBottom = mobileOverlayVisibleBottom();
  const desiredPoint = L.point(mapSize.x / 2, visibleBottom / 2);
  const projectedCourt = map.project([court.latitude, court.longitude], zoom);
  const projectedCenter = projectedCourt
    .subtract(desiredPoint)
    .add(mapSize.divideBy(2));
  const adjustedCenter = map.unproject(projectedCenter, zoom);

  map.setView(adjustedCenter, zoom, { animate: false });
}

function focusCourt(id, source = 'location_focus') {
  const court = state.courts.find(item => item.id === id);
  const marker = state.markers.get(id);
  if (!court || !marker) return;

  trackLocationView(court, source);

  if (isMobileLayout()) {
    setMobileMapFocus(true);
    showMapInfoBox(court, { centerInVisibleMap: true, zoom: 13 });
    setTimeout(() => centerCourtInVisibleMap(court, 13), 240);
    return;
  }

  map.setView([court.latitude, court.longitude], 13);
  showMapInfoBox(court);
}

function focusSharedLocationFromUrl() {
  const sharedLocationId = new URLSearchParams(window.location.search).get('location');
  if (!sharedLocationId) return;
  if (!state.courts.some(court => court.id === sharedLocationId)) return;
  focusCourt(sharedLocationId, 'shared_url');
}

async function reportLocation(courtId) {
  if (!requireCurrentUser('Sign in or create a profile before reporting an issue.')) return;
  const court = state.courts.find(item => item.id === courtId);
  if (!court) return;
  if (reportExists({ targetType: 'location', targetId: court.id })) {
    window.alert('You already reported this location.');
    return;
  }
  const reason = window.prompt('What is wrong with this location? Examples: wrong hours, closed facility, fake info, duplicate, inaccurate details.');
  if (!reason?.trim()) return;

  if (court.remoteId && window.OpenPlaySupabase?.submitReport) {
    try {
      const report = await window.OpenPlaySupabase.submitReport({
        targetType: 'location',
        targetId: court.remoteId,
        reason: reason.trim(),
        metadata: {
          target_name: court.name,
          location_slug: court.id
        }
      });
      state.ownReports = [...(state.ownReports || []), {
        ...report,
        targetId: court.id,
        targetName: court.name
      }];
      window.alert('Report submitted. Thanks for helping keep the map accurate.');
    } catch (error) {
      window.alert(error.message.includes('duplicate') ? 'You already reported this location.' : error.message);
    }
    return;
  }

  saveReport({
    targetType: 'location',
    targetId: court.id,
    targetName: court.name,
    reason: reason.trim()
  });
  window.alert('Report submitted. Thanks for helping keep the map accurate.');
}

async function reportReview(courtId, reviewId) {
  if (!requireCurrentUser('Sign in or create a profile before reporting an issue.')) return;
  const court = state.courts.find(item => item.id === courtId);
  const review = getCourtReviews(courtId).find(item => item.id === reviewId);
  if (!court || !review) return;
  if (review.userId === state.currentUser.id) {
    window.alert('You can edit your own review instead of reporting it.');
    return;
  }
  if (reportExists({ targetType: 'review', targetId: court.id, reviewId })) {
    window.alert('You already reported this review.');
    return;
  }
  const reason = window.prompt('What is wrong with this review? Examples: fake review, inaccurate details, spam, wrong hours.');
  if (!reason?.trim()) return;

  if (court.remoteId && review.remoteId && window.OpenPlaySupabase?.submitReport) {
    try {
      const report = await window.OpenPlaySupabase.submitReport({
        targetType: 'review',
        targetId: review.remoteId,
        reason: reason.trim(),
        metadata: {
          target_name: court.name,
          location_slug: court.id,
          review_id: review.remoteId
        }
      });
      state.ownReports = [...(state.ownReports || []), {
        ...report,
        targetId: court.id,
        targetName: court.name,
        reviewId: review.remoteId
      }];
      window.alert('Report submitted. Thanks for helping keep reviews accurate.');
    } catch (error) {
      window.alert(error.message.includes('duplicate') ? 'You already reported this review.' : error.message);
    }
    return;
  }

  saveReport({
    targetType: 'review',
    targetId: court.id,
    targetName: court.name,
    reviewId,
    reason: reason.trim()
  });
  window.alert('Report submitted. Thanks for helping keep reviews accurate.');
}

function schedulePopupClose(marker) {
  clearTimeout(state.popupCloseTimer);
  state.popupCloseTimer = setTimeout(() => {
    if (!state.hoveringPopup) marker.closePopup();
  }, 350);
}

function attachHoverPopup(marker, court) {
  const openClickPopup = event => {
    event?.originalEvent?.stopPropagation?.();
    event?.stopPropagation?.();
    clearTimeout(state.popupCloseTimer);
    state.hoveringPopup = true;
    trackLocationView(court, 'map_marker');
    showMapInfoBox(court, { centerInVisibleMap: isMobileLayout() });
    if (isMobileLayout()) {
      setTimeout(() => centerCourtInVisibleMap(court), 240);
    }
  };

  const bindMarkerElementClick = () => {
    const markerElement = marker.getElement();
    if (!markerElement) return;

    markerElement.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openClickPopup(event);
    });
  };

  marker.on('add', bindMarkerElementClick);

  marker.on('click', openClickPopup);

  marker.on('popupopen', event => {
    const popupElement = event.popup.getElement();
    if (popupElement) bindLocationMenu(popupElement);
    popupElement
      ?.querySelector('[data-edit-location]')
      ?.addEventListener('click', () => {
        closeLocationMenus();
        openEditDialog(court.id);
      });
    popupElement
      ?.querySelector('[data-review-location]')
      ?.addEventListener('click', () => {
        closeLocationMenus();
        openReviewDialog(court.id);
      });
    popupElement
      ?.querySelector('[data-suggest-edit]')
      ?.addEventListener('click', () => {
        closeLocationMenus();
        openSuggestEditDialog(court.id);
      });
    popupElement
      ?.querySelector('[data-report-location]')
      ?.addEventListener('click', () => {
        closeLocationMenus();
        reportLocation(court.id);
      });

    popupElement?.addEventListener('mouseenter', () => {
      state.hoveringPopup = true;
      clearTimeout(state.popupCloseTimer);
    });

    popupElement?.addEventListener('mouseleave', () => {
      state.hoveringPopup = false;
    });
  });
}

function render() {
  closeCardMenus();
  updateFilterCount();
  const filtered = state.courts.filter(matchesControls);
  const visibleCourts = filtered.filter(isCourtInMapView);
  elements.resultCount.textContent = visibleCourts.length
    ? `${visibleCourts.length} location${visibleCourts.length === 1 ? '' : 's'} in this map view`
    : 'No open play pickleball locations in this map view';

  if (visibleCourts.length) {
    elements.courtList.replaceChildren(...visibleCourts.map(createCourtCard));
  } else {
    elements.courtList.innerHTML = '<p class="empty-results">No open play pickleball locations found here. Try moving the map or changing filters.</p>';
  }

  state.markerLayer.clearLayers();
  state.markers.clear();

  filtered.forEach(court => {
    if (typeof court.latitude !== 'number' || typeof court.longitude !== 'number') return;
    const marker = L.marker([court.latitude, court.longitude], { icon: createLocationIcon(court) }).bindPopup(createPopup(court), {
      closeButton: false,
      closeOnClick: false,
      autoClose: false
    });
    attachHoverPopup(marker, court);
    marker.addTo(state.markerLayer);
    state.markers.set(court.id, marker);
  });

}

function setSuggestEditNoteVisible(isVisible) {
  elements.suggestEditNote.hidden = !isVisible;
  elements.suggestEditReason.required = isVisible;
  if (!isVisible) elements.suggestEditReason.value = '';
}

function setLocationPhotoUploadVisible(isVisible) {
  const field = elements.newPhotos.closest('.field-photos');
  if (!field) return;
  field.hidden = !isVisible;
  elements.newPhotos.disabled = !isVisible;
  if (!isVisible) elements.newPhotos.value = '';
}

function setLocationDialogCopy({ eyebrow, title, button, hint }) {
  elements.submitEyebrow.textContent = eyebrow;
  elements.submitTitle.textContent = title;
  elements.submitButton.textContent = button;
  elements.formHint.textContent = hint;
}

function populateLocationForm(court) {
  elements.newName.value = court.name || '';
  elements.newAddress.value = court.address || '';
  elements.newCity.value = court.city || '';
  elements.newState.value = court.state || '';
  elements.newLat.value = court.latitude ?? '';
  elements.newLng.value = court.longitude ?? '';
  elements.newAccess.value = court.access || (court.isFree ? 'public' : 'paid');
  elements.newOpenPlayFee.value = normalizeOpenPlayFee(court.openPlayFee) ?? '';
  updateOpenPlayFeeField();
  elements.newCourtCount.value = court.courts?.count ?? '';
  setSelectedLocationSkills(court.skillLevels || court.estimatedSkillLevel || '');
  setSelectedOpenPlayDays(court.openPlay?.[0]?.days || '');
  elements.newDays.open = false;
  resetTimeWindows((court.openPlay || []).map(slot => ({
    start: slot.startTime || parseOpenPlayHours(slot.hours).start,
    end: slot.endTime || parseOpenPlayHours(slot.hours).end
  })));
  elements.newNotes.value = court.notes || '';
  elements.newPhotos.value = '';
}

function openSubmitDialog() {
  if (!requireCurrentUser('Sign in or create a profile before adding a location.')) return;
  state.editingId = null;
  state.suggestingEditId = null;
  elements.locationForm.reset();
  setSelectedLocationSkills([]);
  setSelectedOpenPlayDays('');
  elements.newDays.open = false;
  resetTimeWindows();
  updateOpenPlayFeeField();
  setSuggestEditNoteVisible(false);
  setLocationPhotoUploadVisible(true);
  setLocationDialogCopy({
    eyebrow: 'Community submission',
    title: 'Add an open play location',
    button: 'Save location',
    hint: 'Tip: while this form is open, click the map to fill latitude and longitude.'
  });
  document.body.classList.add('is-submitting-location');
  elements.submitDialog.show();
  resetDialogScroll(elements.submitDialog, elements.locationForm, { focusCloseButton: true });
  if (!isMobileLayout()) {
    elements.placeSearch.focus();
  }
  setTimeout(() => map.invalidateSize(), 50);
}

function openEditDialog(id) {
  if (!requireCurrentUser('Sign in or create a profile before editing a location.')) return;
  if (!canEditLocations()) return;
  const court = state.courts.find(item => item.id === id);
  if (!court) return;

  state.editingId = id;
  state.suggestingEditId = null;
  setSuggestEditNoteVisible(false);
  setLocationPhotoUploadVisible(true);
  setLocationDialogCopy({
    eyebrow: 'Admin edit',
    title: 'Edit open play location',
    button: 'Save changes',
    hint: 'Editing this location. You can click the map or drag the pin to move it.'
  });
  populateLocationForm(court);

  if (Number.isFinite(court.latitude) && Number.isFinite(court.longitude)) {
    setDraftLocation(court.latitude, court.longitude);
    map.setView([court.latitude, court.longitude], 14);
  }

  document.body.classList.add('is-submitting-location');
  elements.submitDialog.show();
  resetDialogScroll(elements.submitDialog, elements.locationForm, { focusCloseButton: true });
  setTimeout(() => map.invalidateSize(), 50);
}

function openSuggestEditDialog(id) {
  if (!requireCurrentUser('Sign in or create a profile before suggesting an edit.')) return;
  const court = state.courts.find(item => item.id === id);
  if (!court) return;

  state.editingId = null;
  state.suggestingEditId = id;
  elements.locationForm.reset();
  populateLocationForm(court);
  setSuggestEditNoteVisible(true);
  setLocationPhotoUploadVisible(false);
  setLocationDialogCopy({
    eyebrow: 'Suggested edit',
    title: `Suggest an edit for ${court.name}`,
    button: 'Submit suggested edit',
    hint: 'Change the fields you believe are wrong. An admin will review your suggestion before it appears on the map.'
  });

  if (Number.isFinite(court.latitude) && Number.isFinite(court.longitude)) {
    setDraftLocation(court.latitude, court.longitude);
    map.setView([court.latitude, court.longitude], isMobileLayout() ? map.getZoom() : 14);
  }

  document.body.classList.add('is-submitting-location');
  elements.submitDialog.show();
  resetDialogScroll(elements.submitDialog, elements.locationForm, { focusCloseButton: true });
  if (!isMobileLayout()) {
    elements.suggestEditReason.focus();
  }
  setTimeout(() => map.invalidateSize(), 50);
}

function closeSubmitDialog() {
  document.body.classList.remove('is-submitting-location');
  elements.submitDialog.close();
  state.editingId = null;
  state.suggestingEditId = null;
  setSuggestEditNoteVisible(false);
  setLocationPhotoUploadVisible(true);
  clearDraftMarker();
}

function openReviewDialog(id) {
  if (!requireCurrentUser('Sign in or create a profile before posting a review.')) return;
  const court = state.courts.find(item => item.id === id);
  if (!court) return;

  state.reviewCourtId = id;
  elements.reviewForm.reset();
  const existingReview = getCurrentUserReview(id);
  elements.reviewVisited.value = existingReview?.visited || todayIso();
  setSelectedReviewSkills(existingReview?.skillLevels || existingReview?.skill || court.skillLevels || court.estimatedSkillLevel || '');
  elements.reviewCrowd.value = existingReview?.crowdLevel || '';
  elements.reviewBestTime.value = existingReview?.bestTime || '';
  elements.reviewReliability.value = existingReview?.openPlayReliability || '';
  elements.reviewNetSetup.value = existingReview?.netSetup || '';
  elements.reviewPlayFormat.value = existingReview?.playFormat || '';
  elements.reviewBeginnerFriendly.value = existingReview?.beginnerFriendliness || '';
  elements.reviewFees.value = existingReview?.fees || '';
  elements.reviewAmenities.value = existingReview?.amenities || '';
  elements.reviewLighting.value = existingReview?.lighting || '';
  elements.reviewSchedulingApp.value = existingReview?.schedulingApp || '';
  elements.reviewBody.value = existingReview?.body || '';
  elements.reviewTitle.textContent = existingReview ? `Edit your review for ${court.name}` : `Review ${court.name}`;
  setReviewHint(existingReview ? 'Saving will replace your previous review for this location.' : '');
  updateReviewRequirement();
  openDialog(elements.reviewDialog);
  resetDialogScroll(elements.reviewDialog, elements.reviewForm, { focusCloseButton: true });
}

function closeReviewDialog() {
  state.reviewCourtId = null;
  closeDialog(elements.reviewDialog);
}

function reviewFormValues() {
  const photoFiles = selectedPhotoFiles(elements.reviewPhotos);
  return {
    body: elements.reviewBody.value.trim(),
    skillLevels: selectedReviewSkills(),
    reviewDetails: {
      crowdLevel: elements.reviewCrowd.value,
      bestTime: elements.reviewBestTime.value.trim(),
      openPlayReliability: elements.reviewReliability.value,
      netSetup: elements.reviewNetSetup.value,
      playFormat: elements.reviewPlayFormat.value,
      beginnerFriendliness: elements.reviewBeginnerFriendly.value,
      fees: elements.reviewFees.value,
      amenities: elements.reviewAmenities.value,
      lighting: elements.reviewLighting.value,
      schedulingApp: elements.reviewSchedulingApp.value.trim()
    },
    photoFiles
  };
}

function usefulReviewFieldCount({ body, skillLevels, reviewDetails, photoFiles = [] }) {
  return [
    skillLevels.length ? 'skill' : '',
    reviewDetails.crowdLevel,
    reviewDetails.bestTime,
    reviewDetails.openPlayReliability,
    reviewDetails.netSetup,
    reviewDetails.playFormat,
    reviewDetails.beginnerFriendliness,
    reviewDetails.fees,
    reviewDetails.amenities,
    reviewDetails.lighting,
    reviewDetails.schedulingApp,
    body,
    photoFiles.length ? 'photos' : ''
  ].filter(value => String(value).trim() !== '').length;
}

function updateReviewRequirement() {
  const usefulFields = usefulReviewFieldCount(reviewFormValues());
  const isComplete = usefulFields >= MIN_REVIEW_FIELDS;
  elements.reviewRequirement.classList.toggle('is-complete', isComplete);
  elements.reviewRequirement.classList.toggle('is-incomplete', !isComplete);
  if (isComplete && elements.reviewHint.classList.contains('is-error') && elements.reviewHint.textContent.includes('at least')) {
    setReviewHint('');
  }
}

function setReviewHint(message, isError = false) {
  elements.reviewHint.textContent = message;
  elements.reviewHint.classList.toggle('is-error', isError);
}

async function submitReview(event) {
  event.preventDefault();
  if (!requireCurrentUser('Sign in or create a profile before posting a review.')) return;

  const court = state.courts.find(item => item.id === state.reviewCourtId);
  const { body, skillLevels, reviewDetails, photoFiles: reviewPhotoFiles } = reviewFormValues();
  const hasReviewDetails = skillLevels.length || Object.values(reviewDetails).some(value => String(value).trim() !== '');
  const allReviews = getSavedReviews();
  const courtReviews = allReviews[court?.id] || [];
  const existingReview = courtReviews.find(review => review.userId === state.currentUser.id) || null;
  const usefulFields = usefulReviewFieldCount({ body, skillLevels, reviewDetails, photoFiles: reviewPhotoFiles });
  if (!court) return;

  if (!elements.reviewVisited.value) {
    setReviewHint('Add the date you visited before posting.', true);
    return;
  }

  if (usefulFields < MIN_REVIEW_FIELDS) {
    setReviewHint(`Add at least ${MIN_REVIEW_FIELDS} useful review fields before posting. Skill level, reliability, notes, photos, crowd, nets, and amenities all count.`, true);
    return;
  }

  if (!existingReview && savedReviewCountForToday(state.currentUser.id) >= DAILY_REVIEW_LIMIT) {
    setReviewHint(`Daily review limit reached. You can add up to ${DAILY_REVIEW_LIMIT} reviews per day.`, true);
    return;
  }

  const nextReview = {
    ...(existingReview || {}),
    id: existingReview?.id || `review-${Date.now()}`,
    userId: state.currentUser.id,
    username: state.currentUser.username,
    skillLevel: normalizeSkillLevel(state.currentUser.skillLevel, ''),
    courtName: court.name,
    body,
    skill: formatLocationSkillLevel(skillLevels),
    skillLevels,
    ...reviewDetails,
    visited: elements.reviewVisited.value || todayIso(),
    createdAt: existingReview?.createdAt || todayIso(),
    updatedAt: existingReview ? todayIso() : ''
  };

  if (court.remoteId && window.OpenPlaySupabase?.submitReview) {
    try {
      setReviewHint(reviewPhotoFiles.length ? 'Uploading photos and saving review...' : 'Saving review...');
      const savedReview = await window.OpenPlaySupabase.submitReview(court, nextReview, state.currentUser, reviewPhotoFiles);
      const allReviews = getSavedReviews();
      const courtReviews = allReviews[court.id] || [];
      allReviews[court.id] = [
        savedReview,
        ...courtReviews.filter(review => review.userId !== state.currentUser.id)
      ];
      saveReviews(allReviews);
      closeReviewDialog();
      render();
      focusCourt(court.id, 'review_saved');
    } catch (error) {
      console.error(error);
      setReviewHint(error.message || 'Could not save that review.', true);
    }
    return;
  }

  if (body || hasReviewDetails) {
    allReviews[court.id] = [
      nextReview,
      ...courtReviews.filter(review => review.userId !== state.currentUser.id)
    ];
    saveReviews(allReviews);
    if (!existingReview) {
      awardCredits({
        action: 'add-review',
        targetType: 'location',
        targetId: court.id
      });
    }
  }

  closeReviewDialog();
  render();
  focusCourt(court.id, 'review_saved');
}

function setDraftLocation(lat, lng) {
  elements.newLat.value = lat.toFixed(6);
  elements.newLng.value = lng.toFixed(6);
  elements.formHint.textContent = 'Pin set. Finish the details, then save the location.';

  if (!state.draftMarker) {
    state.draftMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
    state.draftMarker.on('dragend', event => {
      const next = event.target.getLatLng();
      setDraftLocation(next.lat, next.lng);
    });
  } else {
    state.draftMarker.setLatLng([lat, lng]);
  }
}

function clearDraftMarker() {
  if (!state.draftMarker) return;
  state.draftMarker.remove();
  state.draftMarker = null;
}

function addressPart(address, keys) {
  for (const key of keys) {
    if (address?.[key]) return address[key];
  }
  return '';
}

function fillFromPlace(place) {
  const address = place.address || {};
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  const name = place.name || addressPart(address, ['leisure', 'amenity', 'building']) || place.display_name?.split(',')[0] || '';
  const city = addressPart(address, ['city', 'town', 'village', 'hamlet', 'county']);
  const state = addressPart(address, ['state']);

  elements.newName.value = name;
  elements.newAddress.value = place.display_name || '';
  elements.newCity.value = city;
  elements.newState.value = state.length === 2 ? state.toUpperCase() : state;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    setDraftLocation(lat, lng);
    map.setView([lat, lng], 15);
  }

  elements.formHint.textContent = 'Place selected. Add open-play details, skill level, and save.';
}

function renderPlaceResults(places) {
  if (!places.length) {
    elements.placeResults.innerHTML = '<p class="empty-results">No matching pickleball places found. Try a more specific park name, city, or state.</p>';
    return;
  }

  elements.placeResults.replaceChildren(...places.map(place => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'place-result';
    button.innerHTML = `
      <strong>${place.name || place.display_name?.split(',')[0] || 'Unnamed place'}</strong>
      <span>${place.display_name || ''}</span>
    `;
    button.addEventListener('click', () => fillFromPlace(place));
    return button;
  }));
}

async function searchPlaces() {
  const query = elements.placeSearch.value.trim();
  if (!query) {
    elements.placeResults.innerHTML = '';
    return;
  }

  if (query.length < 3) {
    elements.placeResults.innerHTML = '<p class="empty-results">Keep typing to search places…</p>';
    return;
  }

  const trackedQuery = query.toLowerCase();
  if (state.lastTrackedPlaceSearch !== trackedQuery) {
    state.lastTrackedPlaceSearch = trackedQuery;
    trackAnalyticsEvent('place_search', {
      query,
      source: 'submit_location_form'
    });
  }

  elements.placeSearchButton.disabled = true;
  elements.placeSearchButton.textContent = 'Searching…';
  elements.placeResults.innerHTML = '<p class="empty-results">Searching places…</p>';

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
      countrycodes: 'us'
    }).toString();

    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Place search failed: ${response.status}`);
    renderPlaceResults(await response.json());
  } catch (error) {
    console.error(error);
    elements.placeResults.innerHTML = '<p class="empty-results">Place search failed. You can still click the map or enter details manually.</p>';
  } finally {
    elements.placeSearchButton.disabled = false;
    elements.placeSearchButton.textContent = 'Search';
  }
}

function selectHeaderPlace(place) {
  const lat = Number(place.lat);
  const lng = Number(place.lon);
  elements.search.value = place.name || place.display_name?.split(',')[0] || elements.search.value;
  elements.headerPlaceResults.innerHTML = '';
  state.areaSearchActive = true;
  trackAnalyticsEvent('search_suggestion_select', {
    query: elements.search.value,
    place_name: place.name || place.display_name?.split(',')[0] || '',
    source: 'header_search'
  });

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    map.setView([lat, lng], 12);
  } else {
    render();
  }
}

function renderHeaderPlaceResults(places) {
  if (!places.length) {
    elements.headerPlaceResults.innerHTML = '<p class="empty-results">No suggested pickleball places found.</p>';
    return;
  }

  elements.headerPlaceResults.replaceChildren(...places.map(place => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'header-place-result';
    button.innerHTML = `
      <strong>${place.name || place.display_name?.split(',')[0] || 'Unnamed place'}</strong>
      <span>${place.display_name || ''}</span>
    `;
    button.addEventListener('click', () => selectHeaderPlace(place));
    return button;
  }));
}

async function searchHeaderPlaces() {
  const query = elements.search.value.trim();
  render();

  if (!query || query.length < 3) {
    elements.headerPlaceResults.innerHTML = '';
    return;
  }

  const trackedQuery = query.toLowerCase();
  if (state.lastTrackedHeaderSearch !== trackedQuery) {
    state.lastTrackedHeaderSearch = trackedQuery;
    trackAnalyticsEvent('map_search', {
      query,
      source: 'header_search'
    });
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.search = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
      countrycodes: 'us'
    }).toString();

    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Header place search failed: ${response.status}`);
    renderHeaderPlaceResults(await response.json());
  } catch (error) {
    console.error(error);
    elements.headerPlaceResults.innerHTML = '<p class="empty-results">Suggestions unavailable.</p>';
  }
}

async function addSubmittedLocation(event) {
  event.preventDefault();
  if (!requireCurrentUser('Sign in or create a profile before saving a location.')) return;

  const lat = Number(elements.newLat.value);
  const lng = Number(elements.newLng.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    elements.formHint.textContent = 'Please add valid latitude and longitude. You can click the map to set them.';
    return;
  }

  const access = elements.newAccess.value;
  const openPlayFee = access === 'paid' ? normalizeOpenPlayFee(elements.newOpenPlayFee.value) : null;
  if (access === 'paid' && openPlayFee === null) {
    elements.formHint.textContent = 'Enter the open play fee for public paid open play.';
    elements.newOpenPlayFee.focus();
    return;
  }
  const courtCountValue = elements.newCourtCount.value.trim();
  const courtCount = courtCountValue ? Number(courtCountValue) : null;
  if (courtCount !== null && (!Number.isInteger(courtCount) || courtCount < 0)) {
    elements.formHint.textContent = 'Please enter a whole number of courts, or leave it blank.';
    return;
  }
  const name = elements.newName.value.trim();
  const isSuggestingEdit = Boolean(state.suggestingEditId);
  const existingId = state.editingId || state.suggestingEditId || '';
  const existing = existingId ? state.courts.find(item => item.id === existingId) : null;
  if (!name) {
    elements.formHint.textContent = 'Location name is required.';
    return;
  }

  if (!existing && !isSuggestingEdit && savedSubmissionCountForToday(state.currentUser.id) >= DAILY_LOCATION_LIMIT) {
    elements.formHint.textContent = `Daily location limit reached. You can submit up to ${DAILY_LOCATION_LIMIT} new locations per day.`;
    return;
  }

  const skillLevels = selectedLocationSkills();
  const estimatedSkillLevel = formatLocationSkillLevel(skillLevels);
  const openPlay = getOpenPlaySlots();
  const photoFiles = selectedPhotoFiles(elements.newPhotos);
  const court = {
    ...(existing || {}),
    id: existing?.id || `${slugify(name)}-${Date.now()}`,
    name,
    address: elements.newAddress.value.trim(),
    city: elements.newCity.value.trim(),
    state: elements.newState.value.trim().toUpperCase(),
    country: existing?.country || 'USA',
    latitude: lat,
    longitude: lng,
    icon: existing?.icon || DEFAULT_ICON,
    access,
    isFree: access === 'public',
    openPlayFee,
    openPlay,
    skillLevels,
    estimatedSkillLevel,
    courts: {
      count: courtCount,
      surface: existing?.courts?.surface || 'unknown',
      indoorOutdoor: existing?.courts?.indoorOutdoor || 'unknown'
    },
    photos: existing?.photos || [],
    notes: elements.newNotes.value.trim(),
    sourceUrl: existing?.sourceUrl || '',
    lastVerified: todayIso(),
    userSubmitted: existing?.userSubmitted ?? true,
    submittedBy: existing?.submittedBy || state.currentUser.id,
    submittedByUsername: existing?.submittedByUsername || state.currentUser.username,
    createdAt: existing?.createdAt || todayIso(),
    updatedAt: existing ? todayIso() : '',
    status: existing?.status || (canEditLocations() ? 'approved' : 'pending')
  };

  if (isSuggestingEdit) {
    const reason = elements.suggestEditReason.value.trim();
    if (!reason) {
      elements.formHint.textContent = 'Add a short note explaining why this edit should be reviewed.';
      elements.suggestEditReason.focus();
      return;
    }
    if (!hasEditableLocationChanges(existing, court)) {
      elements.formHint.textContent = 'Change at least one location field before submitting a suggested edit.';
      return;
    }
    try {
      await saveSuggestedLocationEdit(existing, court, reason);
      elements.locationForm.reset();
      closeSubmitDialog();
      window.alert('Thanks. Your suggested edit was sent to admin for approval.');
    } catch (error) {
      console.error(error);
      elements.formHint.textContent = error.message || 'Could not submit that suggested edit.';
    }
    return;
  }

  if (existing?.remoteId && canEditLocations() && window.OpenPlaySupabase?.saveAdminLocation) {
    try {
      const savedCourt = await window.OpenPlaySupabase.saveAdminLocation(court);
      if (photoFiles.length && window.OpenPlaySupabase?.submitLocationPhotos) {
        await window.OpenPlaySupabase.submitLocationPhotos(savedCourt, state.currentUser, photoFiles);
      }
      state.courts = state.courts.map(item => item.id === court.id ? savedCourt : item);
      elements.locationForm.reset();
      closeSubmitDialog();
      render();
      focusCourt(savedCourt.id, 'location_saved');
    } catch (error) {
      console.error(error);
      elements.formHint.textContent = error.message || 'Could not save that location.';
    }
    return;
  }

  if (!existing && window.OpenPlaySupabase?.submitLocation) {
    try {
      elements.formHint.textContent = photoFiles.length ? 'Uploading photos and submitting location...' : 'Submitting location...';
      await window.OpenPlaySupabase.submitLocation(court, state.currentUser, photoFiles);
      elements.locationForm.reset();
      closeSubmitDialog();
      window.alert('Thanks. Your location was submitted for admin approval before it appears on the map.');
    } catch (error) {
      console.error(error);
      elements.formHint.textContent = error.message || 'Could not submit that location.';
    }
    return;
  }

  upsertSavedLocation(court);

  if (existing) {
    state.courts = state.courts.map(item => item.id === court.id ? court : item);
  } else {
    if (court.status === 'approved') {
      state.courts.push(court);
    }
    awardCredits({
      action: 'add-location',
      targetType: 'location',
      targetId: court.id,
      status: court.status === 'approved' ? 'approved' : 'pending'
    });
  }

  elements.locationForm.reset();
  closeSubmitDialog();
  render();
  if (court.status === 'approved') {
    focusCourt(court.id, 'location_saved');
  } else {
    window.alert('Thanks. Your location was submitted for admin approval before it appears on the map.');
  }
}

async function init() {
  await loadCurrentUser();
  renderUserPanel();
  syncMobileHeaderHeight();
  setMobileSheetMode('map');

  const savedStyle = localStorage.getItem(MAP_STYLE_KEY) || 'voyager';
  elements.mapStyle.value = tileStyles[savedStyle] ? savedStyle : 'voyager';
  setMapStyle(elements.mapStyle.value);

  const seedCourts = await loadSeedCourts();
  state.courts = mergeSavedLocations(seedCourts, getSavedSubmissions());
  await loadBackendCollections();
  const sharedLocationId = new URLSearchParams(window.location.search).get('location');
  if (sharedLocationId) {
    render();
    focusSharedLocationFromUrl();
  } else {
    fitMapToLoadedCourts();
    render();
  }
}

async function loadSeedCourts() {
  try {
    const remoteCourts = await window.OpenPlaySupabase?.fetchApprovedLocations?.();
    if (remoteCourts?.length) {
      trackAnalyticsEvent('backend_locations_loaded', {
        source: 'supabase',
        count: remoteCourts.length
      });
      return remoteCourts;
    }
  } catch (error) {
    console.warn('Supabase location load failed. Falling back to static JSON.', error);
    trackAnalyticsEvent('backend_locations_failed', {
      source: 'supabase'
    });
  }

  const response = await fetch('data/courts.json');
  const staticCourts = await response.json();
  trackAnalyticsEvent('backend_locations_loaded', {
    source: 'static_json',
    count: staticCourts.length
  });
  return staticCourts;
}

function fitMapToLoadedCourts() {
  const points = state.courts
    .filter(court => typeof court.latitude === 'number' && typeof court.longitude === 'number')
    .map(court => [court.latitude, court.longitude]);

  if (!points.length) return;
  if (points.length === 1) {
    map.setView(points[0], isMobileLayout() ? 10 : 11);
    return;
  }

  map.fitBounds(L.latLngBounds(points), {
    padding: isMobileLayout() ? [44, 44] : [70, 70],
    maxZoom: isMobileLayout() ? 9 : 10,
    animate: false
  });
}

[elements.accessFilter, elements.skillFilter, elements.dayFilter, elements.timeFilter, elements.settingFilter, elements.reliabilityFilter].forEach(element => {
  element.addEventListener('input', render);
});

elements.filterToggle.addEventListener('click', () => {
  const isOpen = !elements.filterPanel.hidden;
  elements.filterPanel.hidden = isOpen;
  elements.filterToggle.setAttribute('aria-expanded', String(!isOpen));
});

elements.resetFilters.addEventListener('click', resetFilters);

let headerPlaceSearchTimer;
elements.search.addEventListener('input', () => {
  state.areaSearchActive = false;
  clearTimeout(headerPlaceSearchTimer);
  headerPlaceSearchTimer = setTimeout(searchHeaderPlaces, 350);
});

elements.search.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    elements.headerPlaceResults.innerHTML = '';
  }
});

document.addEventListener('click', event => {
  if (!event.target.closest('.header-location-search')) {
    elements.headerPlaceResults.innerHTML = '';
  }
  if (!event.target.closest('.header-filter')) {
    elements.filterPanel.hidden = true;
    elements.filterToggle.setAttribute('aria-expanded', 'false');
  }
});

elements.mapStyle.addEventListener('change', event => {
  setMapStyle(event.target.value);
});

document.querySelectorAll('[data-open-submit]').forEach(button => {
  button.addEventListener('click', openSubmitDialog);
});

setupMobileSheetDrag();
preventPageZoomOverMap();

window.addEventListener('resize', () => {
  syncMobileHeaderHeight();
  if (!isMobileLayout()) {
    document.body.classList.remove('mobile-map-focus');
    document.body.classList.remove('mobile-list-full');
  }
});

window.addEventListener('open-play-session-changed', async () => {
  await loadCurrentUser();
  await loadBackendCollections();
  renderUserPanel();
  render();
});

window.OpenPlayAuth?.onAuthStateChange?.(() => {
  window.dispatchEvent(new CustomEvent('open-play-session-changed'));
});

document.addEventListener('click', event => {
  if (!event.target.closest('.card-menu')) closeCardMenus();
  if (!event.target.closest('[data-location-menu-wrapper]')) closeLocationMenus();
});

document.addEventListener('keydown', event => {
  if (state.photoLightbox.element?.hidden !== false) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closePhotoLightbox();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    stepPhotoLightbox(-1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    stepPhotoLightbox(1);
  }
});

document.querySelectorAll('[data-close-submit]').forEach(button => {
  button.addEventListener('click', closeSubmitDialog);
});

document.querySelectorAll('[data-close-review]').forEach(button => {
  button.addEventListener('click', closeReviewDialog);
});

elements.locationForm.addEventListener('submit', addSubmittedLocation);
elements.newAccess.addEventListener('change', updateOpenPlayFeeField);
elements.reviewForm.addEventListener('submit', submitReview);
elements.reviewForm.addEventListener('input', updateReviewRequirement);
elements.reviewForm.addEventListener('change', updateReviewRequirement);
elements.placeSearchButton.addEventListener('click', searchPlaces);
elements.addTimeWindow.addEventListener('click', () => addTimeWindow());
elements.openDayAll.addEventListener('change', () => {
  elements.newDays.querySelectorAll('input[name="openDay"]').forEach(input => {
    input.checked = elements.openDayAll.checked;
  });
  updateOpenPlayDaysSummary();
});
elements.newDays.querySelectorAll('input[name="openDay"]').forEach(input => {
  input.addEventListener('change', updateOpenPlayDaysSummary);
});

let placeSearchTimer;
elements.placeSearch.addEventListener('input', () => {
  clearTimeout(placeSearchTimer);
  placeSearchTimer = setTimeout(searchPlaces, 350);
});

elements.placeSearch.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    clearTimeout(placeSearchTimer);
    searchPlaces();
  }
});

map.on('click', event => {
  if (elements.submitDialog.open) {
    setDraftLocation(event.latlng.lat, event.latlng.lng);
  }
});

map.on('moveend', () => {
  render();
  if (state.activeInfoCourtId) {
    const court = state.courts.find(item => item.id === state.activeInfoCourtId);
    if (court) positionMapInfoBox(court);
  }
});

init().catch(error => {
  console.error(error);
  elements.resultCount.textContent = 'Could not load open play pickleball court data.';
});
