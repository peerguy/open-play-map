const USERS_KEY = 'open-play-map-users';
const STORAGE_KEY = 'open-play-map-submissions';
const REVIEWS_KEY = 'open-play-map-reviews';
const CREDITS_KEY = 'open-play-map-credits';
const DELETED_LOCATIONS_KEY = 'open-play-map-deleted-locations';
const REPORTS_KEY = 'open-play-map-reports';
const EDITS_KEY = 'open-play-map-suggested-edits';

const DAILY_LOCATION_LIMIT = 10;
const DAILY_REVIEW_LIMIT = 10;
const SUGGESTED_EDIT_CREDITS = 3;
const INSTAGRAM_MAX_IMAGES = 10;
const INSTAGRAM_SQUARE_IMAGE_SIZE = 1080;
const PENDING_IMAGE_EDITOR_JPEG_QUALITY = 0.86;
const DEFAULT_INSTAGRAM_COLLABORATORS = ['scooppickleball'];
const INSTAGRAM_MAX_COLLABORATORS = 5;
const LOCAL_PROTOTYPE_HOSTS = new Set(['', 'localhost', '127.0.0.1']);
const PRODUCTION_DATABASE_UNAVAILABLE = 'The production database is unavailable, so this was not saved. Please try again in a few minutes.';

const SKILL_LEVELS = {
  beginner: 'Beginner: Under 3.0',
  intermediate: 'Intermediate: 3.0-4.0',
  advanced: 'Advanced: 4.0+'
};

const LOCATION_SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];
const OPEN_PLAY_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const REVIEW_STATUS_OPTIONS = [
  ['published', 'Published'],
  ['hidden', 'Hidden'],
  ['removed', 'Removed']
];
const REVIEW_CROWD_OPTIONS = ['', 'Light', 'Moderate', 'Packed'];
const REVIEW_RELIABILITY_OPTIONS = ['', 'Confirmed', 'Sometimes active', 'Uncertain'];
const REVIEW_NET_OPTIONS = ['', 'Permanent nets', 'Portable nets', 'Bring your own net'];
const REVIEW_FORMAT_OPTIONS = ['', 'Paddle stack', 'Challenge court', 'Round robin', 'Casual'];
const REVIEW_BEGINNER_OPTIONS = ['', 'Welcoming', 'Neutral', 'Competitive'];
const REVIEW_FEES_OPTIONS = ['', 'Free', 'Drop-in fee', 'Membership required'];
const REVIEW_AMENITIES_OPTIONS = ['', 'Bathroom and water', 'Bathroom only', 'Water only', 'Neither'];
const REVIEW_LIGHTING_OPTIONS = ['', 'Good for night play', 'Limited', 'None'];

const elements = {
  guard: document.querySelector('#adminGuard'),
  moderationView: document.querySelector('#moderationAdminView'),
  postsView: document.querySelector('#postsAdminView'),
  usersView: document.querySelector('#usersAdminView'),
  locationsView: document.querySelector('#locationsAdminView'),
  drawingsView: document.querySelector('#drawingsAdminView'),
  moderationList: document.querySelector('#adminModerationList'),
  postsList: document.querySelector('#adminPostsList'),
  postsSearch: document.querySelector('#postAdminSearch'),
  usersList: document.querySelector('#adminUsersList'),
  locationsList: document.querySelector('#adminLocationsList'),
  drawingsList: document.querySelector('#adminDrawingsList'),
  moderationTitle: document.querySelector('#moderationAdminTitle'),
  postsTitle: document.querySelector('#postsAdminTitle'),
  usersTitle: document.querySelector('#usersAdminTitle'),
  locationsTitle: document.querySelector('#locationsAdminTitle'),
  drawingsTitle: document.querySelector('#drawingsAdminTitle'),
  moderationCount: document.querySelector('#moderationAdminCount'),
  postsCount: document.querySelector('#postAdminCount'),
  userCount: document.querySelector('#userAdminCount'),
  locationCount: document.querySelector('#locationAdminCount'),
  drawingCount: document.querySelector('#drawingAdminCount'),
  navButtons: document.querySelectorAll('[data-admin-view]'),
  moderationSubnav: document.querySelector('#moderationSubnav'),
  moderationNavButtons: document.querySelectorAll('[data-moderation-view]'),
  locationsSubnav: document.querySelector('#locationsSubnav'),
  locationNavButtons: document.querySelectorAll('[data-location-view]'),
  deleteDialog: document.querySelector('#adminDeleteDialog'),
  deleteForm: document.querySelector('#adminDeleteForm'),
  deleteMessage: document.querySelector('#adminDeleteMessage')
};

let allCourts = [];
let activeModerationView = 'pending';
let activeLocationView = 'approved';
let pendingPostSearchQuery = '';
let authUsers = null;
let currentAdminUser = null;
let deleteConfirmationRequest = null;
let backendCollections = {
  reviews: null,
  reports: null,
  suggestedEdits: null,
  credits: null,
  photos: null,
  instagramPosts: null,
  rewardPeriods: null
};
const adminPhotoLightbox = {
  element: null,
  image: null,
  caption: null,
  previousButton: null,
  nextButton: null,
  closeButton: null,
  photos: [],
  index: 0,
  trigger: null
};
const pendingImageEditor = {
  element: null,
  canvas: null,
  context: null,
  saveButton: null,
  hint: null,
  form: null,
  row: null,
  input: null,
  court: null,
  formHint: null,
  trigger: null,
  image: null,
  objectUrl: '',
  loadId: 0,
  mode: 'fill',
  zoom: 100,
  positionX: 0,
  positionY: 0,
  background: '#ffffff',
  activePointerId: null,
  dragStart: null
};

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatAdminDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

function formatAdminMonth(value) {
  if (!value) return 'Drawing month';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: 'long',
    year: 'numeric'
  });
}

function formatAdminNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return number.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function allowPrototypeContributionStorage() {
  return LOCAL_PROTOTYPE_HOSTS.has(window.location.hostname);
}

function readPrototypeStorage(key, fallback) {
  if (!allowPrototypeContributionStorage()) return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writePrototypeStorage(key, value) {
  if (!allowPrototypeContributionStorage()) {
    throw new Error(PRODUCTION_DATABASE_UNAVAILABLE);
  }
  localStorage.setItem(key, JSON.stringify(value));
}

function photoUrl(photo) {
  if (typeof photo === 'string') return photo.trim();
  return String(photo?.url || photo?.storagePath || photo?.storage_path || '').trim();
}

function photoUrlList(photos = []) {
  return (photos || []).map(photoUrl).filter(Boolean);
}

function selectOptions(options, selected = '') {
  return options.map(option => {
    const value = Array.isArray(option) ? option[0] : option;
    const label = Array.isArray(option) ? option[1] : (option || 'Not sure');
    return `<option value="${escapeHtml(value)}"${String(selected || '') === String(value) ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function ensureAdminPhotoLightbox() {
  if (adminPhotoLightbox.element) return adminPhotoLightbox.element;

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

  adminPhotoLightbox.element = lightbox;
  adminPhotoLightbox.image = lightbox.querySelector('.photo-lightbox-image');
  adminPhotoLightbox.caption = lightbox.querySelector('.photo-lightbox-caption');
  adminPhotoLightbox.previousButton = lightbox.querySelector('.photo-lightbox-prev');
  adminPhotoLightbox.nextButton = lightbox.querySelector('.photo-lightbox-next');
  adminPhotoLightbox.closeButton = lightbox.querySelector('.photo-lightbox-close');

  adminPhotoLightbox.closeButton.addEventListener('click', closeAdminPhotoLightbox);
  adminPhotoLightbox.previousButton.addEventListener('click', () => stepAdminPhotoLightbox(-1));
  adminPhotoLightbox.nextButton.addEventListener('click', () => stepAdminPhotoLightbox(1));
  lightbox.addEventListener('click', event => {
    if (event.target === lightbox) closeAdminPhotoLightbox();
  });

  document.body.append(lightbox);
  return lightbox;
}

function updateAdminPhotoLightbox() {
  const { photos, index, image, caption, previousButton, nextButton } = adminPhotoLightbox;
  if (!photos.length || !image || !caption) return;

  const photo = photos[index];
  image.src = photo.url;
  image.alt = photo.alt || `Review photo ${index + 1}`;
  caption.textContent = `${photo.caption || 'Review photo'} · ${index + 1} of ${photos.length}`;
  const hasMultiplePhotos = photos.length > 1;
  previousButton.hidden = !hasMultiplePhotos;
  nextButton.hidden = !hasMultiplePhotos;
}

function openAdminPhotoLightbox(photos, index = 0, trigger = null) {
  if (!photos.length) return;
  const lightbox = ensureAdminPhotoLightbox();
  adminPhotoLightbox.photos = photos;
  adminPhotoLightbox.index = Math.max(0, Math.min(Number(index) || 0, photos.length - 1));
  adminPhotoLightbox.trigger = trigger;
  lightbox.hidden = false;
  document.body.classList.add('has-photo-lightbox');
  updateAdminPhotoLightbox();
  requestAnimationFrame(() => adminPhotoLightbox.closeButton?.focus());
}

function closeAdminPhotoLightbox() {
  const { element, image, trigger } = adminPhotoLightbox;
  if (!element || element.hidden) return;
  element.hidden = true;
  document.body.classList.remove('has-photo-lightbox');
  if (image) image.removeAttribute('src');
  adminPhotoLightbox.photos = [];
  adminPhotoLightbox.index = 0;
  adminPhotoLightbox.trigger = null;
  trigger?.focus?.();
}

function stepAdminPhotoLightbox(delta) {
  const { photos } = adminPhotoLightbox;
  if (photos.length <= 1) return;
  adminPhotoLightbox.index = (adminPhotoLightbox.index + delta + photos.length) % photos.length;
  updateAdminPhotoLightbox();
}

function safePendingImageFilePart(value) {
  return String(value || 'instagram-square')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'instagram-square';
}

function setPendingImageEditorHint(message = '') {
  if (pendingImageEditor.hint) pendingImageEditor.hint.textContent = message;
}

function clearPendingImageEditorImage() {
  if (pendingImageEditor.objectUrl) URL.revokeObjectURL(pendingImageEditor.objectUrl);
  pendingImageEditor.image = null;
  pendingImageEditor.objectUrl = '';
}

function resetPendingImageEditorState() {
  const trigger = pendingImageEditor.trigger;
  clearPendingImageEditorImage();
  pendingImageEditor.form = null;
  pendingImageEditor.row = null;
  pendingImageEditor.input = null;
  pendingImageEditor.court = null;
  pendingImageEditor.formHint = null;
  pendingImageEditor.trigger = null;
  pendingImageEditor.loadId += 1;
  pendingImageEditor.activePointerId = null;
  pendingImageEditor.dragStart = null;
  pendingImageEditor.mode = 'fill';
  pendingImageEditor.zoom = 100;
  pendingImageEditor.positionX = 0;
  pendingImageEditor.positionY = 0;
  pendingImageEditor.background = '#ffffff';
  trigger?.focus?.();
}

function closePendingImageEditor() {
  if (!pendingImageEditor.element) return;
  closeAdminDialog(pendingImageEditor.element);
}

function ensurePendingImageEditor() {
  if (pendingImageEditor.element) return pendingImageEditor.element;

  const dialog = document.createElement('dialog');
  dialog.className = 'pending-image-dialog';
  dialog.innerHTML = `
    <div class="pending-image-dialog-panel">
      <div class="pending-image-dialog-header">
        <div>
          <p class="eyebrow">Instagram image</p>
          <h2>Square editor</h2>
        </div>
        <button class="pending-image-dialog-close" type="button" data-pending-square-close aria-label="Close square editor">&times;</button>
      </div>
      <div class="pending-image-dialog-body">
        <div class="pending-image-canvas-shell">
          <canvas class="pending-image-canvas" width="${INSTAGRAM_SQUARE_IMAGE_SIZE}" height="${INSTAGRAM_SQUARE_IMAGE_SIZE}" data-pending-square-canvas aria-label="Square image preview"></canvas>
        </div>
        <div class="pending-image-controls">
          <div class="pending-image-segmented" role="group" aria-label="Square image mode">
            <button type="button" data-pending-square-mode="fill">Fill</button>
            <button type="button" data-pending-square-mode="fit">Fit</button>
          </div>
          <label>
            Zoom
            <input type="range" min="100" max="300" step="1" value="100" data-pending-square-zoom />
          </label>
          <label>
            Horizontal
            <input type="range" min="-100" max="100" step="1" value="0" data-pending-square-x />
          </label>
          <label>
            Vertical
            <input type="range" min="-100" max="100" step="1" value="0" data-pending-square-y />
          </label>
          <label class="pending-image-background-field">
            Background
            <input type="color" value="#ffffff" data-pending-square-background />
          </label>
          <div class="pending-image-dialog-actions">
            <button class="secondary-button" type="button" data-pending-square-reset>Reset</button>
            <button class="secondary-button admin-approve-button" type="button" data-pending-square-save>Save square image</button>
          </div>
          <p class="form-hint" data-pending-square-hint></p>
        </div>
      </div>
    </div>
  `;

  pendingImageEditor.element = dialog;
  pendingImageEditor.canvas = dialog.querySelector('[data-pending-square-canvas]');
  pendingImageEditor.context = pendingImageEditor.canvas?.getContext('2d') || null;
  pendingImageEditor.saveButton = dialog.querySelector('[data-pending-square-save]');
  pendingImageEditor.hint = dialog.querySelector('[data-pending-square-hint]');

  dialog.querySelector('[data-pending-square-close]')?.addEventListener('click', closePendingImageEditor);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closePendingImageEditor();
  });
  dialog.addEventListener('close', resetPendingImageEditorState);
  dialog.querySelectorAll('[data-pending-square-mode]').forEach(button => {
    button.addEventListener('click', () => {
      pendingImageEditor.mode = button.dataset.pendingSquareMode || 'fill';
      pendingImageEditor.zoom = 100;
      pendingImageEditor.positionX = 0;
      pendingImageEditor.positionY = 0;
      updatePendingImageEditorControls();
      drawPendingImageEditorPreview();
    });
  });
  dialog.querySelector('[data-pending-square-zoom]')?.addEventListener('input', event => {
    pendingImageEditor.zoom = Number(event.target.value) || 100;
    drawPendingImageEditorPreview();
  });
  dialog.querySelector('[data-pending-square-x]')?.addEventListener('input', event => {
    pendingImageEditor.positionX = Number(event.target.value) || 0;
    drawPendingImageEditorPreview();
  });
  dialog.querySelector('[data-pending-square-y]')?.addEventListener('input', event => {
    pendingImageEditor.positionY = Number(event.target.value) || 0;
    drawPendingImageEditorPreview();
  });
  dialog.querySelector('[data-pending-square-background]')?.addEventListener('input', event => {
    pendingImageEditor.background = event.target.value || '#ffffff';
    drawPendingImageEditorPreview();
  });
  dialog.querySelector('[data-pending-square-reset]')?.addEventListener('click', () => {
    pendingImageEditor.mode = 'fill';
    pendingImageEditor.zoom = 100;
    pendingImageEditor.positionX = 0;
    pendingImageEditor.positionY = 0;
    pendingImageEditor.background = '#ffffff';
    updatePendingImageEditorControls();
    drawPendingImageEditorPreview();
  });
  pendingImageEditor.saveButton?.addEventListener('click', savePendingImageEditor);
  pendingImageEditor.canvas?.addEventListener('pointerdown', startPendingImageEditorDrag);
  pendingImageEditor.canvas?.addEventListener('pointermove', movePendingImageEditorDrag);
  pendingImageEditor.canvas?.addEventListener('pointerup', endPendingImageEditorDrag);
  pendingImageEditor.canvas?.addEventListener('pointercancel', endPendingImageEditorDrag);

  document.body.append(dialog);
  return dialog;
}

function updatePendingImageEditorControls() {
  const dialog = pendingImageEditor.element;
  if (!dialog) return;
  dialog.querySelectorAll('[data-pending-square-mode]').forEach(button => {
    const active = button.dataset.pendingSquareMode === pendingImageEditor.mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const zoom = dialog.querySelector('[data-pending-square-zoom]');
  const x = dialog.querySelector('[data-pending-square-x]');
  const y = dialog.querySelector('[data-pending-square-y]');
  const background = dialog.querySelector('[data-pending-square-background]');
  if (zoom) zoom.value = String(pendingImageEditor.zoom);
  if (x) x.value = String(pendingImageEditor.positionX);
  if (y) y.value = String(pendingImageEditor.positionY);
  if (background) background.value = pendingImageEditor.background;
}

function pendingImageEditorGeometry() {
  const image = pendingImageEditor.image;
  if (!image) return null;
  const size = INSTAGRAM_SQUARE_IMAGE_SIZE;
  const sourceWidth = image.naturalWidth || image.width || 1;
  const sourceHeight = image.naturalHeight || image.height || 1;
  const baseScale = pendingImageEditor.mode === 'fit'
    ? Math.min(size / sourceWidth, size / sourceHeight)
    : Math.max(size / sourceWidth, size / sourceHeight);
  const scale = baseScale * ((Number(pendingImageEditor.zoom) || 100) / 100);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const maxOffsetX = Math.abs((size - drawWidth) / 2);
  const maxOffsetY = Math.abs((size - drawHeight) / 2);
  const offsetX = maxOffsetX * ((Number(pendingImageEditor.positionX) || 0) / 100);
  const offsetY = maxOffsetY * ((Number(pendingImageEditor.positionY) || 0) / 100);

  return {
    drawWidth,
    drawHeight,
    maxOffsetX,
    maxOffsetY,
    x: (size - drawWidth) / 2 + offsetX,
    y: (size - drawHeight) / 2 + offsetY
  };
}

function drawPendingImageEditorPreview() {
  const { context, canvas, image } = pendingImageEditor;
  if (!context || !canvas) return;

  context.fillStyle = pendingImageEditor.background || '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (!image) return;

  const geometry = pendingImageEditorGeometry();
  if (!geometry) return;
  context.drawImage(image, geometry.x, geometry.y, geometry.drawWidth, geometry.drawHeight);
}

function startPendingImageEditorDrag(event) {
  if (!pendingImageEditor.image) return;
  pendingImageEditor.activePointerId = event.pointerId;
  pendingImageEditor.dragStart = {
    clientX: event.clientX,
    clientY: event.clientY,
    positionX: pendingImageEditor.positionX,
    positionY: pendingImageEditor.positionY
  };
  pendingImageEditor.canvas?.setPointerCapture?.(event.pointerId);
}

function movePendingImageEditorDrag(event) {
  if (pendingImageEditor.activePointerId !== event.pointerId || !pendingImageEditor.dragStart) return;
  const geometry = pendingImageEditorGeometry();
  const rect = pendingImageEditor.canvas?.getBoundingClientRect?.();
  if (!geometry || !rect?.width || !rect?.height) return;

  const canvasScale = INSTAGRAM_SQUARE_IMAGE_SIZE / rect.width;
  const dx = (event.clientX - pendingImageEditor.dragStart.clientX) * canvasScale;
  const dy = (event.clientY - pendingImageEditor.dragStart.clientY) * canvasScale;
  pendingImageEditor.positionX = geometry.maxOffsetX
    ? Math.max(-100, Math.min(100, pendingImageEditor.dragStart.positionX + (dx / geometry.maxOffsetX) * 100))
    : 0;
  pendingImageEditor.positionY = geometry.maxOffsetY
    ? Math.max(-100, Math.min(100, pendingImageEditor.dragStart.positionY + (dy / geometry.maxOffsetY) * 100))
    : 0;
  updatePendingImageEditorControls();
  drawPendingImageEditorPreview();
}

function endPendingImageEditorDrag(event) {
  if (pendingImageEditor.activePointerId !== event.pointerId) return;
  pendingImageEditor.canvas?.releasePointerCapture?.(event.pointerId);
  pendingImageEditor.activePointerId = null;
  pendingImageEditor.dragStart = null;
}

function loadPendingImageForEditor(imageUrl) {
  return fetch(imageUrl)
    .then(response => {
      if (!response.ok) throw new Error(`Could not read image: ${response.status}`);
      return response.blob();
    })
    .then(blob => new Promise((resolve, reject) => {
      if (!String(blob.type || '').startsWith('image/')) {
        reject(new Error('Choose a JPG, PNG, or WebP image URL.'));
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => resolve({ image, objectUrl });
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to load that image.'));
      };
      image.src = objectUrl;
    }));
}

function pendingImageCanvasToBlob() {
  return new Promise((resolve, reject) => {
    const canvas = pendingImageEditor.canvas;
    if (!canvas) {
      reject(new Error('Could not save that square image.'));
      return;
    }
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Could not save that square image.'));
    }, 'image/jpeg', PENDING_IMAGE_EDITOR_JPEG_QUALITY);
  });
}

function pendingImageCanvasToFile(court = {}) {
  return pendingImageCanvasToBlob().then(blob => new File([blob], `${safePendingImageFilePart(court.name)}-square.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now()
  }));
}

function upsertBackendInstagramPost(post) {
  if (!post || !backendCollections.instagramPosts) return;
  const posts = backendCollections.instagramPosts;
  const index = posts.findIndex(item => item.id === post.id || item.locationId === post.locationId);
  if (index >= 0) {
    posts[index] = post;
  } else {
    posts.push(post);
  }
}

async function savePendingImageEditor() {
  const { form, input, court, formHint, saveButton } = pendingImageEditor;
  if (!form || !input || !court) return;
  if (!pendingImageEditor.image) {
    setPendingImageEditorHint('Load an image before saving.');
    return;
  }
  if (!window.OpenPlaySupabase?.uploadInstagramDraftImages) {
    setPendingImageEditorHint('Image upload is unavailable right now.');
    return;
  }

  if (saveButton) saveButton.disabled = true;
  setPendingImageEditorHint('Saving square image...');

  try {
    const user = await currentUser();
    if (!user?.id) throw new Error('Sign in again before saving images.');
    const file = await pendingImageCanvasToFile(court);
    const urls = await window.OpenPlaySupabase.uploadInstagramDraftImages(court, user, [file]);
    const squareUrl = urls[0];
    if (!squareUrl) throw new Error('Could not save that square image.');

    input.value = squareUrl;
    updatePendingPostImageThumb(input);
    updatePendingPostPreview(form);
    const post = await window.OpenPlaySupabase.savePendingInstagramPostImages?.(
      court.remoteId,
      pendingPostImageUrls(form),
      currentAdminUser?.id || user.id
    );
    upsertBackendInstagramPost(post);
    if (formHint) formHint.textContent = 'Square image saved.';
    closePendingImageEditor();
  } catch (error) {
    setPendingImageEditorHint(error.message || 'Could not save that square image.');
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

async function openPendingImageEditor(form, court, button, formHint) {
  const row = button.closest('[data-pending-image-row]');
  const input = row?.querySelector('[data-pending-image-url]');
  const imageUrl = input?.value.trim();
  if (!imageUrl) {
    if (formHint) formHint.textContent = 'Add an image URL before editing.';
    return;
  }

  const dialog = ensurePendingImageEditor();
  clearPendingImageEditorImage();
  pendingImageEditor.form = form;
  pendingImageEditor.row = row;
  pendingImageEditor.input = input;
  pendingImageEditor.court = court;
  pendingImageEditor.formHint = formHint;
  pendingImageEditor.trigger = button;
  pendingImageEditor.mode = 'fill';
  pendingImageEditor.zoom = 100;
  pendingImageEditor.positionX = 0;
  pendingImageEditor.positionY = 0;
  pendingImageEditor.background = '#ffffff';
  pendingImageEditor.loadId += 1;
  const loadId = pendingImageEditor.loadId;
  updatePendingImageEditorControls();
  drawPendingImageEditorPreview();
  if (pendingImageEditor.saveButton) pendingImageEditor.saveButton.disabled = true;
  setPendingImageEditorHint('Loading image...');
  openAdminDialog(dialog);

  try {
    const { image, objectUrl } = await loadPendingImageForEditor(imageUrl);
    if (pendingImageEditor.loadId !== loadId) {
      URL.revokeObjectURL(objectUrl);
      return;
    }
    pendingImageEditor.image = image;
    pendingImageEditor.objectUrl = objectUrl;
    if (pendingImageEditor.saveButton) pendingImageEditor.saveButton.disabled = false;
    setPendingImageEditorHint('');
    drawPendingImageEditorPreview();
  } catch (error) {
    if (pendingImageEditor.loadId !== loadId) return;
    setPendingImageEditorHint(error.message || 'Could not load that image.');
  }
}

function adminReviewPhotosFromButton(button) {
  return [...button.closest('.admin-review-photo-list')?.querySelectorAll('[data-admin-review-photo-url]') || []]
    .map((item, index) => ({
      url: item.dataset.adminReviewPhotoUrl,
      alt: item.dataset.adminReviewPhotoAlt || '',
      caption: item.dataset.adminReviewPhotoCaption || 'Review photo',
      index
    }))
    .filter(photo => photo.url);
}

function adminModerationPhotosFromButton(button) {
  return [...elements.moderationList.querySelectorAll('[data-open-admin-moderation-photo]')]
    .map((item, index) => ({
      url: item.dataset.adminModerationPhotoUrl,
      alt: item.dataset.adminModerationPhotoAlt || '',
      caption: item.dataset.adminModerationPhotoCaption || 'Pending photo',
      index
    }))
    .filter(photo => photo.url);
}

function getUsers() {
  if (Array.isArray(authUsers)) return authUsers;

  const users = readPrototypeStorage(USERS_KEY, []);
  const migratedUsers = migrateUserSkillLevels(users);
  if (allowPrototypeContributionStorage() && JSON.stringify(users) !== JSON.stringify(migratedUsers)) {
    saveUsers(migratedUsers);
    migratedUsers.forEach(syncUserAttribution);
  }
  return migratedUsers;
}

function saveUsers(users) {
  writePrototypeStorage(USERS_KEY, users);
}

function getSavedSubmissions() {
  return readPrototypeStorage(STORAGE_KEY, []);
}

function saveSubmissions(submissions) {
  writePrototypeStorage(STORAGE_KEY, submissions);
}

function getDeletedLocationIds() {
  return readPrototypeStorage(DELETED_LOCATIONS_KEY, []);
}

function saveDeletedLocationIds(ids) {
  writePrototypeStorage(DELETED_LOCATIONS_KEY, ids);
}

function getSavedReviews() {
  if (backendCollections.reviews) return backendCollections.reviews;
  return readPrototypeStorage(REVIEWS_KEY, {});
}

function saveReviews(reviews) {
  if (backendCollections.reviews) {
    backendCollections.reviews = reviews;
    return;
  }
  writePrototypeStorage(REVIEWS_KEY, reviews);
}

function getSavedCredits() {
  if (backendCollections.credits) return backendCollections.credits;
  return readPrototypeStorage(CREDITS_KEY, []);
}

function saveCredits(credits) {
  if (backendCollections.credits) {
    backendCollections.credits = credits;
    return;
  }
  writePrototypeStorage(CREDITS_KEY, credits);
}

function getSavedReports() {
  if (backendCollections.reports) return backendCollections.reports;
  return readPrototypeStorage(REPORTS_KEY, []);
}

function saveReports(reports) {
  if (backendCollections.reports) {
    backendCollections.reports = reports;
    return;
  }
  writePrototypeStorage(REPORTS_KEY, reports);
}

function getSavedSuggestedEdits() {
  if (backendCollections.suggestedEdits) return backendCollections.suggestedEdits;
  return readPrototypeStorage(EDITS_KEY, []);
}

function saveSuggestedEdits(edits) {
  if (backendCollections.suggestedEdits) {
    backendCollections.suggestedEdits = edits;
    return;
  }
  writePrototypeStorage(EDITS_KEY, edits);
}

function getCreditBalances(userId) {
  return getSavedCredits()
    .filter(credit => credit.userId === userId && (credit.status === 'approved' || !credit.status))
    .reduce((balances, credit) => ({
      active: balances.active + Number(credit.activeCreditsDelta || 0),
      lifetime: balances.lifetime + Number(credit.lifetimeCreditsDelta || 0)
    }), { active: 0, lifetime: 0 });
}

function skillLevelFromDupr(dupr) {
  const value = Number.parseFloat(dupr);
  if (!Number.isFinite(value)) return 'beginner';
  if (value < 3) return 'beginner';
  if (value < 4) return 'intermediate';
  return 'advanced';
}

function normalizeSkillLevel(value, fallback = '') {
  return Object.hasOwn(SKILL_LEVELS, value) ? value : fallback;
}

function skillLevelOptions(selected) {
  const current = normalizeSkillLevel(selected);
  return [
    `<option value=""${current ? '' : ' selected'}>No skill level selected</option>`,
    ...Object.entries(SKILL_LEVELS)
    .map(([value, label]) => `<option value="${value}"${current === value ? ' selected' : ''}>${label}</option>`)
  ]
    .join('');
}

function skillLevelLabel(value) {
  return SKILL_LEVELS[normalizeSkillLevel(value)] || '';
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

function isValidLatitude(value) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function formatOpenPlayFee(value) {
  const fee = normalizeOpenPlayFee(value);
  if (fee === null) return '';
  return `$${Number.isInteger(fee) ? fee : fee.toFixed(2)}`;
}

function normalizeWebsiteUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function normalizedPhoneNumber(value) {
  return String(value || '').trim();
}

function accessLabel(court = {}) {
  const feeLabel = formatOpenPlayFee(court.openPlayFee);
  if (feeLabel) return `Public fee (${feeLabel})`;
  if (court.access === 'paid' || court.isFree === false) return 'Paid/public fee';
  return 'Free/public';
}

function updateAdminOpenPlayFeeField(form, { disabled = false } = {}) {
  const feeField = form.querySelector('[data-open-play-fee-field]');
  const feeInput = form.elements.openPlayFee;
  const accessInput = form.elements.access;
  if (!feeField || !feeInput || !accessInput) return;
  const requiresFee = accessInput.value === 'paid';
  feeField.hidden = !requiresFee;
  feeInput.disabled = disabled || !requiresFee;
  feeInput.required = requiresFee && !disabled;
  if (!requiresFee && !disabled) feeInput.value = '';
}

function selectedLocationSkills(form) {
  return [...form.querySelectorAll('input[name="skillLevel"]:checked')]
    .map(input => input.value);
}

function selectedOpenPlayDays(form) {
  return [...form.querySelectorAll('input[name="openDay"]:checked')]
    .map(input => input.value);
}

function expandedDayValue(value = '') {
  const normalizedValue = normalize(value);
  if (normalizedValue.includes('daily')) return OPEN_PLAY_DAYS.map(normalize).join(' ');
  if (normalizedValue.includes('weekdays')) return OPEN_PLAY_DAYS.slice(0, 5).map(normalize).join(' ');
  if (normalizedValue.includes('weekends')) return OPEN_PLAY_DAYS.slice(5).map(normalize).join(' ');
  return normalizedValue;
}

function selectedDaysFromCourt(court) {
  const value = expandedDayValue(court.openPlay?.[0]?.days || '');
  return OPEN_PLAY_DAYS.filter(day => value.includes(normalize(day)));
}

function selectedSkillsFromCourt(court) {
  if (Array.isArray(court.skillLevels)) return court.skillLevels;
  const value = normalize(court.estimatedSkillLevel);
  return LOCATION_SKILL_LEVELS.filter(skill => value.includes(skill));
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

function parseOpenPlayHours(hours = '') {
  const [start = '', end = ''] = String(hours).split(/[–-]/).map(value => value.trim());
  return { start, end };
}

function openPlaySlotsFromCourt(court) {
  const slots = (court.openPlay || []).map(slot => ({
    start: slot.startTime || parseOpenPlayHours(slot.hours).start,
    end: slot.endTime || parseOpenPlayHours(slot.hours).end
  }));
  return slots.length ? slots : [{}];
}

function getOpenPlaySlots(form) {
  const days = selectedOpenPlayDays(form).join(', ') || 'Days TBD';
  const slots = [...form.querySelectorAll('.time-window-row')]
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

function updateAdminDaysSummary(form) {
  const days = selectedOpenPlayDays(form);
  const allDays = form.querySelector('[data-open-day-all]');
  const summary = form.querySelector('[data-days-summary]');
  if (allDays) allDays.checked = days.length === OPEN_PLAY_DAYS.length;
  if (summary) summary.textContent = days.length ? days.join(', ') : 'Select days';
}

function addAdminTimeWindow(container, slot = {}, disabled = false) {
  const row = document.createElement('div');
  row.className = 'time-window-row';
  row.innerHTML = `
    <label>Start
      <select data-time-start size="6"${disabled ? ' disabled' : ''}>${timeSelectOptions(slot.start || '')}</select>
    </label>
    <label>End
      <select data-time-end size="6"${disabled ? ' disabled' : ''}>${timeSelectOptions(slot.end || '')}</select>
    </label>
    ${disabled ? '' : '<button class="icon-button time-window-remove" type="button" aria-label="Remove time window">×</button>'}
  `;
  row.querySelector('.time-window-remove')?.addEventListener('click', () => {
    if (container.children.length > 1) {
      row.remove();
    } else {
      row.querySelector('[data-time-start]').value = '';
      row.querySelector('[data-time-end]').value = '';
    }
  });
  container.append(row);
}

function setupAdminLocationForm(form, court, { disabled = false } = {}) {
  const selectedDays = new Set(selectedDaysFromCourt(court));
  const selectedSkills = new Set(selectedSkillsFromCourt(court));
  form.querySelectorAll('input[name="openDay"]').forEach(input => {
    input.checked = selectedDays.has(input.value);
  });
  form.querySelectorAll('input[name="skillLevel"]').forEach(input => {
    input.checked = selectedSkills.has(input.value);
  });
  updateAdminDaysSummary(form);
  updateAdminOpenPlayFeeField(form, { disabled });
  form.elements.access?.addEventListener('change', () => updateAdminOpenPlayFeeField(form, { disabled }));
  const timeWindows = form.querySelector('[data-time-windows]');
  timeWindows.replaceChildren();
  openPlaySlotsFromCourt(court).forEach(slot => addAdminTimeWindow(timeWindows, slot, disabled));
  form.querySelector('[data-add-time-window]')?.addEventListener('click', () => addAdminTimeWindow(timeWindows));
  form.querySelector('[data-open-day-all]')?.addEventListener('change', event => {
    form.querySelectorAll('input[name="openDay"]').forEach(input => {
      input.checked = event.currentTarget.checked;
    });
    updateAdminDaysSummary(form);
  });
  form.querySelectorAll('input[name="openDay"]').forEach(input => {
    input.addEventListener('change', () => updateAdminDaysSummary(form));
  });
}

function reviewSortValue(review) {
  return review.updatedAtTimestamp || review.createdAtTimestamp || review.updatedAt || review.createdAt || review.visited || '';
}

function getLocationReviews(court) {
  const reviews = getSavedReviews();
  const locationIds = new Set([court.id, court.remoteId].filter(Boolean));
  const found = [];
  const seen = new Set();

  Object.entries(reviews).forEach(([courtId, reviewList]) => {
    (reviewList || []).forEach(review => {
      const isForLocation = locationIds.has(courtId)
        || locationIds.has(review.courtId)
        || locationIds.has(review.remoteLocationId);
      if (!isForLocation || seen.has(review.id)) return;
      found.push({ ...review, courtId: review.courtId || court.id, courtName: review.courtName || court.name });
      seen.add(review.id);
    });
  });

  return found
    .map((review, index) => ({ review, index }))
    .sort((a, b) => String(reviewSortValue(b.review)).localeCompare(String(reviewSortValue(a.review))) || a.index - b.index)
    .map(item => item.review);
}

function getReviewPhotos(review) {
  const reviewIds = new Set([review.id, review.remoteId].filter(Boolean));
  return (backendCollections.photos || [])
    .filter(photo => reviewIds.has(photo.reviewId) && photo.status !== 'removed')
    .sort((a, b) => String(b.createdAtTimestamp || b.createdAt || '').localeCompare(String(a.createdAtTimestamp || a.createdAt || '')));
}

function renderAdminReviewSkills(review) {
  const selected = new Set(Array.isArray(review.skillLevels) ? review.skillLevels : []);
  return LOCATION_SKILL_LEVELS.map(skill => `
    <label><input name="adminReviewSkillLevel" type="checkbox" value="${skill}"${selected.has(skill) ? ' checked' : ''} /> ${escapeHtml(SKILL_LEVELS[skill])}</label>
  `).join('');
}

function renderAdminReviewPhotos(review) {
  const photos = getReviewPhotos(review);
  if (!photos.length) return '<p class="empty-profile-list">No review photos.</p>';

  return `
    <div class="admin-review-photo-list">
      ${photos.map((photo, index) => `
        <figure class="admin-review-photo-item">
          <button class="admin-review-photo-button" type="button" data-open-admin-review-photo data-admin-review-photo-url="${escapeHtml(photo.url)}" data-admin-review-photo-alt="${escapeHtml(`${review.courtName || 'Review'} photo ${index + 1}`)}" data-admin-review-photo-caption="${escapeHtml(review.courtName || 'Review photo')}" aria-label="Open review photo ${index + 1} of ${photos.length}">
            <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(`${review.courtName || 'Review'} photo ${index + 1}`)}" loading="lazy" />
          </button>
          <figcaption>
            <span>${escapeHtml(photo.status || 'pending')}</span>
            <button class="secondary-button admin-delete-button" type="button" data-remove-review-photo="${escapeHtml(photo.id)}" data-review-photo-storage-path="${escapeHtml(photo.storagePath || '')}">Delete picture</button>
          </figcaption>
        </figure>
      `).join('')}
    </div>
  `;
}

function renderAdminReviewEditor(review) {
  return `
    <article class="admin-review-editor" data-admin-review-id="${escapeHtml(review.id || '')}">
      <div class="admin-review-editor-header">
        <div>
          <strong>${escapeHtml(review.username || 'Player')}</strong>
          <span>${escapeHtml(review.updatedAt || review.createdAt || review.visited || 'No date')}</span>
        </div>
        <span class="moderation-badge moderation-badge-neutral">${escapeHtml(review.status || 'published')}</span>
      </div>
      <div class="admin-review-fields">
        <label>Status
          <select data-review-field="status">${selectOptions(REVIEW_STATUS_OPTIONS, review.status || 'published')}</select>
        </label>
        <label>Visited
          <input data-review-field="visited" type="date" value="${escapeHtml(review.visited || '')}" />
        </label>
        <fieldset class="checkbox-fieldset admin-review-skill-field" data-admin-review-skills>
          <legend><span>Skill level seen</span></legend>
          ${renderAdminReviewSkills(review)}
        </fieldset>
        <label>Crowd level
          <select data-review-field="crowdLevel">${selectOptions(REVIEW_CROWD_OPTIONS, review.crowdLevel || '')}</select>
        </label>
        <label>Best time to go
          <input data-review-field="bestTime" value="${escapeHtml(review.bestTime || '')}" />
        </label>
        <label>Open play reliability
          <select data-review-field="openPlayReliability">${selectOptions(REVIEW_RELIABILITY_OPTIONS, review.openPlayReliability || '')}</select>
        </label>
        <label>Net setup
          <select data-review-field="netSetup">${selectOptions(REVIEW_NET_OPTIONS, review.netSetup || '')}</select>
        </label>
        <label>Play format
          <select data-review-field="playFormat">${selectOptions(REVIEW_FORMAT_OPTIONS, review.playFormat || '')}</select>
        </label>
        <label>Beginner friendliness
          <select data-review-field="beginnerFriendliness">${selectOptions(REVIEW_BEGINNER_OPTIONS, review.beginnerFriendliness || '')}</select>
        </label>
        <label>Fees or passes
          <select data-review-field="fees">${selectOptions(REVIEW_FEES_OPTIONS, review.fees || '')}</select>
        </label>
        <label>Bathroom / water
          <select data-review-field="amenities">${selectOptions(REVIEW_AMENITIES_OPTIONS, review.amenities || '')}</select>
        </label>
        <label>Lighting
          <select data-review-field="lighting">${selectOptions(REVIEW_LIGHTING_OPTIONS, review.lighting || '')}</select>
        </label>
        <label>Scheduling app
          <input data-review-field="schedulingApp" value="${escapeHtml(review.schedulingApp || '')}" />
        </label>
        <label class="admin-review-body-field">Review / open play information
          <textarea data-review-field="body" rows="4">${escapeHtml(review.body || '')}</textarea>
        </label>
      </div>
      <div class="admin-review-photo-section">
        <span class="field-label">Review pictures</span>
        ${renderAdminReviewPhotos(review)}
      </div>
      <div class="admin-review-actions">
        <button class="secondary-button admin-edit-button admin-approve-button" type="button" data-save-admin-review>Save review</button>
        <p class="form-hint" data-admin-review-hint></p>
      </div>
    </article>
  `;
}

function renderLocationReviewEditors(court) {
  const reviews = getLocationReviews(court);
  const reviewCountText = `${reviews.length} review${reviews.length === 1 ? '' : 's'} · newest first`;
  return `
    <details class="pending-location-details admin-location-reviews">
      <summary><span>Reviews</span> <small>${reviewCountText}</small></summary>
      <div class="admin-review-editor-list">
        ${reviews.length ? reviews.map(renderAdminReviewEditor).join('') : '<p class="empty-profile-list">No reviews yet.</p>'}
      </div>
    </details>
  `;
}

function renderLocationFields(court, { disabled = false } = {}) {
  const disabledAttr = disabled ? ' disabled' : '';
  const selectedSkills = new Set(selectedSkillsFromCourt(court));
  const selectedDays = new Set(selectedDaysFromCourt(court));
  return `
    <div class="form-grid location-fields admin-location-fields">
      <label class="field-name">Park / facility name
        <input name="name" required value="${escapeHtml(court.name || '')}"${disabledAttr} />
      </label>
      <label class="field-address">Address or area
        <input name="address" required value="${escapeHtml(court.address || '')}"${disabledAttr} />
      </label>
      <label class="field-city">City
        <input name="city" required value="${escapeHtml(court.city || '')}"${disabledAttr} />
      </label>
      <label class="field-state">State
        <input name="state" required maxlength="2" value="${escapeHtml(court.state || '')}"${disabledAttr} />
      </label>
      <label class="field-lat">Latitude
        <input name="latitude" required type="number" step="any" value="${escapeHtml(court.latitude ?? '')}"${disabledAttr} />
      </label>
      <label class="field-lng">Longitude
        <input name="longitude" required type="number" step="any" value="${escapeHtml(court.longitude ?? '')}"${disabledAttr} />
      </label>
      <div class="access-stack">
        <label class="field-access">Access
          <select name="access"${disabledAttr}>
            <option value="public"${court.access === 'public' || court.isFree === true ? ' selected' : ''}>Free/public</option>
            <option value="paid"${court.access === 'paid' || court.isFree === false ? ' selected' : ''}>Public with fee</option>
          </select>
        </label>
        <label class="field-open-play-fee" data-open-play-fee-field hidden>Open play fee
          <input name="openPlayFee" type="number" min="0.01" step="0.01" inputmode="decimal" value="${escapeHtml(normalizeOpenPlayFee(court.openPlayFee) ?? '')}"${disabledAttr} />
        </label>
        <label class="field-court-count">Number of courts
          <input name="courtCount" type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(court.courts?.count ?? '')}"${disabledAttr} />
        </label>
      </div>
      <fieldset class="checkbox-fieldset"${disabledAttr}>
        <legend><span>Skill level</span><small class="form-subhint">select all that apply</small></legend>
        ${LOCATION_SKILL_LEVELS.map(skill => `
          <label><input name="skillLevel" type="checkbox" value="${skill}"${selectedSkills.has(skill) ? ' checked' : ''}${disabledAttr} /> ${escapeHtml(SKILL_LEVELS[skill])}</label>
        `).join('')}
      </fieldset>
      <div class="checkbox-dropdown-field">
        <span class="field-label">Open play days <small class="form-subhint">select all that apply</small></span>
        <details class="checkbox-dropdown">
          <summary><span data-days-summary>${selectedDays.size ? [...selectedDays].join(', ') : 'Select days'}</span></summary>
          <div class="checkbox-dropdown-menu">
            <label class="select-all-option"><input data-open-day-all type="checkbox"${selectedDays.size === OPEN_PLAY_DAYS.length ? ' checked' : ''}${disabledAttr} /> All days</label>
            ${OPEN_PLAY_DAYS.map(day => `
              <label><input name="openDay" type="checkbox" value="${day}"${selectedDays.has(day) ? ' checked' : ''}${disabledAttr} /> ${day}</label>
            `).join('')}
          </div>
        </details>
      </div>
      <label class="field-notes">Notes
        <textarea name="notes" rows="3"${disabledAttr}>${escapeHtml(court.notes || '')}</textarea>
      </label>
      <div class="time-window-field">
        <span class="field-label">Open play hours</span>
        <div class="time-window-list" data-time-windows></div>
        ${disabled ? '' : '<button class="secondary-button compact-button" data-add-time-window type="button">Add time window</button>'}
      </div>
      <label class="field-website">Website / registration link
        <input name="websiteUrl" type="text" inputmode="url" value="${escapeHtml(court.websiteUrl || '')}"${disabledAttr} />
      </label>
      <label class="field-phone">Phone number
        <input name="phoneNumber" type="tel" autocomplete="tel" value="${escapeHtml(court.phoneNumber || '')}"${disabledAttr} />
      </label>
      <label class="field-photos">Photo URLs, comma separated
        <input name="photos" value="${escapeHtml(photoUrlList(court.photos).join(', '))}"${disabledAttr} />
      </label>
    </div>
  `;
}

function migrateUserSkillLevels(users) {
  return users.map(user => {
    const isScoop = normalize(user.username) === 'scoop';
    const skillLevel = isScoop
      ? 'advanced'
      : normalizeSkillLevel(user.skillLevel, skillLevelFromDupr(user.dupr));
    const { dupr, ...userWithoutDupr } = user;
    return { ...userWithoutDupr, skillLevel };
  });
}

async function currentUser() {
  return await window.OpenPlayAuth?.currentUser?.() || null;
}

async function currentAccessToken() {
  const supabase = window.OpenPlaySupabaseClient?.getClient?.();
  if (!supabase) return '';
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.access_token || '';
}

function isAdmin(user) {
  return user?.role === 'admin';
}

async function publishPendingInstagramPost(court, values) {
  if (!court?.remoteId) throw new Error('A saved location is required before posting.');
  const accessToken = await currentAccessToken();
  if (!accessToken) throw new Error('Sign in again before posting to Instagram.');

  const response = await fetch('/api/instagram/post-location', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      locationId: court.remoteId,
      caption: values.caption,
      imageUrls: values.imageUrls,
      locationTag: values.locationTag,
      instagramLocationId: values.instagramLocationId,
      collaborators: values.collaborators
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Instagram post failed: ${response.status}`);
  }
  return result;
}

async function preflightPendingInstagramImages(imageUrls) {
  const accessToken = await currentAccessToken();
  if (!accessToken) throw new Error('Sign in again before checking images.');

  const response = await fetch('/api/instagram/preflight-images', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ imageUrls })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Image check failed: ${response.status}`);
  }
  return result;
}

function syncUserAttribution(user) {
  const submissions = getSavedSubmissions().map(court => (
    court.submittedBy === user.id ? { ...court, submittedByUsername: user.username } : court
  ));
  saveSubmissions(submissions);

  const reviews = getSavedReviews();
  Object.keys(reviews).forEach(courtId => {
    reviews[courtId] = reviews[courtId].map(review => {
      if (review.userId !== user.id) return review;
      const { dupr, ...reviewWithoutDupr } = review;
      return { ...reviewWithoutDupr, username: user.username, skillLevel: user.skillLevel || '' };
    });
  });
  saveReviews(reviews);

  saveSuggestedEdits(getSavedSuggestedEdits().map(edit => (
    edit.userId === user.id ? { ...edit, username: user.username } : edit
  )));

  saveCredits(getSavedCredits().map(credit => (
    credit.userId === user.id ? { ...credit, username: user.username } : credit
  )));
}

function mergeSavedLocations(seedCourts, savedCourts) {
  const deletedIds = new Set(getDeletedLocationIds());
  const savedById = new Map(savedCourts.map(court => [court.id, court]));
  const seedIds = new Set(seedCourts.map(court => court.id));
  return [
    ...seedCourts
      .map(court => savedById.get(court.id) || court)
      .filter(court => !deletedIds.has(court.id) || normalizedLocationStatus(court) === 'archived'),
    ...savedCourts.filter(court => !seedIds.has(court.id))
  ];
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

function showView(viewName) {
  elements.navButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.adminView === viewName);
  });
  elements.moderationSubnav.hidden = viewName !== 'moderation';
  elements.locationsSubnav.hidden = viewName !== 'locations';
  elements.moderationView.hidden = viewName !== 'moderation';
  elements.postsView.hidden = viewName !== 'posts';
  elements.usersView.hidden = viewName !== 'users';
  elements.locationsView.hidden = viewName !== 'locations';
  elements.drawingsView.hidden = viewName !== 'drawings';
}

function showModerationView(viewName) {
  activeModerationView = viewName;
  showView('moderation');
  renderModeration();
}

function showLocationView(viewName) {
  activeLocationView = viewName;
  showView('locations');
  renderLocations();
}

function openAdminDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function closeAdminDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

function confirmAdminDelete(message) {
  elements.deleteMessage.textContent = message || 'Are you sure you want to delete this contribution?';
  openAdminDialog(elements.deleteDialog);

  return new Promise(resolve => {
    deleteConfirmationRequest = { resolve };
    setTimeout(() => elements.deleteDialog.querySelector('[data-admin-delete-cancel]')?.focus(), 0);
  });
}

function resolveAdminDeleteConfirmation(confirmed) {
  const request = deleteConfirmationRequest;
  deleteConfirmationRequest = null;
  closeAdminDialog(elements.deleteDialog);
  request?.resolve(Boolean(confirmed));
}

function expandAdminRow(card) {
  card.classList.add('is-editing');
  card.querySelector('.admin-row-summary').hidden = true;
  const form = card.querySelector('.admin-edit-form');
  form.hidden = false;
  form.querySelector('input, select, textarea')?.focus();
}

function collapseAdminRow(card) {
  card.classList.remove('is-editing');
  card.querySelector('.admin-row-summary').hidden = false;
  card.querySelector('.admin-edit-form').hidden = true;
}

function adminListHeader(type) {
  const header = document.createElement('div');
  header.className = `admin-list-header admin-${type}-row`;
  if (type === 'user') {
    header.innerHTML = `
      <span>User</span>
      <span>Role</span>
      <span>Skill</span>
      <span>Active</span>
      <span>Lifetime</span>
      <span>Joined</span>
      <span>Actions</span>
    `;
  } else if (type === 'drawing') {
    header.innerHTML = `
      <span>Month</span>
      <span>Status</span>
      <span>Entries</span>
      <span>Winner</span>
      <span>Deadline</span>
      <span>Actions</span>
    `;
  } else {
    header.innerHTML = `
      <span>Location</span>
      <span>Access</span>
      <span>Status</span>
      <span>Skill</span>
      <span>Open play</span>
      <span>Photos</span>
      <span>Actions</span>
    `;
  }
  return header;
}

function getUserReviews(userId) {
  const courtsById = new Map(allCourts.map(court => [court.id, court]));
  const seenCourtIds = new Set();
  return Object.entries(getSavedReviews())
    .flatMap(([courtId, reviews]) => reviews
      .filter(review => review.userId === userId)
      .map(review => ({
        ...review,
        courtId,
        courtName: review.courtName || courtsById.get(courtId)?.name || courtId
      })))
    .filter(review => {
      if (seenCourtIds.has(review.courtId)) return false;
      seenCourtIds.add(review.courtId);
      return true;
    });
}

function getUserLocations(userId) {
  return allCourts.filter(court => court.submittedBy === userId);
}

function renderAdminLocationList(locations) {
  if (!locations.length) return '<p class="empty-profile-list">No added locations yet.</p>';

  return `
    <ul class="admin-review-list">
      ${locations.map(location => `
        <li>
          <strong>${escapeHtml(location.name)}</strong>
          <span>${escapeHtml([location.city, location.state].filter(Boolean).join(', ')) || 'Location'} · ${escapeHtml(location.openPlay?.[0]?.days || 'Days TBD')}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderAdminReviewList(reviews) {
  if (!reviews.length) return '<p class="empty-profile-list">No reviews yet.</p>';

  return `
    <ul class="admin-review-list">
      ${reviews.map(review => `
        <li>
          <strong>${escapeHtml(review.courtName)}</strong>
          <span>${escapeHtml(review.visited || review.createdAt)} · ${escapeHtml(review.body)}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function allReviewsWithCourt() {
  const courtsById = new Map(allCourts.map(court => [court.id, court]));
  return Object.entries(getSavedReviews())
    .flatMap(([courtId, reviews]) => reviews.map(review => ({
      ...review,
      courtId,
      courtName: review.courtName || courtsById.get(courtId)?.name || courtId
    })));
}

function pendingLocations() {
  return allCourts.filter(court => court.status === 'pending');
}

function openReports() {
  return getSavedReports().filter(report => (report.status || 'open') === 'open');
}

function findCourtForReport(report) {
  if (!report) return null;
  const directIds = new Set([report.targetId, report.remoteTargetId].filter(Boolean));
  const reportedReview = report.targetType === 'review'
    ? findReviewById(report.reviewId || report.remoteTargetId || report.targetId)
    : null;
  if (reportedReview) {
    directIds.add(reportedReview.courtId);
    directIds.add(reportedReview.remoteLocationId);
  }

  return allCourts.find(court => (
    directIds.has(court.id)
    || directIds.has(court.remoteId)
    || (report.targetType === 'location' && report.targetName && normalize(court.name) === normalize(report.targetName))
  )) || null;
}

function findReviewForReport(report) {
  if (!report || report.targetType !== 'review') return null;
  return findReviewById(report.reviewId || report.remoteTargetId || report.targetId);
}

function expandLocationEditorForReport(court, review = null) {
  activeLocationView = locationViewForCourt(court);
  renderLocations();
  showView('locations');

  const form = [...elements.locationsList.querySelectorAll('[data-location-id]')]
    .find(candidate => candidate.dataset.locationId === court.id || candidate.dataset.locationId === court.remoteId);
  const card = form?.closest('.admin-card');
  if (!form || !card) {
    window.alert('Could not open the editor for that contribution.');
    return;
  }

  expandAdminRow(card);

  if (review) {
    const reviewDetails = form.querySelector('.admin-location-reviews');
    if (reviewDetails) reviewDetails.open = true;
    const editor = [...form.querySelectorAll('[data-admin-review-id]')]
      .find(candidate => candidate.dataset.adminReviewId === review.id || candidate.dataset.adminReviewId === review.remoteId);
    if (editor) {
      editor.classList.add('is-report-focus');
      editor.scrollIntoView({ block: 'center', behavior: 'smooth' });
      editor.querySelector('textarea, input, select, button')?.focus();
      return;
    }
  }

  card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  form.querySelector('input, select, textarea')?.focus();
}

function editReportedContribution(reportId) {
  const report = getSavedReports().find(item => item.id === reportId);
  if (!report) return;

  const review = findReviewForReport(report);
  const court = findCourtForReport(report);
  if (!court) {
    window.alert('Could not find that reported contribution.');
    return;
  }

  expandLocationEditorForReport(court, review);
}

function pendingSuggestedEdits() {
  return getSavedSuggestedEdits()
    .filter(edit => (edit.status || 'pending') === 'pending')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function pendingPhotos() {
  return (backendCollections.photos || [])
    .filter(photo => (photo.status || 'pending') === 'pending')
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function instagramPostsByLocation() {
  return new Map((backendCollections.instagramPosts || [])
    .filter(post => post.locationId)
    .map(post => [post.locationId, post]));
}

function approvedInstagramPhotosForLocation(court = {}) {
  const locationIds = new Set([court.id, court.remoteId].filter(Boolean));
  const photos = [
    ...(backendCollections.photos || []).filter(photo => (
      locationIds.has(photo.locationId)
      || locationIds.has(photo.remoteLocationId)
    )),
    ...(court.photos || [])
  ];
  const seen = new Set();
  return photos
    .filter(photo => !photo.status || photo.status === 'approved')
    .map(photoUrl)
    .filter(url => /^https:\/\//i.test(url) && /\.(jpe?g)(?:$|\?)/i.test(url))
    .filter(url => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function pendingPostSearchText(court = {}) {
  const post = instagramPostsByLocation().get(court.remoteId) || {};
  return normalize([
    court.name,
    court.address,
    court.city,
    court.state,
    court.submittedByUsername,
    post.caption,
    post.locationTag,
    ...(post.collaboratorUsernames || [])
  ].filter(Boolean).join(' '));
}

function pendingPostImageUrlsForCourt(court = {}, postsByLocation = instagramPostsByLocation()) {
  const post = postsByLocation.get(court.remoteId) || {};
  if (post.imageUrls?.length) return post.imageUrls;
  if (post.imageUrl) return [post.imageUrl];
  return approvedInstagramPhotosForLocation(court);
}

function pendingPostLocationDate(court = {}) {
  return String(court.approvedAt || court.updatedAt || court.createdAt || '');
}

function pendingPostLocations({ includeSearch = true } = {}) {
  const postsByLocation = instagramPostsByLocation();
  const query = normalize(pendingPostSearchQuery).trim();
  return allCourts
    .filter(court => court.remoteId && normalizedLocationStatus(court) === 'approved')
    .filter(court => postsByLocation.get(court.remoteId)?.status !== 'published')
    .filter(court => !includeSearch || !query || pendingPostSearchText(court).includes(query))
    .sort((a, b) => {
      const imageSort = Number(pendingPostImageUrlsForCourt(b, postsByLocation).length > 0)
        - Number(pendingPostImageUrlsForCourt(a, postsByLocation).length > 0);
      return imageSort || pendingPostLocationDate(b).localeCompare(pendingPostLocationDate(a));
    });
}

function defaultInstagramCaption(court = {}) {
  const area = [court.city, court.state].filter(Boolean).join(', ');
  const url = new URL(window.location.origin);
  url.searchParams.set('location', court.id || court.remoteId);
  return [
    `${court.name || 'This court'} was recommended as an active pickleball open play hot spot.`,
    '',
    area
      ? `Calling all players near ${area}: have you played here?`
      : 'Calling all local players: have you played here?',
    '',
    'Check it out on the Scoop Open Play Map and help local players by adding a quick review, uploading pictures, or confirming the open play info is accurate.',
    '',
    "When you sign up or contribute helpful information, you'll get a chance to win a Scoop paddle or $100 worth of gear from the Scoop Pickleball store.",
    '',
    'View this spot:',
    url.toString(),
    '',
    '#pickleball #openplay #scooppickleball'
  ].filter(line => line !== undefined && line !== null).join('\n').trim();
}

function instagramCollaboratorUsernames(values = DEFAULT_INSTAGRAM_COLLABORATORS) {
  const source = values === undefined || values === null ? DEFAULT_INSTAGRAM_COLLABORATORS : values;
  return [...new Set((Array.isArray(source) ? source : [source])
    .flatMap(value => String(value || '').split(/\r?\n|,/))
    .map(value => value.trim().replace(/^@+/, '').toLowerCase())
    .filter(Boolean))];
}

function instagramCollaboratorInputValue(usernames = DEFAULT_INSTAGRAM_COLLABORATORS) {
  return instagramCollaboratorUsernames(usernames)
    .map(username => `@${username}`)
    .join(', ');
}

function instagramCollaboratorPreview(usernames = DEFAULT_INSTAGRAM_COLLABORATORS) {
  const display = instagramCollaboratorInputValue(usernames);
  return display ? `with ${display}` : '';
}

function defaultLocationTag(court = {}) {
  return [court.name, court.city, court.state].filter(Boolean).join(' · ');
}

function pendingPostImageUrls(form) {
  return [...form.querySelectorAll('[data-pending-image-url]')]
    .map(input => input.value.trim())
    .filter(Boolean)
    .slice(0, INSTAGRAM_MAX_IMAGES);
}

function pendingPostImageRowValues(form) {
  return [...form.querySelectorAll('[data-pending-image-url]')]
    .map(input => input.value.trim())
    .slice(0, INSTAGRAM_MAX_IMAGES);
}

function pendingPostValues(form) {
  return {
    caption: form.elements.caption.value.trim(),
    locationTag: form.elements.locationTag.value.trim(),
    instagramLocationId: form.elements.instagramLocationId.value.trim(),
    collaborators: instagramCollaboratorUsernames(form.elements.collaborators?.value),
    imageUrls: pendingPostImageUrls(form)
  };
}

function renderPendingPostImages(urls = []) {
  if (!urls.length) {
    return '<div class="pending-post-empty-image">No photo selected</div>';
  }

  return `
    <div class="pending-post-main-image">
      <img src="${escapeHtml(urls[0])}" alt="Instagram post preview" loading="lazy" />
      ${urls.length > 1 ? `<span>${escapeHtml(urls.length)} photos</span>` : ''}
    </div>
    ${urls.length > 1 ? `
      <div class="pending-post-thumbnails">
        ${urls.slice(0, 6).map(url => `<img src="${escapeHtml(url)}" alt="" loading="lazy" />`).join('')}
      </div>
    ` : ''}
  `;
}

function pendingPostImageRow(url = '', index = 0, count = 1) {
  const removeDisabled = count === 1 && !url;

  return `
    <div class="pending-post-image-row" data-pending-image-row>
      <div class="pending-post-image-thumb">
        ${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" />` : '<span>Image</span>'}
      </div>
      <input data-pending-image-url value="${escapeHtml(url)}" placeholder="Public JPEG image URL" />
      <div class="pending-post-image-controls">
        <button class="secondary-button pending-post-square-button" type="button" data-edit-square-image aria-label="Edit square image"${url ? '' : ' disabled'}>Square</button>
        <button class="secondary-button" type="button" data-move-image="up" aria-label="Move image up"${index === 0 ? ' disabled' : ''}>^</button>
        <button class="secondary-button" type="button" data-move-image="down" aria-label="Move image down"${index >= count - 1 ? ' disabled' : ''}>v</button>
        <button class="secondary-button admin-delete-button" type="button" data-remove-image aria-label="Remove image"${removeDisabled ? ' disabled' : ''}>x</button>
      </div>
    </div>
  `;
}

function pendingPostImageRows(urls = []) {
  const imageUrls = urls.slice(0, INSTAGRAM_MAX_IMAGES);
  if (!imageUrls.length) imageUrls.push('');
  return imageUrls.map((url, index) => pendingPostImageRow(url, index, imageUrls.length)).join('');
}

function setPendingPostImageRows(form, urls = []) {
  const list = form.querySelector('[data-pending-image-list]');
  if (!list) return;
  list.innerHTML = pendingPostImageRows(urls);
  updatePendingPostPreview(form);
}

function updatePendingPostImageThumb(input) {
  const row = input.closest('[data-pending-image-row]');
  const thumb = row?.querySelector('.pending-post-image-thumb');
  if (!thumb) return;
  const url = input.value.trim();
  thumb.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" />` : '<span>Image</span>';
  const squareButton = row?.querySelector('[data-edit-square-image]');
  if (squareButton) squareButton.disabled = !url;
}

function addPendingPostImageUrls(form, urls = []) {
  const existingUrls = pendingPostImageUrls(form);
  const nextUrls = [
    ...existingUrls,
    ...urls.map(url => String(url || '').trim()).filter(Boolean)
  ].slice(0, INSTAGRAM_MAX_IMAGES);
  setPendingPostImageRows(form, nextUrls);
}

function imageUrlArraysEqual(first = [], second = []) {
  return first.length === second.length && first.every((url, index) => url === second[index]);
}

async function preparePendingPostImages(form, court, values, hint) {
  if (!window.OpenPlaySupabase?.prepareInstagramDraftImageUrls) {
    throw new Error('Image preparation is unavailable right now. Refresh and try again.');
  }

  const user = await currentUser();
  if (!user?.id) throw new Error('Sign in again before preparing images.');

  hint.textContent = values.imageUrls.length === 1
    ? 'Preparing Instagram image...'
    : 'Preparing Instagram images...';

  const preparedImageUrls = await window.OpenPlaySupabase.prepareInstagramDraftImageUrls(court, user, values.imageUrls);
  if (!preparedImageUrls.length) throw new Error('Add at least one public JPEG image URL.');

  if (!imageUrlArraysEqual(preparedImageUrls, values.imageUrls)) {
    setPendingPostImageRows(form, preparedImageUrls);
  }
  values.imageUrls = preparedImageUrls;
}

function renderPendingPostCard(court) {
  const post = instagramPostsByLocation().get(court.remoteId) || {};
  const imageUrls = pendingPostImageUrlsForCourt(court);
  const caption = post.caption || defaultInstagramCaption(court);
  const locationTag = post.locationTag || defaultLocationTag(court);
  const collaborators = post.collaboratorUsernames?.length ? post.collaboratorUsernames : DEFAULT_INSTAGRAM_COLLABORATORS;
  const hasFailure = post.status === 'failed';

  return `
    <article class="pending-post-card" data-pending-post-card="${escapeHtml(court.id)}">
      <div class="pending-post-preview" data-post-preview>
        <div class="pending-post-phone">
          <div class="pending-post-account">
            <div class="pending-post-avatar">OP</div>
            <div>
              <strong>openplaymap</strong>
              <span data-preview-location-tag>${escapeHtml(locationTag)}</span>
              <span data-preview-collaborators>${escapeHtml(instagramCollaboratorPreview(collaborators))}</span>
            </div>
          </div>
          <div class="pending-post-image-stage" data-preview-images>
            ${renderPendingPostImages(imageUrls)}
          </div>
          <div class="pending-post-caption">
            <strong>openplaymap</strong>
            <span data-preview-caption>${escapeHtml(caption)}</span>
          </div>
        </div>
      </div>
      <form class="pending-post-editor" data-pending-post-location="${escapeHtml(court.id)}">
        <div class="pending-post-editor-header">
          <div>
            <h3>${escapeHtml(court.name || 'Open play location')}</h3>
            <p>${escapeHtml([court.city, court.state].filter(Boolean).join(', ')) || 'Location'}${hasFailure ? ` · Last failed: ${escapeHtml(post.errorMessage || 'Instagram publish failed')}` : ''}</p>
          </div>
          <span class="moderation-badge${hasFailure ? ' moderation-badge-alert' : ''}">${hasFailure ? 'Retry' : 'Pending'}</span>
        </div>
        <label>
          Caption
          <textarea name="caption" rows="7">${escapeHtml(caption)}</textarea>
        </label>
        <label>
          Location tag
          <input name="locationTag" value="${escapeHtml(locationTag)}" />
        </label>
        <label>
          Instagram location ID
          <input name="instagramLocationId" inputmode="numeric" placeholder="Optional Meta place ID" value="${escapeHtml(post.instagramLocationId || '')}" />
        </label>
        <label>
          Instagram collaborators
          <input name="collaborators" placeholder="@scooppickleball" value="${escapeHtml(instagramCollaboratorInputValue(collaborators))}" />
          <span class="form-hint">Up to ${INSTAGRAM_MAX_COLLABORATORS} accounts. Invites are sent when the post is published.</span>
        </label>
        <div class="pending-post-image-editor">
          <div class="pending-post-image-editor-header">
            <span>Images</span>
            <small>Up to ${INSTAGRAM_MAX_IMAGES} carousel images.</small>
          </div>
          <div class="pending-post-image-list" data-pending-image-list>
            ${pendingPostImageRows(imageUrls)}
          </div>
          <div class="pending-post-upload-row">
            <button class="secondary-button admin-edit-button" type="button" data-add-image-url>Add image URL</button>
            <button class="secondary-button admin-edit-button" type="button" data-upload-image>Upload image</button>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple data-upload-image-input hidden />
          </div>
        </div>
        <div class="admin-edit-actions pending-post-actions">
          <button class="secondary-button admin-edit-button admin-approve-button" type="submit">Post to Instagram</button>
          <p class="form-hint" data-pending-post-hint></p>
        </div>
      </form>
    </article>
  `;
}

function liveLocationForSuggestedEdit(edit) {
  return allCourts.find(court => court.id === edit.locationId)
    || edit.currentLocation
    || {};
}

function displayValue(value) {
  const text = Array.isArray(value)
    ? value.filter(Boolean).join(', ')
    : String(value ?? '').trim();
  return text || 'Blank';
}

function openPlayDaysText(court) {
  return displayValue([...new Set((court.openPlay || []).map(slot => slot.days).filter(Boolean))]);
}

function openPlayHoursText(court) {
  return displayValue((court.openPlay || []).map(slot => slot.hours).filter(Boolean));
}

function locationDisplayFields(court = {}) {
  return [
    ['Name', court.name],
    ['Address', court.address],
    ['City', court.city],
    ['State', court.state],
    ['Latitude', court.latitude],
    ['Longitude', court.longitude],
    ['Access', accessLabel(court)],
    ['Open play fee', formatOpenPlayFee(court.openPlayFee)],
    ['Website / registration link', court.websiteUrl],
    ['Phone number', court.phoneNumber],
    ['Number of courts', court.courts?.count],
    ['Skill level', court.skillLevels?.length ? court.skillLevels : court.estimatedSkillLevel],
    ['Open play days', openPlayDaysText(court)],
    ['Open play hours', openPlayHoursText(court)],
    ['Notes', court.notes],
    ['Photos', photoUrlList(court.photos)]
  ];
}

function changedLocationFields(current = {}, suggested = {}) {
  const currentFields = new Map(locationDisplayFields(current));
  return locationDisplayFields(suggested)
    .map(([label, suggestedValue]) => ({
      label,
      current: displayValue(currentFields.get(label)),
      suggested: displayValue(suggestedValue)
    }))
    .filter(change => change.current !== change.suggested);
}

function renderSuggestedEditItem(edit) {
  const current = liveLocationForSuggestedEdit(edit);
  const suggested = edit.suggestedLocation || {};
  const changes = changedLocationFields(current, suggested);
  return `
    <article class="moderation-item moderation-item-priority">
      <div class="moderation-item-main">
        <div class="moderation-item-title-row">
          <strong>Suggested edit: ${escapeHtml(suggested.name || edit.locationName || current.name || 'Location')}</strong>
          <span class="moderation-badge">Suggested edit</span>
        </div>
        <span class="moderation-meta">Submitted by ${escapeHtml(edit.username || 'Unknown')} · ${escapeHtml(edit.createdAt || 'unknown')} · ${escapeHtml(edit.reason || 'No note provided')}</span>
      </div>
      <div class="admin-row-actions moderation-actions">
        <button class="secondary-button admin-edit-button admin-approve-button" type="button" data-approve-suggested-edit="${escapeHtml(edit.id)}">Approve edit</button>
        <button class="secondary-button admin-delete-button" type="button" data-reject-suggested-edit="${escapeHtml(edit.id)}">Reject</button>
      </div>
      <details class="pending-location-details suggested-edit-details" open>
        <summary><span>Compare suggested changes</span></summary>
        ${changes.length ? `
          <dl class="suggested-edit-diff">
            ${changes.map(change => `
              <div>
                <dt>${escapeHtml(change.label)}</dt>
                <dd><span>Current</span><strong>${escapeHtml(change.current)}</strong></dd>
                <dd><span>Suggested</span><strong>${escapeHtml(change.suggested)}</strong></dd>
              </div>
            `).join('')}
          </dl>
        ` : '<p class="empty-profile-list">No changed fields detected.</p>'}
        <div class="suggested-edit-columns">
          <section>
            <h4>Current location</h4>
            <form class="admin-edit-form admin-readonly-location-form" data-suggested-edit-id="${escapeHtml(edit.id)}" data-suggested-edit-version="current">
              ${renderLocationFields(current, { disabled: true })}
            </form>
          </section>
          <section>
            <h4>Suggested location</h4>
            <form class="admin-edit-form admin-readonly-location-form" data-suggested-edit-id="${escapeHtml(edit.id)}" data-suggested-edit-version="suggested">
              ${renderLocationFields(suggested, { disabled: true })}
            </form>
          </section>
        </div>
      </details>
    </article>
  `;
}

function renderAuditEditItem(edit) {
  return `
    <article class="moderation-item">
      <div class="moderation-item-main">
        <div class="moderation-item-title-row">
          <strong>${escapeHtml(edit.type)}: ${escapeHtml(edit.name)}</strong>
          <span class="moderation-badge moderation-badge-neutral">Edit</span>
        </div>
        <span class="moderation-meta">${escapeHtml(edit.detail)} · ${escapeHtml(edit.date)}</span>
      </div>
    </article>
  `;
}

function recentAuditEdits() {
  const editedLocations = allCourts
    .filter(court => court.updatedAt || court.adminEdited)
    .map(court => ({
      kind: 'audit',
      type: 'Location',
      name: court.name,
      detail: [court.city, court.state].filter(Boolean).join(', '),
      date: court.updatedAt || court.lastVerified || todayIso()
    }));
  const editedReviews = allReviewsWithCourt()
    .filter(review => review.updatedAt)
    .map(review => ({
      kind: 'audit',
      type: 'Review',
      name: review.courtName,
      detail: `Updated by ${review.username || 'Player'}`,
      date: review.updatedAt
    }));
  return [...editedLocations, ...editedReviews]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 12);
}

function recentEdits() {
  return [
    ...pendingSuggestedEdits().map(edit => ({ ...edit, kind: 'suggested-edit' })),
    ...recentAuditEdits()
  ];
}

function highVolumeUsers() {
  const users = getUsers();
  const reviewsToday = allReviewsWithCourt().filter(review => review.createdAt === todayIso() || review.updatedAt === todayIso());
  const locationsToday = allCourts.filter(court => court.createdAt === todayIso());
  return users.map(user => {
    const locationCount = locationsToday.filter(court => court.submittedBy === user.id).length;
    const reviewCount = reviewsToday.filter(review => review.userId === user.id).length;
    return {
      user,
      locationCount,
      reviewCount,
      total: locationCount + reviewCount
    };
  })
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
}

function titleWithCount(title, count) {
  return `${title} (${Number(count) || 0})`;
}

function setAdminNavLabel(viewName, title, count) {
  const button = [...elements.navButtons].find(item => item.dataset.adminView === viewName);
  if (button) button.textContent = titleWithCount(title, count);
}

function setModerationNavLabels(queues) {
  elements.moderationNavButtons.forEach(button => {
    const queue = queues[button.dataset.moderationView];
    if (queue) button.textContent = titleWithCount(queue.title, queue.items.length);
  });
}

function normalizedLocationStatus(court = {}) {
  return court.status || 'approved';
}

function locationViewForCourt(court = {}) {
  return normalizedLocationStatus(court) === 'archived' ? 'deleted' : normalizedLocationStatus(court);
}

function locationStatusLabel(court = {}) {
  const status = normalizedLocationStatus(court);
  return status === 'archived' ? 'deleted' : status;
}

function locationViewQueues() {
  const approved = allCourts.filter(court => normalizedLocationStatus(court) === 'approved');
  const pending = allCourts.filter(court => normalizedLocationStatus(court) === 'pending');
  const rejected = allCourts.filter(court => normalizedLocationStatus(court) === 'rejected');
  const deleted = allCourts.filter(court => normalizedLocationStatus(court) === 'archived');

  return {
    approved: {
      title: 'Approved locations',
      countText: `${approved.length} approved location${approved.length === 1 ? '' : 's'}`,
      items: approved,
      emptyText: 'No approved locations.'
    },
    pending: {
      title: 'Pending locations',
      countText: `${pending.length} pending location${pending.length === 1 ? '' : 's'}`,
      items: pending,
      emptyText: 'No pending locations.'
    },
    rejected: {
      title: 'Rejected locations',
      countText: `${rejected.length} rejected location${rejected.length === 1 ? '' : 's'}`,
      items: rejected,
      emptyText: 'No rejected locations.'
    },
    deleted: {
      title: 'Deleted locations',
      countText: `${deleted.length} deleted location${deleted.length === 1 ? '' : 's'}`,
      items: deleted,
      emptyText: 'No deleted locations.'
    }
  };
}

function setLocationNavLabels(queues) {
  elements.locationNavButtons.forEach(button => {
    const queue = queues[button.dataset.locationView];
    if (queue) button.textContent = titleWithCount(queue.title, queue.items.length);
  });
}

function moderationSection(title, items, emptyText, renderItem, description = '') {
  return `
    <section class="moderation-section">
      <div class="moderation-section-header">
        <div>
          <h3>${escapeHtml(titleWithCount(title, items.length))}</h3>
          ${description ? `<p>${escapeHtml(description)}</p>` : ''}
        </div>
      </div>
      ${items.length ? `<div class="moderation-list">${items.map(renderItem).join('')}</div>` : `<p class="empty-profile-list">${escapeHtml(emptyText)}</p>`}
    </section>
  `;
}

function updatePendingPostPreview(form) {
  const card = form.closest('[data-pending-post-card]');
  const values = pendingPostValues(form);
  const locationTag = card?.querySelector('[data-preview-location-tag]');
  const collaborators = card?.querySelector('[data-preview-collaborators]');
  const caption = card?.querySelector('[data-preview-caption]');
  const images = card?.querySelector('[data-preview-images]');
  if (locationTag) locationTag.textContent = values.locationTag || 'Location';
  if (collaborators) collaborators.textContent = instagramCollaboratorPreview(values.collaborators);
  if (caption) caption.textContent = values.caption || '';
  if (images) images.innerHTML = renderPendingPostImages(values.imageUrls);
}

function movePendingPostImageRow(form, direction, button) {
  const rows = pendingPostImageRowValues(form);
  const row = button.closest('[data-pending-image-row]');
  const list = row?.closest('[data-pending-image-list]');
  const index = [...list?.children || []].indexOf(row);
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return;
  [rows[index], rows[nextIndex]] = [rows[nextIndex], rows[index]];
  setPendingPostImageRows(form, rows);
  form.querySelectorAll('[data-pending-image-url]')[nextIndex]?.focus();
}

function removePendingPostImageRow(form, button) {
  const rows = pendingPostImageRowValues(form);
  const row = button.closest('[data-pending-image-row]');
  const list = row?.closest('[data-pending-image-list]');
  const index = [...list?.children || []].indexOf(row);
  if (index < 0) return;
  rows.splice(index, 1);
  setPendingPostImageRows(form, rows);
  const nextInput = form.querySelectorAll('[data-pending-image-url]')[Math.min(index, rows.length - 1)] || form.querySelector('[data-pending-image-url]');
  nextInput?.focus();
}

async function uploadPendingPostImages(form, court, input, hint) {
  const files = Array.from(input.files || []);
  input.value = '';
  if (!files.length) return;

  const remainingSlots = INSTAGRAM_MAX_IMAGES - pendingPostImageUrls(form).length;
  if (remainingSlots <= 0) {
    hint.textContent = `Instagram accepts up to ${INSTAGRAM_MAX_IMAGES} images. Remove one before uploading more.`;
    return;
  }
  if (files.length > remainingSlots) {
    hint.textContent = `Choose up to ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} for this post.`;
    return;
  }
  if (!window.OpenPlaySupabase?.uploadInstagramDraftImages) {
    hint.textContent = 'Image upload is unavailable right now.';
    return;
  }

  const uploadButton = form.querySelector('[data-upload-image]');
  const previousText = uploadButton?.textContent || '';
  if (uploadButton) {
    uploadButton.disabled = true;
    uploadButton.textContent = files.length === 1 ? 'Uploading...' : 'Uploading images...';
  }
  hint.textContent = files.length === 1 ? 'Preparing image...' : 'Preparing images...';

  try {
    const user = await currentUser();
    const urls = await window.OpenPlaySupabase.uploadInstagramDraftImages(court, user, files);
    addPendingPostImageUrls(form, urls);
    hint.textContent = `${urls.length} Instagram-ready image${urls.length === 1 ? '' : 's'} added.`;
  } catch (error) {
    hint.textContent = error.message || 'Could not upload that image.';
  } finally {
    if (uploadButton) {
      uploadButton.disabled = false;
      uploadButton.textContent = previousText;
    }
  }
}

function setupPendingPostForm(form) {
  const court = allCourts.find(item => item.id === form.dataset.pendingPostLocation);
  if (!court) return;
  const hint = form.querySelector('[data-pending-post-hint]');
  const uploadInput = form.querySelector('[data-upload-image-input]');

  form.addEventListener('input', event => {
    if (!event.target?.matches) return;
    if (!event.target.matches('input, textarea')) return;
    if (event.target.matches('[data-pending-image-url]')) updatePendingPostImageThumb(event.target);
    updatePendingPostPreview(form);
  });

  form.addEventListener('click', event => {
    const button = event.target?.closest?.('button');
    if (!button) return;

    if (button.matches('[data-add-image-url]')) {
      if (pendingPostImageRowValues(form).length >= INSTAGRAM_MAX_IMAGES) {
        hint.textContent = `Instagram accepts up to ${INSTAGRAM_MAX_IMAGES} images.`;
        return;
      }
      const nextRows = [...pendingPostImageRowValues(form), ''];
      setPendingPostImageRows(form, nextRows);
      form.querySelectorAll('[data-pending-image-url]')[nextRows.length - 1]?.focus();
      return;
    }

    if (button.matches('[data-upload-image]')) {
      uploadInput?.click();
      return;
    }

    if (button.matches('[data-edit-square-image]')) {
      openPendingImageEditor(form, court, button, hint);
      return;
    }

    if (button.matches('[data-remove-image]')) {
      removePendingPostImageRow(form, button);
      return;
    }

    if (button.matches('[data-move-image]')) {
      movePendingPostImageRow(form, button.dataset.moveImage, button);
    }
  });

  uploadInput?.addEventListener('change', () => uploadPendingPostImages(form, court, uploadInput, hint));

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = pendingPostValues(form);
    if (!values.caption) {
      hint.textContent = 'Caption is required.';
      return;
    }
    if (!values.imageUrls.length) {
      hint.textContent = 'Add at least one public JPEG image URL.';
      return;
    }
    if (values.imageUrls.length > INSTAGRAM_MAX_IMAGES) {
      hint.textContent = `Instagram accepts up to ${INSTAGRAM_MAX_IMAGES} images.`;
      return;
    }
    if (values.imageUrls.some(url => !/^https:\/\//i.test(url))) {
      hint.textContent = 'Instagram publishing needs public HTTPS image URLs.';
      return;
    }
    if (values.collaborators.length > INSTAGRAM_MAX_COLLABORATORS) {
      hint.textContent = `Instagram accepts up to ${INSTAGRAM_MAX_COLLABORATORS} collaborators.`;
      return;
    }
    const invalidCollaborator = values.collaborators.find(username => !/^[a-z0-9._]{1,30}$/.test(username));
    if (invalidCollaborator) {
      hint.textContent = `Instagram collaborator "${invalidCollaborator}" is not a valid username.`;
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    hint.textContent = 'Checking images...';

    try {
      await preparePendingPostImages(form, court, values, hint);
      hint.textContent = 'Checking prepared images...';
      await preflightPendingInstagramImages(values.imageUrls);
      hint.textContent = 'Posting...';
      await publishPendingInstagramPost(court, values);
      hint.textContent = 'Posted to Instagram.';
      await loadBackendCollections();
      renderPendingPosts();
      renderModeration();
    } catch (error) {
      button.disabled = false;
      hint.textContent = error.message || 'Could not post to Instagram.';
      await loadBackendCollections();
    }
  });
}

function renderPendingPosts() {
  const allPosts = pendingPostLocations({ includeSearch: false });
  const posts = pendingPostLocations();
  const hasSearch = Boolean(pendingPostSearchQuery.trim());
  setAdminNavLabel('posts', 'Pending posts', allPosts.length);
  elements.postsTitle.textContent = titleWithCount('Pending posts', allPosts.length);
  elements.postsCount.textContent = hasSearch
    ? `${posts.length} of ${allPosts.length} pending post${allPosts.length === 1 ? '' : 's'}`
    : `${posts.length} pending post${posts.length === 1 ? '' : 's'}`;

  if (!allPosts.length) {
    elements.postsList.innerHTML = '<p class="empty-profile-list">No pending Instagram posts.</p>';
    return;
  }

  if (!posts.length) {
    elements.postsList.innerHTML = '<p class="empty-profile-list">No pending Instagram posts match that search.</p>';
    return;
  }

  elements.postsList.innerHTML = posts.map(renderPendingPostCard).join('');
  elements.postsList.querySelectorAll('[data-pending-post-location]').forEach(setupPendingPostForm);
}

function renderModeration() {
  const pending = pendingLocations();
  const reports = openReports();
  const edits = recentEdits();
  const volume = highVolumeUsers();
  const photos = pendingPhotos();
  const queues = {
    pending: {
      title: 'Pending locations',
      countText: `${pending.length} pending location${pending.length === 1 ? '' : 's'}`,
      items: pending,
      emptyText: 'No pending locations.',
      description: 'Review full submission details before approving a new map location.',
      renderItem: court => `
        <article class="moderation-item moderation-item-priority">
          <div class="moderation-item-main">
            <div class="moderation-item-title-row">
              <strong>${escapeHtml(court.name)}</strong>
              <span class="moderation-badge">Pending</span>
            </div>
            <span class="moderation-meta">${escapeHtml([court.city, court.state].filter(Boolean).join(', ')) || 'Location'} · Submitted by ${escapeHtml(court.submittedByUsername || 'Unknown')} · ${escapeHtml(court.createdAt || 'unknown')}</span>
          </div>
          <div class="admin-row-actions moderation-actions">
            <button class="secondary-button admin-edit-button admin-approve-button" type="button" data-approve-location="${escapeHtml(court.id)}">Approve</button>
            <button class="secondary-button admin-delete-button" type="button" data-reject-location="${escapeHtml(court.id)}">Reject</button>
          </div>
          <details class="pending-location-details">
            <summary><span>View submission details</span></summary>
            <form class="admin-edit-form admin-readonly-location-form" data-pending-location-id="${escapeHtml(court.id)}">
              ${renderLocationFields(court, { disabled: true })}
            </form>
          </details>
        </article>
      `
    },
    photos: {
      title: 'Pending photos',
      countText: `${photos.length} pending photo${photos.length === 1 ? '' : 's'}`,
      items: photos,
      emptyText: 'No pending photos.',
      description: 'Approve useful court photos before they appear publicly on the map.',
      renderItem: photo => `
        <article class="moderation-item moderation-photo-item">
          <button class="moderation-photo-preview-button" type="button" data-open-admin-moderation-photo data-admin-moderation-photo-url="${escapeHtml(photo.url)}" data-admin-moderation-photo-alt="${escapeHtml(`${photo.locationName || 'Location'} submitted photo`)}" data-admin-moderation-photo-caption="${escapeHtml(photo.locationName || 'Location photo')}" aria-label="Open ${escapeHtml(photo.locationName || 'location')} submitted photo">
            <img class="moderation-photo-preview" src="${escapeHtml(photo.url)}" alt="${escapeHtml(`${photo.locationName || 'Location'} submitted photo`)}" loading="lazy" />
          </button>
          <div class="moderation-item-main">
            <div class="moderation-item-title-row">
              <strong>${escapeHtml(photo.locationName || 'Location photo')}</strong>
              <span class="moderation-badge">Photo</span>
            </div>
            <span class="moderation-meta">Uploaded by ${escapeHtml(photo.username || 'Unknown')} · ${escapeHtml(photo.createdAt || 'unknown')}</span>
          </div>
          <div class="admin-row-actions moderation-actions">
            <button class="secondary-button admin-edit-button admin-approve-button" type="button" data-approve-photo="${escapeHtml(photo.id)}">Approve photo</button>
            <button class="secondary-button admin-delete-button" type="button" data-reject-photo="${escapeHtml(photo.id)}">Reject</button>
          </div>
        </article>
      `
    },
    reports: {
      title: 'Open reports',
      countText: `${reports.length} open report${reports.length === 1 ? '' : 's'}`,
      items: reports,
      emptyText: 'No open reports.',
      description: 'Review user reports and resolve anything that should come off the map.',
      renderItem: report => `
        <article class="moderation-item">
          <div class="moderation-item-main">
            <div class="moderation-item-title-row">
              <strong>${escapeHtml(report.targetType === 'review' ? 'Reported review' : 'Reported location')}: ${escapeHtml(report.targetName || report.targetId)}</strong>
              <span class="moderation-badge moderation-badge-alert">Report</span>
            </div>
            <span class="moderation-meta">${escapeHtml(report.reason)} · Reported by ${escapeHtml(report.username || 'Unknown')} · ${escapeHtml(report.createdAt || 'unknown')}</span>
          </div>
          <div class="admin-row-actions moderation-actions">
            <button class="secondary-button admin-edit-button" type="button" data-dismiss-report="${escapeHtml(report.id)}">Dismiss</button>
            <button class="secondary-button admin-edit-button" type="button" data-edit-report="${escapeHtml(report.id)}">Edit</button>
            <button class="secondary-button admin-delete-button" type="button" data-delete-report="${escapeHtml(report.id)}">Delete</button>
          </div>
        </article>
      `
    },
    edits: {
      title: 'Recent edits',
      countText: `${edits.length} recent edit${edits.length === 1 ? '' : 's'}`,
      items: edits,
      emptyText: 'No suggested edits or recent edits.',
      description: 'Review pending user-suggested changes, then audit recent approved location and review changes.',
      renderItem: edit => edit.kind === 'suggested-edit' ? renderSuggestedEditItem(edit) : renderAuditEditItem(edit)
    },
    volume: {
      title: 'High-volume users today',
      countText: `${volume.length} active user${volume.length === 1 ? '' : 's'}`,
      items: volume,
      emptyText: 'No user activity today.',
      description: 'People who are adding the most content today.',
      renderItem: item => `
        <article class="moderation-item${item.locationCount >= DAILY_LOCATION_LIMIT || item.reviewCount >= DAILY_REVIEW_LIMIT ? ' is-warning' : ''}">
          <div class="moderation-item-main">
            <div class="moderation-item-title-row">
              <strong>${escapeHtml(item.user.username)}</strong>
              <span class="moderation-badge moderation-badge-neutral">Activity</span>
            </div>
            <span class="moderation-meta">${escapeHtml(item.locationCount)} locations today · ${escapeHtml(item.reviewCount)} reviews today</span>
          </div>
        </article>
      `
    }
  };
  const activeQueue = queues[activeModerationView] || queues.pending;
  const moderationTotal = Object.values(queues)
    .reduce((total, queue) => total + queue.items.length, 0);

  setAdminNavLabel('moderation', 'Moderation', moderationTotal);
  setModerationNavLabels(queues);
  elements.moderationTitle.textContent = titleWithCount(activeQueue.title, activeQueue.items.length);
  elements.moderationCount.textContent = activeQueue.countText;
  elements.moderationNavButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.moderationView === activeModerationView);
  });
  elements.moderationList.innerHTML = moderationSection(
    activeQueue.title,
    activeQueue.items,
    activeQueue.emptyText,
    activeQueue.renderItem,
    activeQueue.description
  );

  elements.moderationList.querySelectorAll('[data-approve-location]').forEach(button => {
    button.addEventListener('click', () => approveLocation(button.dataset.approveLocation));
  });
  elements.moderationList.querySelectorAll('[data-reject-location]').forEach(button => {
    button.addEventListener('click', () => rejectLocation(button.dataset.rejectLocation));
  });
  elements.moderationList.querySelectorAll('[data-approve-photo]').forEach(button => {
    button.addEventListener('click', () => approvePhoto(button.dataset.approvePhoto));
  });
  elements.moderationList.querySelectorAll('[data-reject-photo]').forEach(button => {
    button.addEventListener('click', () => rejectPhoto(button.dataset.rejectPhoto));
  });
  elements.moderationList.querySelectorAll('[data-open-admin-moderation-photo]').forEach(button => {
    button.addEventListener('click', () => {
      const lightboxPhotos = adminModerationPhotosFromButton(button);
      const index = lightboxPhotos.findIndex(photo => photo.url === button.dataset.adminModerationPhotoUrl);
      openAdminPhotoLightbox(lightboxPhotos, index >= 0 ? index : 0, button);
    });
  });
  elements.moderationList.querySelectorAll('[data-approve-suggested-edit]').forEach(button => {
    button.addEventListener('click', () => approveSuggestedEdit(button.dataset.approveSuggestedEdit));
  });
  elements.moderationList.querySelectorAll('[data-reject-suggested-edit]').forEach(button => {
    button.addEventListener('click', () => rejectSuggestedEdit(button.dataset.rejectSuggestedEdit));
  });
  elements.moderationList.querySelectorAll('[data-dismiss-report]').forEach(button => {
    button.addEventListener('click', () => dismissReport(button.dataset.dismissReport));
  });
  elements.moderationList.querySelectorAll('[data-edit-report]').forEach(button => {
    button.addEventListener('click', () => editReportedContribution(button.dataset.editReport));
  });
  elements.moderationList.querySelectorAll('[data-delete-report]').forEach(button => {
    button.addEventListener('click', () => deleteReportedContribution(button.dataset.deleteReport));
  });
  elements.moderationList.querySelectorAll('[data-pending-location-id]').forEach(form => {
    const court = pending.find(item => item.id === form.dataset.pendingLocationId);
    if (court) setupAdminLocationForm(form, court, { disabled: true });
  });
  elements.moderationList.querySelectorAll('[data-suggested-edit-id][data-suggested-edit-version]').forEach(form => {
    const edit = getSavedSuggestedEdits().find(item => item.id === form.dataset.suggestedEditId);
    if (!edit) return;
    const court = form.dataset.suggestedEditVersion === 'current'
      ? liveLocationForSuggestedEdit(edit)
      : edit.suggestedLocation;
    setupAdminLocationForm(form, court, { disabled: true });
  });
}

function userCard(user) {
  const card = document.createElement('article');
  card.className = 'admin-card';
  const creditBalances = getCreditBalances(user.id);
  const userLocations = getUserLocations(user.id);
  const userReviews = getUserReviews(user.id);
  const roleLabel = user.role === 'admin' ? 'Admin' : 'User';
  card.innerHTML = `
    <div class="admin-row-summary admin-user-row">
      <div class="admin-row-main">
        <h3>${escapeHtml(user.username)}</h3>
        <p>${escapeHtml(user.email)}</p>
      </div>
      <span>${escapeHtml(roleLabel)}</span>
      <span>${escapeHtml(skillLevelLabel(user.skillLevel) || 'No skill level')}</span>
      <span>${escapeHtml(creditBalances.active)}</span>
      <span>${escapeHtml(creditBalances.lifetime)}</span>
      <span>${escapeHtml(user.createdAt || 'unknown')}</span>
      <div class="admin-row-actions">
        <button class="secondary-button admin-edit-button" type="button" data-edit-row>Edit</button>
      </div>
    </div>
    <form class="admin-edit-form" data-user-id="${escapeHtml(user.id)}" hidden>
      <div class="admin-card-header">
        <div>
          <h3>Edit ${escapeHtml(user.username)}</h3>
          <p>${escapeHtml(roleLabel)} · Joined ${escapeHtml(user.createdAt || 'unknown')}</p>
        </div>
        <div class="admin-edit-actions">
          <button class="secondary-button" type="button" data-cancel-edit>Cancel</button>
          <button class="secondary-button" type="submit">Save</button>
        </div>
      </div>
      <div class="admin-expanded-summary">
        <div>
          <span>Active Drawing Credits</span>
          <strong>${escapeHtml(creditBalances.active)}</strong>
        </div>
        <div>
          <span>Lifetime Credits</span>
          <strong>${escapeHtml(creditBalances.lifetime)}</strong>
        </div>
      </div>
      <div class="admin-form-grid">
        <label>Email
          <input name="email" type="email" required value="${escapeHtml(user.email)}" />
        </label>
        <label>Username
          <input name="username" required maxlength="28" value="${escapeHtml(user.username)}" />
        </label>
        <label>Skill level
          <select name="skillLevel">
            ${skillLevelOptions(user.skillLevel)}
          </select>
        </label>
        <label>Role
          <select name="role">
            <option value="player"${user.role === 'admin' ? '' : ' selected'}>User</option>
            <option value="admin"${user.role === 'admin' ? ' selected' : ''}>Admin</option>
          </select>
        </label>
      </div>
      <label>Bio
        <textarea name="bio" maxlength="140" rows="2">${escapeHtml(user.bio || '')}</textarea>
      </label>
      <section class="admin-expanded-section">
        <h4>Locations added</h4>
        ${renderAdminLocationList(userLocations)}
      </section>
      <section class="admin-expanded-section">
        <h4>Reviews</h4>
        ${renderAdminReviewList(userReviews)}
      </section>
      <p class="form-hint" data-admin-hint></p>
    </form>
  `;

  card.querySelector('[data-edit-row]').addEventListener('click', () => expandAdminRow(card));
  card.querySelector('[data-cancel-edit]').addEventListener('click', () => collapseAdminRow(card));
  card.querySelector('form').addEventListener('submit', saveUserEdit);
  return card;
}

function renderUsers() {
  const users = getUsers();
  setAdminNavLabel('users', 'Users', users.length);
  elements.usersTitle.textContent = titleWithCount('App users', users.length);
  elements.userCount.textContent = `${users.length} user${users.length === 1 ? '' : 's'}`;
  elements.usersList.replaceChildren(adminListHeader('user'), ...users.map(userCard));
}

async function saveUserEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const hint = form.querySelector('[data-admin-hint]');
  const userId = form.dataset.userId;
  const users = getUsers();
  const existing = users.find(user => user.id === userId);
  if (!existing) return;

  const nextUser = {
    ...existing,
    email: form.elements.email.value.trim().toLowerCase(),
    username: form.elements.username.value.trim(),
    skillLevel: normalizeSkillLevel(form.elements.skillLevel.value, ''),
    bio: form.elements.bio.value.trim(),
    role: form.elements.role.value === 'admin' ? 'admin' : 'player'
  };

  if (!nextUser.email || !nextUser.username) {
    hint.textContent = 'Email and username are required.';
    return;
  }

  if (users.some(user => user.id !== userId && normalize(user.email) === normalize(nextUser.email))) {
    hint.textContent = 'Another user already has that email.';
    return;
  }

  if (users.some(user => user.id !== userId && normalize(user.username) === normalize(nextUser.username))) {
    hint.textContent = 'Another user already has that username.';
    return;
  }

  if (existing.id === currentAdminUser?.id && existing.role === 'admin' && nextUser.role !== 'admin') {
    hint.textContent = 'You cannot remove your own admin role from this panel.';
    return;
  }

  try {
    if (Array.isArray(authUsers)) {
      const updatedUser = await window.OpenPlayAuth.updateProfileById(userId, nextUser);
      authUsers = authUsers.map(user => user.id === userId ? updatedUser : user);
      hint.textContent = 'Saved.';
      renderUsers();
      return;
    }

    saveUsers(users.map(user => user.id === userId ? nextUser : user));
    syncUserAttribution(nextUser);
    hint.textContent = 'Saved.';
    renderUsers();
  } catch (error) {
    hint.textContent = error.message;
  }
}

function locationActionHtml(court) {
  const status = normalizedLocationStatus(court);
  const approveLabel = status === 'pending' ? 'Approve' : 'Re-approve';
  const actions = [
    '<button class="secondary-button admin-edit-button" type="button" data-edit-row>Edit</button>'
  ];

  if (status === 'pending' || status === 'rejected' || status === 'archived') {
    actions.push(`<button class="secondary-button admin-edit-button admin-approve-button" type="button" data-approve-location="${escapeHtml(court.id)}">${approveLabel}</button>`);
  }

  if (status === 'pending') {
    actions.push(`<button class="secondary-button admin-delete-button" type="button" data-reject-location="${escapeHtml(court.id)}">Reject</button>`);
  }

  if (status !== 'archived') {
    actions.push('<button class="secondary-button admin-delete-button" type="button" data-delete-location>Delete</button>');
  }

  return actions.join('');
}

function locationCard(court) {
  const card = document.createElement('article');
  card.className = 'admin-card';
  const courtAccessLabel = accessLabel(court);
  const statusLabel = locationStatusLabel(court);
  const skillLabel = court.estimatedSkillLevel || 'unknown';
  const photoCount = court.photos?.length || 0;
  const areaLabel = [court.city, court.state].filter(Boolean).join(', ');
  const locationLabel = court.address && court.address !== areaLabel
    ? `${court.address}${areaLabel ? ` · ${areaLabel}` : ''}`
    : (areaLabel || court.address || 'Location');
  const submitterLabel = court.submittedByUsername || 'Unknown';
  const locationSummary = normalizedLocationStatus(court) === 'pending'
    ? `${locationLabel} · Submitted by ${submitterLabel}`
    : locationLabel;
  card.innerHTML = `
    <div class="admin-row-summary admin-location-row">
      <div class="admin-row-main">
        <h3>${escapeHtml(court.name)}</h3>
        <p>${escapeHtml(locationSummary)}</p>
      </div>
      <span>${escapeHtml(courtAccessLabel)}</span>
      <span>${escapeHtml(statusLabel)}</span>
      <span>${escapeHtml(skillLabel)}</span>
      <span>${escapeHtml(court.openPlay?.[0]?.days || 'Days TBD')}</span>
      <span>${escapeHtml(photoCount)}</span>
      <div class="admin-row-actions">
        ${locationActionHtml(court)}
      </div>
    </div>
    <form class="admin-edit-form" data-location-id="${escapeHtml(court.id)}" hidden>
      <div class="admin-card-header">
        <div>
          <h3>Edit ${escapeHtml(court.name)}</h3>
          <p>${escapeHtml([court.city, court.state].filter(Boolean).join(', ')) || 'Location'}</p>
        </div>
        <div class="admin-edit-actions">
          <button class="secondary-button" type="button" data-cancel-edit>Cancel</button>
          <button class="secondary-button" type="submit">Save</button>
        </div>
      </div>
      ${renderLocationFields(court)}
      ${renderLocationReviewEditors(court)}
      <p class="form-hint" data-admin-hint></p>
    </form>
  `;

  card.querySelector('[data-edit-row]').addEventListener('click', () => expandAdminRow(card));
  card.querySelector('[data-cancel-edit]').addEventListener('click', () => collapseAdminRow(card));
  card.querySelector('[data-approve-location]')?.addEventListener('click', () => approveLocation(court.id));
  card.querySelector('[data-reject-location]')?.addEventListener('click', () => rejectLocation(court.id));
  card.querySelector('[data-delete-location]')?.addEventListener('click', () => deleteLocation(court));
  const form = card.querySelector('form');
  setupAdminLocationForm(form, court);
  setupAdminReviewEditors(form, court);
  form.addEventListener('submit', saveLocationEdit);
  return card;
}

function renderLocations() {
  const queues = locationViewQueues();
  const activeQueue = queues[activeLocationView] || queues.approved;
  const total = Object.values(queues).reduce((sum, queue) => sum + queue.items.length, 0);

  setAdminNavLabel('locations', 'Locations', total);
  setLocationNavLabels(queues);
  elements.locationsTitle.textContent = titleWithCount(activeQueue.title, activeQueue.items.length);
  elements.locationCount.textContent = activeQueue.countText;
  elements.locationNavButtons.forEach(button => {
    button.classList.toggle('is-active', button.dataset.locationView === activeLocationView);
  });

  if (!activeQueue.items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-profile-list';
    empty.textContent = activeQueue.emptyText;
    elements.locationsList.replaceChildren(empty);
    return;
  }

  elements.locationsList.replaceChildren(adminListHeader('location'), ...activeQueue.items.map(locationCard));
}

function drawingStatusLabel(period) {
  if (period.drawingStatus === 'claimed') return 'Claimed';
  if (period.drawingStatus === 'drawn') return period.winnerNotifiedAt ? 'Awaiting claim' : 'Awaiting email';
  if (period.periodStatus === 'drawn') return 'Drawn';
  if (period.periodStatus === 'cancelled') return 'Cancelled';
  return 'Scheduled';
}

function drawingEntryText(period) {
  if (period.totalEntries !== null && period.totalEntries !== undefined) {
    const userCount = period.eligibleUserCount === null || period.eligibleUserCount === undefined
      ? ''
      : ` / ${formatAdminNumber(period.eligibleUserCount)} users`;
    return `${formatAdminNumber(period.totalEntries)} entries${userCount}`;
  }
  return `${formatAdminNumber(period.estimatedEntries || 0)} estimated`;
}

function drawingPeriodByDrawingId(drawingId) {
  return (backendCollections.rewardPeriods || [])
    .find(period => period.drawingId === drawingId);
}

function compactHash(value) {
  const hash = String(value || '');
  if (!hash) return 'Not recorded';
  if (hash.length <= 28) return hash;
  return `${hash.slice(0, 14)}...${hash.slice(-14)}`;
}

function drawingReceiptJson(period = {}) {
  if (!period.auditReceipt) return '';
  try {
    return JSON.stringify(period.auditReceipt, null, 2);
  } catch {
    return '';
  }
}

function drawingReceiptHtml(period = {}) {
  const receiptJson = drawingReceiptJson(period);
  const receipt = period.auditReceipt || {};
  const random = receipt.random || {};
  const eligibility = receipt.eligibility || {};
  const excludedUsernames = Array.isArray(eligibility.excluded_usernames)
    ? eligibility.excluded_usernames.join(', ')
    : 'scoop, osprey, tinascoop';
  const hasReceipt = receiptJson || period.auditReceiptHash || period.entrySnapshotHash || period.snapshotCutoffAt;

  if (!hasReceipt) return '';

  return `
    <details class="admin-drawing-receipt">
      <summary><span>Audit receipt</span></summary>
      <div class="admin-drawing-receipt-grid">
        <div>
          <span>Receipt hash</span>
          <strong title="${escapeHtml(period.auditReceiptHash || '')}">${escapeHtml(compactHash(period.auditReceiptHash))}</strong>
        </div>
        <div>
          <span>Entry snapshot hash</span>
          <strong title="${escapeHtml(period.entrySnapshotHash || '')}">${escapeHtml(compactHash(period.entrySnapshotHash))}</strong>
        </div>
        <div>
          <span>Random method</span>
          <strong>${escapeHtml([random.source, random.method].filter(Boolean).join(' / ') || 'pgcrypto / rejection sampling')}</strong>
        </div>
        <div>
          <span>Excluded profiles</span>
          <strong>${escapeHtml(excludedUsernames)}</strong>
        </div>
      </div>
      ${receiptJson ? `<pre class="admin-drawing-receipt-json">${escapeHtml(receiptJson)}</pre>` : ''}
    </details>
  `;
}

function winnerEmailSubject(period = {}) {
  return `Open Play Map ${formatAdminMonth(period.drawingMonth)} drawing`;
}

function winnerEmailBody(period = {}) {
  const month = formatAdminMonth(period.drawingMonth);
  const username = period.winnerUsername || 'there';
  const prize = period.prize || 'a Scoop Pickleball paddle or up to $100 in gear';
  const credits = period.activeCreditsAtDraw ?? 'your winning';
  const rulesUrl = new URL(period.officialRulesUrl || 'official-rules.html', window.location.origin).href;

  return [
    `Hi ${username},`,
    '',
    `You were selected as the potential winner for the ${month} Open Play Map monthly Scoop Pickleball drawing.`,
    '',
    `Prize: ${prize}`,
    `Winning active credits: ${credits}`,
    '',
    'To claim, please reply within 14 calendar days and confirm:',
    '- Your preferred prize',
    '- Your shipping name and address',
    '- That you are at least 18 and a legal resident of the 50 United States or DC',
    '',
    `Official Rules: ${rulesUrl}`,
    '',
    'Thanks,',
    'Scoop Pickleball'
  ].join('\n');
}

function winnerMailtoHref(period = {}) {
  return [
    `mailto:${encodeURIComponent(period.winnerEmail || '')}`,
    `?subject=${encodeURIComponent(winnerEmailSubject(period))}`,
    `&body=${encodeURIComponent(winnerEmailBody(period))}`
  ].join('');
}

function drawingActionHtml(period) {
  const actions = [];
  if (period.canRun) {
    actions.push(`<button class="secondary-button admin-edit-button admin-approve-button" type="button" data-run-drawing="${escapeHtml(period.drawingMonth)}">Run drawing</button>`);
  }
  if (period.canNotify && period.drawingId) {
    actions.push(`<button class="secondary-button admin-edit-button" type="button" data-email-drawing="${escapeHtml(period.drawingId)}">Email winner</button>`);
    actions.push(`<button class="secondary-button admin-edit-button admin-approve-button" type="button" data-notify-drawing="${escapeHtml(period.drawingId)}">Mark emailed</button>`);
  } else if (period.drawingStatus === 'drawn' && !period.winnerNotifiedAt && period.drawingId && !period.winnerEmail) {
    actions.push('<button class="secondary-button admin-edit-button" type="button" disabled>No email</button>');
  }
  if (period.canClaim && period.drawingId) {
    actions.push(`<button class="secondary-button admin-edit-button admin-approve-button" type="button" data-claim-drawing="${escapeHtml(period.drawingId)}">Mark claimed</button>`);
  }
  if (period.canRedraw && period.drawingId) {
    actions.push(`<button class="secondary-button admin-delete-button" type="button" data-redraw-drawing="${escapeHtml(period.drawingId)}">Redraw</button>`);
  }
  if (!actions.length) {
    actions.push('<button class="secondary-button admin-edit-button" type="button" disabled>No action</button>');
  }
  return actions.join('');
}

function drawingCard(period) {
  const card = document.createElement('article');
  card.className = 'admin-card';
  const winnerLabel = period.winnerUsername
    ? `${period.winnerUsername}${period.drawingStatus === 'claimed' ? '' : ' (potential)'}`
    : 'No winner yet';
  const deadlineLabel = period.winnerClaimDeadline
    ? formatAdminDateTime(period.winnerClaimDeadline)
    : (period.drawingStatus === 'drawn' ? 'Awaiting email' : 'None');
  const drawLabel = formatAdminDateTime(period.drawingAt);
  const snapshotCutoffLabel = period.snapshotCutoffAt
    ? formatAdminDateTime(period.snapshotCutoffAt)
    : formatAdminDateTime(period.drawingAt);
  card.innerHTML = `
    <div class="admin-row-summary admin-drawing-row">
      <div class="admin-row-main">
        <h3>${escapeHtml(formatAdminMonth(period.drawingMonth))}</h3>
        <p>Cutoff ${escapeHtml(snapshotCutoffLabel)}</p>
      </div>
      <span>${escapeHtml(drawingStatusLabel(period))}</span>
      <span>${escapeHtml(drawingEntryText(period))}</span>
      <span>${escapeHtml(winnerLabel)}</span>
      <span>${escapeHtml(deadlineLabel)}</span>
      <div class="admin-row-actions">
        ${drawingActionHtml(period)}
      </div>
    </div>
    <div class="admin-expanded-summary admin-drawing-summary">
      <div>
        <span>Prize</span>
        <strong>${escapeHtml(period.prize || 'Paddle or $100 gear')}</strong>
      </div>
      <div>
        <span>Rules</span>
        <strong>${escapeHtml(period.rulesVersion || '2026-08-07')}</strong>
      </div>
      <div>
        <span>Potential winner entries</span>
        <strong>${escapeHtml(period.activeCreditsAtDraw ?? 'Not drawn')}</strong>
      </div>
      <div>
        <span>Notification</span>
        <strong>${escapeHtml(period.winnerNotifiedAt ? formatAdminDateTime(period.winnerNotifiedAt) : 'Not emailed')}</strong>
      </div>
      <div>
        <span>Scheduled draw</span>
        <strong>${escapeHtml(drawLabel)}</strong>
      </div>
      <div>
        <span>Eligible users</span>
        <strong>${escapeHtml(period.eligibleUserCount ?? 'Not drawn')}</strong>
      </div>
      <div>
        <span>Entry snapshot hash</span>
        <strong title="${escapeHtml(period.entrySnapshotHash || '')}">${escapeHtml(compactHash(period.entrySnapshotHash))}</strong>
      </div>
      <div>
        <span>Winner email</span>
        <strong>${escapeHtml(period.winnerEmail || 'Not available')}</strong>
      </div>
    </div>
    ${drawingReceiptHtml(period)}
    <p class="form-hint" data-drawing-hint></p>
  `;

  card.querySelectorAll('[data-run-drawing]').forEach(button => {
    button.addEventListener('click', () => runDrawing(button.dataset.runDrawing, button));
  });
  card.querySelectorAll('[data-email-drawing]').forEach(button => {
    button.addEventListener('click', () => emailDrawing(button.dataset.emailDrawing, button));
  });
  card.querySelectorAll('[data-notify-drawing]').forEach(button => {
    button.addEventListener('click', () => markDrawingNotified(button.dataset.notifyDrawing, button));
  });
  card.querySelectorAll('[data-claim-drawing]').forEach(button => {
    button.addEventListener('click', () => claimDrawing(button.dataset.claimDrawing, button));
  });
  card.querySelectorAll('[data-redraw-drawing]').forEach(button => {
    button.addEventListener('click', () => redrawDrawing(button.dataset.redrawDrawing, button));
  });
  return card;
}

function renderDrawings() {
  const rewardPeriods = backendCollections.rewardPeriods || [];
  setAdminNavLabel('drawings', 'Drawings', rewardPeriods.length);
  elements.drawingsTitle.textContent = titleWithCount('Monthly drawings', rewardPeriods.length);
  elements.drawingCount.textContent = `${rewardPeriods.length} drawing period${rewardPeriods.length === 1 ? '' : 's'}`;

  if (!rewardPeriods.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-profile-list';
    empty.textContent = 'No drawing periods yet.';
    elements.drawingsList.replaceChildren(empty);
    return;
  }

  elements.drawingsList.replaceChildren(adminListHeader('drawing'), ...rewardPeriods.map(drawingCard));
}

function setDrawingHint(button, message, isError = false) {
  const hint = button.closest('.admin-card')?.querySelector('[data-drawing-hint]');
  if (!hint) return;
  hint.textContent = message;
  hint.classList.toggle('is-error', isError);
}

async function refreshDrawingAdmin() {
  await loadBackendCollections();
  renderDrawings();
  renderUsers();
}

async function runDrawing(drawingMonth, button) {
  if (!window.confirm(`Run the ${formatAdminMonth(drawingMonth)} monthly drawing now?`)) return;
  button.disabled = true;
  setDrawingHint(button, 'Running drawing...');

  try {
    await window.OpenPlaySupabase.runMonthlyDrawing(drawingMonth);
    await refreshDrawingAdmin();
  } catch (error) {
    button.disabled = false;
    setDrawingHint(button, error.message, true);
  }
}

function emailDrawing(drawingId, button) {
  const period = drawingPeriodByDrawingId(drawingId);
  if (!period?.winnerEmail) {
    setDrawingHint(button, 'Winner email is not available.', true);
    return;
  }

  window.location.href = winnerMailtoHref(period);
  setDrawingHint(button, 'Email draft opened. After sending it, click Mark emailed.');
}

async function markDrawingNotified(drawingId, button) {
  if (!window.confirm('Mark this winner as emailed and start the 14-day claim deadline now?')) return;
  button.disabled = true;
  setDrawingHint(button, 'Marking emailed...');

  try {
    await window.OpenPlaySupabase.markMonthlyDrawingNotified(drawingId);
    await refreshDrawingAdmin();
  } catch (error) {
    button.disabled = false;
    setDrawingHint(button, error.message, true);
  }
}

async function claimDrawing(drawingId, button) {
  if (!window.confirm('Mark this winner as claimed? Their active drawing credits were already reset to credits earned after the drawing snapshot.')) return;
  button.disabled = true;
  setDrawingHint(button, 'Marking claimed...');

  try {
    await window.OpenPlaySupabase.claimMonthlyDrawing(drawingId);
    await refreshDrawingAdmin();
  } catch (error) {
    button.disabled = false;
    setDrawingHint(button, error.message, true);
  }
}

async function redrawDrawing(drawingId, button) {
  if (!window.confirm('Run a redraw from the same original entry pool?')) return;
  button.disabled = true;
  setDrawingHint(button, 'Running redraw...');

  try {
    await window.OpenPlaySupabase.runMonthlyRedraw(drawingId);
    await refreshDrawingAdmin();
  } catch (error) {
    button.disabled = false;
    setDrawingHint(button, error.message, true);
  }
}

async function approveLocation(locationId) {
  const remoteCourt = allCourts.find(court => court.id === locationId && court.remoteId);
  if (remoteCourt) {
    try {
      const approved = await window.OpenPlaySupabase.updateLocationStatus(remoteCourt.remoteId, 'approved', currentAdminUser?.id);
      allCourts = allCourts.map(court => court.id === locationId ? approved : court);
      await loadBackendCollections();
      renderModeration();
      renderPendingPosts();
      renderLocations();
      renderUsers();
      renderDrawings();
    } catch (error) {
      const moderationTarget = elements.moderationList.querySelector(`[data-approve-location="${CSS.escape(locationId)}"]`);
      const moderationMeta = moderationTarget?.closest('.moderation-item')?.querySelector('.moderation-meta');
      if (moderationMeta) {
        moderationMeta.insertAdjacentHTML('afterend', `<p class="form-hint">${escapeHtml(error.message)}</p>`);
      } else {
        window.alert(error.message || 'Could not approve that location.');
      }
    }
    return;
  }

  const submissions = getSavedSubmissions();
  const nextSubmissions = submissions.map(court => (
    court.id === locationId
      ? { ...court, status: 'approved', approvedAt: todayIso(), updatedAt: court.updatedAt || todayIso() }
      : court
  ));
  saveDeletedLocationIds(getDeletedLocationIds().filter(id => id !== locationId));
  saveSubmissions(nextSubmissions);
  saveCredits(getSavedCredits().map(credit => (
    credit.targetType === 'location' && credit.targetId === locationId && credit.status !== 'approved'
      ? { ...credit, status: 'approved' }
      : credit
  )));
  const approved = nextSubmissions.find(court => court.id === locationId);
  if (approved && !allCourts.some(court => court.id === locationId)) {
    allCourts.push(approved);
  } else if (approved) {
    allCourts = allCourts.map(court => court.id === locationId ? approved : court);
  }
  renderModeration();
  renderPendingPosts();
  renderLocations();
  renderUsers();
  renderDrawings();
}

async function rejectLocation(locationId) {
  const remoteCourt = allCourts.find(court => court.id === locationId && court.remoteId);
  const court = remoteCourt || getSavedSubmissions().find(item => item.id === locationId);
  const confirmed = window.confirm(`Reject ${court?.name || 'this location'}? It will not appear on the map.`);
  if (!confirmed) return;

  if (remoteCourt) {
    try {
      const rejected = await window.OpenPlaySupabase.updateLocationStatus(remoteCourt.remoteId, 'rejected', currentAdminUser?.id);
      allCourts = allCourts.map(item => item.id === locationId ? rejected : item);
      await loadBackendCollections();
      renderModeration();
      renderPendingPosts();
      renderLocations();
      renderUsers();
      renderDrawings();
    } catch (error) {
      const moderationTarget = elements.moderationList.querySelector(`[data-reject-location="${CSS.escape(locationId)}"]`);
      const moderationMeta = moderationTarget?.closest('.moderation-item')?.querySelector('.moderation-meta');
      if (moderationMeta) {
        moderationMeta.insertAdjacentHTML('afterend', `<p class="form-hint">${escapeHtml(error.message)}</p>`);
      } else {
        window.alert(error.message || 'Could not reject that location.');
      }
    }
    return;
  }

  const rejected = {
    ...court,
    status: 'rejected',
    updatedAt: todayIso()
  };
  upsertSavedLocation(rejected);
  saveCredits(getSavedCredits().map(credit => (
    credit.targetType === 'location' && credit.targetId === locationId && credit.status === 'pending'
      ? { ...credit, status: 'rejected' }
      : credit
  )));
  allCourts = allCourts.map(item => item.id === locationId ? rejected : item);
  renderModeration();
  renderPendingPosts();
  renderLocations();
  renderUsers();
  renderDrawings();
}

async function updatePhotoModerationStatus(photoId, status) {
  const photo = (backendCollections.photos || []).find(item => item.id === photoId);
  if (!photo) return;

  let updatedPhoto = null;
  try {
    updatedPhoto = await window.OpenPlaySupabase.updatePhotoStatus(photo.remoteId || photo.id, status, currentAdminUser?.id);
  } catch (error) {
    window.alert(error.message || `Could not ${status} that photo.`);
    return;
  }

  if (status === 'approved' && (updatedPhoto?.reviewId || photo.reviewId)) {
    try {
      await window.OpenPlaySupabase.appendPendingInstagramPostImage?.(
        updatedPhoto.remoteLocationId || photo.remoteLocationId,
        updatedPhoto.url || photo.url,
        currentAdminUser?.id
      );
    } catch (error) {
      console.error(error);
      window.alert('Photo approved, but the pending Instagram post could not be updated.');
    }
  }

  await loadBackendCollections();
  renderModeration();
  renderPendingPosts();
  renderUsers();
  renderDrawings();
}

async function approvePhoto(photoId) {
  await updatePhotoModerationStatus(photoId, 'approved');
}

async function rejectPhoto(photoId) {
  const confirmed = window.confirm('Reject this photo? It will not appear publicly on the map.');
  if (!confirmed) return;
  await updatePhotoModerationStatus(photoId, 'rejected');
}

function findReviewById(reviewId) {
  return allReviewsWithCourt().find(review => review.id === reviewId || review.remoteId === reviewId) || null;
}

function selectedAdminReviewSkills(editor) {
  return [...editor.querySelectorAll('input[name="adminReviewSkillLevel"]:checked')]
    .map(input => input.value);
}

function adminReviewField(editor, name) {
  return editor.querySelector(`[data-review-field="${name}"]`)?.value.trim() || '';
}

function reviewFromEditor(editor, existing) {
  return {
    ...existing,
    status: adminReviewField(editor, 'status') || 'published',
    visited: adminReviewField(editor, 'visited'),
    skillLevels: selectedAdminReviewSkills(editor),
    crowdLevel: adminReviewField(editor, 'crowdLevel'),
    bestTime: adminReviewField(editor, 'bestTime'),
    openPlayReliability: adminReviewField(editor, 'openPlayReliability'),
    netSetup: adminReviewField(editor, 'netSetup'),
    playFormat: adminReviewField(editor, 'playFormat'),
    beginnerFriendliness: adminReviewField(editor, 'beginnerFriendliness'),
    fees: adminReviewField(editor, 'fees'),
    amenities: adminReviewField(editor, 'amenities'),
    lighting: adminReviewField(editor, 'lighting'),
    schedulingApp: adminReviewField(editor, 'schedulingApp'),
    body: adminReviewField(editor, 'body'),
    updatedAt: todayIso()
  };
}

function upsertSavedReview(nextReview, previousReview = {}) {
  const reviews = getSavedReviews();
  const reviewId = nextReview.id || previousReview.id;
  const courtKey = previousReview.courtId || nextReview.courtId;
  let targetKey = courtKey;

  Object.entries(reviews).forEach(([key, reviewList]) => {
    if ((reviewList || []).some(review => review.id === reviewId || review.remoteId === reviewId)) {
      targetKey = key;
    }
  });

  if (!targetKey) targetKey = nextReview.courtId || previousReview.courtId;
  if (!targetKey) return;

  reviews[targetKey] = reviews[targetKey] || [];
  const index = reviews[targetKey].findIndex(review => review.id === reviewId || review.remoteId === reviewId);
  const normalizedReview = {
    ...previousReview,
    ...nextReview,
    id: reviewId,
    courtId: previousReview.courtId || nextReview.courtId || targetKey,
    courtName: previousReview.courtName || nextReview.courtName || ''
  };

  if (index >= 0) {
    reviews[targetKey][index] = normalizedReview;
  } else {
    reviews[targetKey].unshift(normalizedReview);
  }

  saveReviews(reviews);
}

async function saveAdminReviewEdit(event) {
  const button = event.currentTarget;
  const editor = button.closest('[data-admin-review-id]');
  const hint = editor.querySelector('[data-admin-review-hint]');
  const reviewId = editor.dataset.adminReviewId;
  const existing = findReviewById(reviewId);
  if (!existing) return;

  const nextReview = reviewFromEditor(editor, existing);
  hint.textContent = 'Saving...';

  if (existing.remoteId && window.OpenPlaySupabase?.updateAdminReview) {
    try {
      const savedReview = await window.OpenPlaySupabase.updateAdminReview(existing.remoteId, nextReview, currentAdminUser?.id);
      upsertSavedReview({
        ...nextReview,
        ...savedReview,
        courtId: existing.courtId,
        courtName: existing.courtName
      }, existing);
      await loadBackendCollections();
      editor.querySelector('.moderation-badge').textContent = savedReview.status || nextReview.status;
      hint.textContent = 'Saved.';
      renderModeration();
      renderUsers();
      renderDrawings();
    } catch (error) {
      hint.textContent = error.message || 'Could not save that review.';
    }
    return;
  }

  if (!allowPrototypeContributionStorage()) {
    hint.textContent = PRODUCTION_DATABASE_UNAVAILABLE;
    return;
  }

  upsertSavedReview(nextReview, existing);
  editor.querySelector('.moderation-badge').textContent = nextReview.status;
  hint.textContent = 'Saved.';
  renderModeration();
  renderUsers();
}

async function removeReviewPhoto(event) {
  const button = event.currentTarget;
  const photoId = button.dataset.removeReviewPhoto;
  const photo = (backendCollections.photos || []).find(item => item.id === photoId || item.remoteId === photoId);
  const confirmed = window.confirm('Delete this review picture? It will be removed from the review.');
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = 'Deleting...';

  try {
    if (photo?.remoteId && window.OpenPlaySupabase?.removeAdminPhoto) {
      await window.OpenPlaySupabase.removeAdminPhoto(photo.remoteId, photo.storagePath || button.dataset.reviewPhotoStoragePath || '');
      await loadBackendCollections();
    }
    backendCollections.photos = (backendCollections.photos || []).filter(item => item.id !== photoId && item.remoteId !== photoId);
    const item = button.closest('.admin-review-photo-item');
    const list = item?.closest('.admin-review-photo-list');
    item?.remove();
    if (list && !list.querySelector('.admin-review-photo-item')) {
      list.outerHTML = '<p class="empty-profile-list">No review photos.</p>';
    }
    renderModeration();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Delete picture';
    window.alert(error.message || 'Could not delete that review picture.');
  }
}

function setupAdminReviewEditors(container) {
  container.querySelectorAll('[data-open-admin-review-photo]').forEach(button => {
    button.addEventListener('click', () => {
      const photos = adminReviewPhotosFromButton(button);
      const index = photos.findIndex(photo => photo.url === button.dataset.adminReviewPhotoUrl);
      openAdminPhotoLightbox(photos, index >= 0 ? index : 0, button);
    });
  });
  container.querySelectorAll('[data-save-admin-review]').forEach(button => {
    button.addEventListener('click', saveAdminReviewEdit);
  });
  container.querySelectorAll('[data-remove-review-photo]').forEach(button => {
    button.addEventListener('click', removeReviewPhoto);
  });
  container.querySelectorAll('.admin-review-editor').forEach(editor => {
    editor.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.target.matches('textarea, button')) {
        event.preventDefault();
      }
    });
  });
}

function awardSuggestedEditCredits(edit) {
  if (!edit.userId) return;
  const credits = getSavedCredits();
  if (credits.some(credit => credit.targetType === 'suggested-edit' && credit.targetId === edit.id)) return;
  const user = getUsers().find(item => item.id === edit.userId);
  credits.push({
    id: `credit-${Date.now()}-${credits.length}`,
    userId: edit.userId,
    username: user?.username || edit.username || 'Player',
    action: 'suggested-edit',
    targetType: 'suggested-edit',
    targetId: edit.id,
    locationId: edit.locationId,
    activeCreditsDelta: SUGGESTED_EDIT_CREDITS,
    lifetimeCreditsDelta: SUGGESTED_EDIT_CREDITS,
    createdAt: todayIso(),
    month: todayIso().slice(0, 7),
    status: 'approved'
  });
  saveCredits(credits);
}

async function approveSuggestedEdit(editId) {
  const edits = getSavedSuggestedEdits();
  const edit = edits.find(item => item.id === editId && (item.status || 'pending') === 'pending');
  if (!edit) return;

  const current = liveLocationForSuggestedEdit(edit);
  const suggested = edit.suggestedLocation || {};
  const nextCourt = {
    ...current,
    ...suggested,
    id: edit.locationId,
    country: suggested.country || current.country || 'USA',
    icon: suggested.icon || current.icon || 'OP',
    status: 'approved',
    updatedAt: todayIso(),
    lastVerified: todayIso(),
    suggestedEditApprovedAt: todayIso(),
    lastSuggestedEditBy: edit.userId,
    lastSuggestedEditByUsername: edit.username || 'Player'
  };

  if (edit.remoteId && window.OpenPlaySupabase?.approveSuggestedEdit) {
    try {
      const savedCourt = await window.OpenPlaySupabase.approveSuggestedEdit(edit, nextCourt, currentAdminUser?.id);
      allCourts = allCourts.some(court => court.id === savedCourt.id)
        ? allCourts.map(court => court.id === savedCourt.id ? savedCourt : court)
        : [...allCourts, savedCourt];
      saveSuggestedEdits(edits.map(item => (
        item.id === editId
          ? { ...item, status: 'approved', approvedAt: todayIso(), approvedLocation: savedCourt }
          : item
      )));
      await loadBackendCollections();
      renderModeration();
      renderLocations();
      renderUsers();
      renderDrawings();
    } catch (error) {
      window.alert(error.message || 'Could not approve that suggested edit.');
    }
    return;
  }

  if (!allowPrototypeContributionStorage()) {
    window.alert(PRODUCTION_DATABASE_UNAVAILABLE);
    return;
  }

  upsertSavedLocation(nextCourt);
  allCourts = allCourts.some(court => court.id === nextCourt.id)
    ? allCourts.map(court => court.id === nextCourt.id ? nextCourt : court)
    : [...allCourts, nextCourt];

  saveSuggestedEdits(edits.map(item => (
    item.id === editId
      ? { ...item, status: 'approved', approvedAt: todayIso(), approvedLocation: nextCourt }
      : item
  )));
  awardSuggestedEditCredits(edit);
  renderModeration();
  renderLocations();
  renderUsers();
}

async function rejectSuggestedEdit(editId) {
  const edits = getSavedSuggestedEdits();
  const edit = edits.find(item => item.id === editId && (item.status || 'pending') === 'pending');
  const confirmed = window.confirm(`Reject suggested edit for ${edit?.locationName || 'this location'}?`);
  if (!confirmed) return;

  if (edit?.remoteId && window.OpenPlaySupabase?.rejectSuggestedEdit) {
    try {
      await window.OpenPlaySupabase.rejectSuggestedEdit(edit.remoteId, currentAdminUser?.id);
      saveSuggestedEdits(edits.map(item => (
        item.id === editId ? { ...item, status: 'rejected', rejectedAt: todayIso() } : item
      )));
      await loadBackendCollections();
      renderModeration();
    } catch (error) {
      window.alert(error.message || 'Could not reject that suggested edit.');
    }
    return;
  }

  if (!allowPrototypeContributionStorage()) {
    window.alert(PRODUCTION_DATABASE_UNAVAILABLE);
    return;
  }

  saveSuggestedEdits(edits.map(item => (
    item.id === editId ? { ...item, status: 'rejected', rejectedAt: todayIso() } : item
  )));
  renderModeration();
}

async function dismissReport(reportId) {
  const report = getSavedReports().find(item => item.id === reportId);
  if (report?.remoteId && window.OpenPlaySupabase?.updateReportStatus) {
    try {
      await window.OpenPlaySupabase.updateReportStatus(report.remoteId, 'dismissed', currentAdminUser?.id);
      saveReports(getSavedReports().map(item => (
        item.id === reportId ? { ...item, status: 'dismissed', resolvedAt: todayIso() } : item
      )));
      renderModeration();
    } catch (error) {
      window.alert(error.message || 'Could not dismiss that report.');
    }
    return;
  }

  if (!allowPrototypeContributionStorage()) {
    window.alert(PRODUCTION_DATABASE_UNAVAILABLE);
    return;
  }

  saveReports(getSavedReports().map(report => (
    report.id === reportId ? { ...report, status: 'dismissed', resolvedAt: todayIso() } : report
  )));
  renderModeration();
}

function markReportResolved(reportId) {
  saveReports(getSavedReports().map(report => (
    report.id === reportId ? { ...report, status: 'resolved', resolvedAt: todayIso() } : report
  )));
}

async function deleteReportedReview(report) {
  const review = findReviewForReport(report);
  const reviewId = report.reviewId || report.remoteTargetId || review?.remoteId || review?.id || '';
  const courtId = review?.courtId || report.targetId;
  if (!reviewId) {
    window.alert('Could not find that reported review.');
    return;
  }

  if (report?.remoteId && window.OpenPlaySupabase?.removeReviewForReport) {
    try {
      await window.OpenPlaySupabase.removeReviewForReport(reviewId, report.remoteId, currentAdminUser?.id);
      await loadBackendCollections();
      const reviews = getSavedReviews();
      Object.keys(reviews).forEach(key => {
        reviews[key] = reviews[key].filter(item => item.id !== reviewId && item.remoteId !== reviewId);
      });
      saveReviews(reviews);
      markReportResolved(report.id);
      renderModeration();
      renderUsers();
      renderDrawings();
    } catch (error) {
      window.alert(error.message || 'Could not remove that review.');
    }
    return;
  }

  if (!allowPrototypeContributionStorage()) {
    window.alert(PRODUCTION_DATABASE_UNAVAILABLE);
    return;
  }

  const reviews = getSavedReviews();
  Object.keys(reviews).forEach(key => {
    reviews[key] = reviews[key].filter(item => item.id !== reviewId && item.remoteId !== reviewId);
  });
  saveReviews(reviews);
  markReportResolved(report.id);
  renderModeration();
  renderUsers();
}

async function deleteReportedLocation(report) {
  const court = findCourtForReport(report);
  if (!court) {
    window.alert('Could not find that reported location.');
    return;
  }

  if (court.remoteId && window.OpenPlaySupabase?.updateLocationStatus) {
    try {
      const archived = await window.OpenPlaySupabase.updateLocationStatus(court.remoteId, 'archived', currentAdminUser?.id);
      if (report.remoteId && window.OpenPlaySupabase?.updateReportStatus) {
        await window.OpenPlaySupabase.updateReportStatus(report.remoteId, 'resolved', currentAdminUser?.id);
      }
      await loadBackendCollections();
      allCourts = allCourts.map(item => (
        item.id === court.id || item.remoteId === court.remoteId ? archived : item
      ));
      markReportResolved(report.id);
      renderModeration();
      renderLocations();
      renderUsers();
      renderDrawings();
    } catch (error) {
      window.alert(error.message || 'Could not delete that location.');
    }
    return;
  }

  if (!allowPrototypeContributionStorage()) {
    window.alert(PRODUCTION_DATABASE_UNAVAILABLE);
    return;
  }

  const deletedIds = new Set(getDeletedLocationIds());
  deletedIds.add(court.id);
  saveDeletedLocationIds([...deletedIds]);
  const archived = { ...court, status: 'archived', updatedAt: todayIso() };
  upsertSavedLocation(archived);
  markReportResolved(report.id);
  allCourts = allCourts.map(item => item.id === court.id ? archived : item);
  renderModeration();
  renderLocations();
  renderUsers();
  renderDrawings();
}

async function deleteReportedContribution(reportId) {
  const report = getSavedReports().find(item => item.id === reportId);
  if (!report) return;

  const targetName = report.targetName || report.targetId || 'this contribution';
  const confirmed = await confirmAdminDelete(`Are you sure you want to delete ${targetName}? This cannot be undone from the admin report queue.`);
  if (!confirmed) return;

  if (report.targetType === 'review') {
    await deleteReportedReview(report);
  } else {
    await deleteReportedLocation(report);
  }
}

async function deleteLocation(court) {
  const confirmed = window.confirm(`Delete ${court.name}? This removes it from the admin panel and map.`);
  if (!confirmed) return;

  if (court.remoteId) {
    try {
      const archived = await window.OpenPlaySupabase.updateLocationStatus(court.remoteId, 'archived', currentAdminUser?.id);
      await loadBackendCollections();
      allCourts = allCourts.map(item => item.id === court.id ? archived : item);
      renderModeration();
      renderLocations();
      renderUsers();
      renderDrawings();
    } catch (error) {
      window.alert(error.message);
    }
    return;
  }

  if (!allowPrototypeContributionStorage()) {
    window.alert(PRODUCTION_DATABASE_UNAVAILABLE);
    return;
  }

  const deletedIds = new Set(getDeletedLocationIds());
  deletedIds.add(court.id);
  saveDeletedLocationIds([...deletedIds]);
  const archived = { ...court, status: 'archived', updatedAt: todayIso() };
  upsertSavedLocation(archived);
  saveReports(getSavedReports().map(report => (
    report.targetId === court.id ? { ...report, status: 'resolved', resolvedAt: todayIso() } : report
  )));
  allCourts = allCourts.map(item => item.id === court.id ? archived : item);
  renderModeration();
  renderLocations();
  renderUsers();
  renderDrawings();
}

async function saveLocationEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const hint = form.querySelector('[data-admin-hint]');
  const locationId = form.dataset.locationId;
  const existing = allCourts.find(court => court.id === locationId);
  if (!existing) return;

  const access = form.elements.access.value;
  const openPlayFee = access === 'paid' ? normalizeOpenPlayFee(form.elements.openPlayFee.value) : null;
  const lat = Number(form.elements.latitude.value);
  const lng = Number(form.elements.longitude.value);
  const courtCountValue = form.elements.courtCount.value.trim();
  const courtCount = courtCountValue ? Number(courtCountValue) : null;
  const skillLevels = selectedLocationSkills(form);
  const estimatedSkillLevel = formatLocationSkillLevel(skillLevels);
  const photoUrls = form.elements.photos.value
    .split(',')
    .map(photo => photo.trim())
    .filter(Boolean);
  const nextCourt = {
    ...existing,
    name: form.elements.name.value.trim(),
    address: form.elements.address.value.trim(),
    city: form.elements.city.value.trim(),
    state: form.elements.state.value.trim().toUpperCase(),
    country: existing.country || 'USA',
    latitude: lat,
    longitude: lng,
    access,
    isFree: access === 'public',
    openPlayFee,
    openPlay: getOpenPlaySlots(form),
    skillLevels,
    estimatedSkillLevel,
    courts: {
      count: courtCount,
      surface: existing.courts?.surface || 'unknown',
      indoorOutdoor: existing.courts?.indoorOutdoor || 'unknown'
    },
    photos: photoUrls,
    notes: form.elements.notes.value.trim(),
    websiteUrl: normalizeWebsiteUrl(form.elements.websiteUrl.value),
    phoneNumber: normalizedPhoneNumber(form.elements.phoneNumber.value),
    adminEdited: true,
    updatedAt: todayIso(),
    status: existing.status || 'approved',
    lastVerified: todayIso()
  };

  if (!nextCourt.name || !nextCourt.address || !nextCourt.city || !nextCourt.state) {
    hint.textContent = 'Name, address, city, and state are required.';
    return;
  }

  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    hint.textContent = 'Latitude must be between -90 and 90, and longitude must be between -180 and 180.';
    return;
  }

  if (courtCount !== null && (!Number.isInteger(courtCount) || courtCount < 0)) {
    hint.textContent = 'Please enter a whole number of courts, or leave it blank.';
    return;
  }

  if (form.elements.websiteUrl.value.trim() && !nextCourt.websiteUrl) {
    hint.textContent = 'Add a valid website link, or leave it blank.';
    form.elements.websiteUrl.focus();
    return;
  }

  if (access === 'paid' && openPlayFee === null) {
    hint.textContent = 'Enter the open play fee for public paid open play.';
    form.elements.openPlayFee.focus();
    return;
  }

  if (existing.remoteId) {
    try {
      const savedCourt = await window.OpenPlaySupabase.saveAdminLocation(nextCourt);
      allCourts = allCourts.map(court => court.id === locationId ? savedCourt : court);
      hint.textContent = 'Saved.';
      renderModeration();
      renderPendingPosts();
      renderLocations();
    } catch (error) {
      hint.textContent = error.message;
    }
    return;
  }

  if (!allowPrototypeContributionStorage()) {
    hint.textContent = PRODUCTION_DATABASE_UNAVAILABLE;
    return;
  }

  upsertSavedLocation(nextCourt);
  allCourts = allCourts.map(court => court.id === locationId ? nextCourt : court);
  hint.textContent = 'Saved.';
  renderModeration();
  renderPendingPosts();
  renderLocations();
}

async function loadCourts() {
  try {
    let seedCourts = await window.OpenPlaySupabase?.fetchAdminLocations?.();
    if (!seedCourts) {
      seedCourts = await window.OpenPlaySupabase?.fetchApprovedLocations?.();
    }
    if (!seedCourts) {
      const response = await fetch('data/courts.json');
      seedCourts = response.ok ? await response.json() : [];
    }
    allCourts = mergeSavedLocations(seedCourts, getSavedSubmissions());
  } catch {
    allCourts = getSavedSubmissions();
  }
}

async function loadUsers() {
  try {
    authUsers = await window.OpenPlayAuth?.listProfiles?.() || null;
  } catch (error) {
    console.warn('Supabase profile load failed.', error);
    authUsers = null;
  }
}

async function loadBackendCollections() {
  try {
    const collections = await window.OpenPlaySupabase?.fetchAdminCollections?.();
    if (!collections) return;
    backendCollections = {
      reviews: collections.reviews || {},
      reports: collections.reports || [],
      suggestedEdits: collections.suggestedEdits || [],
      credits: collections.credits || [],
      photos: collections.photos || [],
      instagramPosts: collections.instagramPosts || [],
      rewardPeriods: collections.rewardPeriods || []
    };
  } catch (error) {
    console.warn('Supabase moderation data load failed.', error);
    backendCollections = {
      reviews: null,
      reports: null,
      suggestedEdits: null,
      credits: null,
      photos: null,
      instagramPosts: null,
      rewardPeriods: null
    };
  }
}

async function init() {
  currentAdminUser = await currentUser();
  if (!isAdmin(currentAdminUser)) {
    elements.guard.hidden = false;
    elements.moderationSubnav.hidden = true;
    elements.locationsSubnav.hidden = true;
    elements.moderationView.hidden = true;
    elements.postsView.hidden = true;
    elements.usersView.hidden = true;
    elements.locationsView.hidden = true;
    elements.drawingsView.hidden = true;
    return;
  }

  await loadCourts();
  await loadUsers();
  await loadBackendCollections();
  renderModeration();
  renderPendingPosts();
  renderUsers();
  renderLocations();
  renderDrawings();
}

elements.navButtons.forEach(button => {
  button.addEventListener('click', () => showView(button.dataset.adminView));
});

elements.moderationNavButtons.forEach(button => {
  button.addEventListener('click', () => showModerationView(button.dataset.moderationView));
});

elements.locationNavButtons.forEach(button => {
  button.addEventListener('click', () => showLocationView(button.dataset.locationView));
});

elements.postsSearch?.addEventListener('input', event => {
  pendingPostSearchQuery = event.target.value;
  renderPendingPosts();
});

elements.deleteForm.addEventListener('submit', event => {
  event.preventDefault();
  resolveAdminDeleteConfirmation(true);
});

elements.deleteDialog.querySelector('[data-admin-delete-cancel]')?.addEventListener('click', () => {
  resolveAdminDeleteConfirmation(false);
});

elements.deleteDialog.addEventListener('close', () => {
  if (!deleteConfirmationRequest) return;
  deleteConfirmationRequest.resolve(false);
  deleteConfirmationRequest = null;
});

document.addEventListener('keydown', event => {
  if (adminPhotoLightbox.element?.hidden !== false) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeAdminPhotoLightbox();
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    stepAdminPhotoLightbox(-1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    stepAdminPhotoLightbox(1);
  }
});

init().catch(error => {
  console.error(error);
  elements.guard.hidden = false;
  elements.guard.querySelector('p').textContent = 'Could not load admin data.';
});
