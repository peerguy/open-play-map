const STORAGE_KEY = 'open-play-map-submissions';
const REVIEWS_KEY = 'open-play-map-reviews';
const CREDITS_KEY = 'open-play-map-credits';

const params = new URLSearchParams(location.search);
let allCourts = [];
let backendContributions = null;
let refreshAccountPromise = null;

const SKILL_LEVELS = {
  beginner: 'Beginner: Under 3.0',
  intermediate: 'Intermediate: 3.0-4.0',
  advanced: 'Advanced: 4.0+'
};

const CONTRIBUTION_CREDITS = {
  'add-location': 5,
  'add-review': 1,
  'add-photo': 2,
  'suggested-edit': 3
};

const elements = {
  notice: document.querySelector('#accountNotice'),
  currentUserCard: document.querySelector('#currentUserCard'),
  signupForm: document.querySelector('#signupForm'),
  signupEmail: document.querySelector('#signupEmail'),
  signupPassword: document.querySelector('#signupPassword'),
  signupPasswordConfirm: document.querySelector('#signupPasswordConfirm'),
  signupUsername: document.querySelector('#signupUsername'),
  signupSkillLevel: document.querySelector('#signupSkillLevel'),
  signupBio: document.querySelector('#signupBio'),
  signupTerms: document.querySelector('#signupTerms'),
  signupHint: document.querySelector('#signupHint'),
  loginForm: document.querySelector('#loginForm'),
  loginEmail: document.querySelector('#loginEmail'),
  loginPassword: document.querySelector('#loginPassword'),
  loginHint: document.querySelector('#loginHint'),
  authTabs: document.querySelectorAll('[data-auth-tab]'),
  authPanels: document.querySelectorAll('[data-auth-panel]'),
  passwordToggles: document.querySelectorAll('[data-toggle-password]')
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSavedSubmissions() {
  if (backendContributions?.locations) return backendContributions.locations;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function emptyBackendContributions(status = 'Not loaded') {
  return {
    locations: [],
    reviews: {},
    suggestedEdits: [],
    credits: [],
    creditBalances: { active: 0, lifetime: 0 },
    source: 'empty',
    status
  };
}

function getSavedReviews() {
  if (backendContributions?.reviews) return backendContributions.reviews;
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY) || '{}');
  } catch {
    return {};
  }
}

function getSavedCredits() {
  if (backendContributions?.credits) return backendContributions.credits;
  try {
    return JSON.parse(localStorage.getItem(CREDITS_KEY) || '[]');
  } catch {
    return [];
  }
}

function getCreditBalances(userId) {
  if (backendContributions?.creditBalances) {
    return {
      active: Number(backendContributions.creditBalances.active || 0),
      lifetime: Number(backendContributions.creditBalances.lifetime || 0)
    };
  }

  return getSavedCredits()
    .filter(credit => credit.userId === userId && (credit.status === 'approved' || !credit.status))
    .reduce((balances, credit) => ({
      active: balances.active + Number(credit.activeCreditsDelta || 0),
      lifetime: balances.lifetime + Number(credit.lifetimeCreditsDelta || 0)
    }), { active: 0, lifetime: 0 });
}

function normalizeSkillLevel(value, fallback = '') {
  return Object.hasOwn(SKILL_LEVELS, value) ? value : fallback;
}

function skillLevelLabel(value) {
  return SKILL_LEVELS[normalizeSkillLevel(value)] || '';
}

function contributionStatusLabel(status) {
  const labels = {
    approved: 'Approved',
    pending: 'Pending review',
    rejected: 'Rejected',
    published: 'Published',
    hidden: 'Hidden',
    removed: 'Removed'
  };
  return labels[status] || '';
}

function compactDate(value) {
  return value || '';
}

function photoUrl(photo) {
  if (typeof photo === 'string') return photo.trim();
  return String(photo?.url || photo?.storagePath || photo?.storage_path || '').trim();
}

function photoReviewId(photo) {
  return String(photo?.reviewId || photo?.review_id || '').trim();
}

function normalizedPhotos(photos = []) {
  return (photos || [])
    .map(photo => {
      const url = photoUrl(photo);
      if (!url) return null;
      const source = typeof photo === 'object' ? photo : {};
      return {
        ...source,
        id: source.id || source.remoteId || url,
        remoteId: source.remoteId || source.id || '',
        reviewId: photoReviewId(source),
        uploadedBy: source.uploadedBy || source.uploaded_by || '',
        url
      };
    })
    .filter(Boolean);
}

function approvedCreditRows() {
  return getSavedCredits().filter(credit => credit.status === 'approved' || !credit.status);
}

function idCandidates(item = {}) {
  return [...new Set([item.remoteId, item.id].filter(Boolean).map(String))];
}

function creditRowsFor(action, targetType, targetIds = []) {
  const ids = new Set(targetIds.filter(Boolean).map(String));
  if (!ids.size) return [];
  return approvedCreditRows().filter(credit => (
    credit.action === action
    && credit.targetType === targetType
    && ids.has(String(credit.targetId || ''))
  ));
}

function sumCreditRows(rows) {
  return rows.reduce((total, credit) => total + Number(credit.activeCreditsDelta || credit.lifetimeCreditsDelta || 0), 0);
}

function targetCreditValue(action, targetType, item, fallback = 0) {
  const rows = creditRowsFor(action, targetType, idCandidates(item));
  if (rows.length) return sumCreditRows(rows);
  return backendContributions?.credits ? 0 : fallback;
}

function photoCreditValue(photos = []) {
  const photoIds = photos.flatMap(idCandidates);
  const rows = creditRowsFor('add-photo', 'photo', photoIds);
  if (rows.length) return Math.min(sumCreditRows(rows), CONTRIBUTION_CREDITS['add-photo']);
  return backendContributions?.credits ? 0 : (photos.length ? CONTRIBUTION_CREDITS['add-photo'] : 0);
}

function imageCreditValue(parentType, item, photos = []) {
  const parentRows = creditRowsFor('add-photo', parentType, idCandidates(item));
  if (parentRows.length) return sumCreditRows(parentRows);
  return photoCreditValue(photos);
}

function contributionCreditPill(value) {
  return `<span class="profile-credit-pill">${Number(value) > 0 ? '+' : ''}${escapeHtml(Number(value) || 0)}</span>`;
}

function imageStatusLabel(hasImages) {
  return hasImages ? 'Includes images' : 'No images';
}

function flattenedReviews() {
  const allReviews = getSavedReviews();
  if (Array.isArray(allReviews)) return allReviews;
  return Object.entries(allReviews)
    .flatMap(([courtId, reviews]) => (reviews || []).map(review => ({
      ...review,
      courtId: review.courtId || courtId
    })));
}

function setCurrentUser(user) {
  renderCurrentUser(user);
  window.dispatchEvent(new CustomEvent('open-play-session-changed'));
}

async function loadBackendContributions(user) {
  if (!user?.id) {
    backendContributions = null;
    return;
  }

  try {
    backendContributions = await window.OpenPlaySupabase?.fetchCurrentUserContributions?.(user) || emptyBackendContributions('Supabase returned no contribution data');
  } catch (error) {
    console.warn('Supabase contribution load failed.', error);
    backendContributions = emptyBackendContributions(error.message || 'Supabase contribution load failed');
  }
}

function avatarMarkup(user) {
  if (user.photo) {
    return `<img src="${user.photo}" alt="" />`;
  }
  return `<span>${escapeHtml(user.username.slice(0, 2).toUpperCase())}</span>`;
}

function setPasswordVisibility(button) {
  const input = document.querySelector(`#${button.dataset.passwordTarget}`);
  if (!input) return;

  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  button.textContent = isHidden ? 'Hide' : 'Show';
}

function renderCurrentUser(user) {
  if (!user) {
    document.body.classList.remove('has-current-user');
    elements.currentUserCard.hidden = true;
    return;
  }

  document.body.classList.add('has-current-user');
  elements.currentUserCard.hidden = false;
  const addedPlaces = getAddedPlaces(user);
  const reviewedPlaces = getReviewedPlaces(user);
  const suggestedEdits = getSuggestedEdits(user);
  const isAdmin = user.role === 'admin';
  const profileSkillLevel = skillLevelLabel(user.skillLevel);
  const creditBalances = getCreditBalances(user.id);
  elements.currentUserCard.innerHTML = `
    <div class="profile-overview">
      <div class="profile-avatar user-avatar" aria-hidden="true">${avatarMarkup(user)}</div>
      <div>
        <strong>${escapeHtml(user.username)}</strong>
        <p>${escapeHtml(user.email)}</p>
        ${profileSkillLevel ? `<p>${escapeHtml(profileSkillLevel)}</p>` : ''}
        ${user.bio ? `<p>${escapeHtml(user.bio)}</p>` : ''}
      </div>
    </div>
    <div class="credit-summary">
      <div>
        <span>Active Drawing Credits</span>
        <strong>${escapeHtml(creditBalances.active)}</strong>
      </div>
      <div>
        <span>Lifetime Credits</span>
        <strong>${escapeHtml(creditBalances.lifetime)}</strong>
      </div>
    </div>
    <p class="credit-disclaimer">Credits have no cash value, are not transferable, and do not guarantee a prize. See the <a href="official-rules.html">Official Rules</a> for drawing eligibility, timing, prize details, and redraw terms.</p>
    <div class="profile-contributions">
      <section>
        <h3>Places you added</h3>
        ${renderPlaceList(addedPlaces, user, 'No added places yet.')}
      </section>
      <section>
        <h3>Places you reviewed</h3>
        ${renderReviewList(reviewedPlaces, user)}
      </section>
      <section>
        <h3>Suggested edits</h3>
        ${renderSuggestedEditList(suggestedEdits)}
      </section>
    </div>
    <div class="current-user-actions">
      ${isAdmin ? '<a class="primary-button" href="admin.html">Admin</a>' : ''}
      <a class="secondary-button" href="account-settings.html">Account settings</a>
      <button class="secondary-button" type="button" data-logout>Log out</button>
    </div>
  `;

  elements.currentUserCard.querySelector('[data-logout]').addEventListener('click', async () => {
    try {
      await window.OpenPlayAuth.signOut();
      renderCurrentUser(null);
      window.dispatchEvent(new CustomEvent('open-play-session-changed'));
    } catch (error) {
      elements.notice.textContent = error.message;
    }
  });
}

function getAddedPlaces(user) {
  const places = getSavedSubmissions();
  if (backendContributions?.locations) return places;
  return places.filter(court => court.submittedBy === user.id);
}

function getReviewedPlaces(user) {
  const courtsById = new Map(allCourts.map(court => [court.id, court]));
  const seenCourtIds = new Set();

  return flattenedReviews()
    .filter(review => backendContributions?.reviews || review.userId === user.id)
    .map(review => ({
      ...review,
      courtName: review.courtName || courtsById.get(review.courtId)?.name || review.courtId
    }))
    .filter(review => {
      if (seenCourtIds.has(review.courtId)) return false;
      seenCourtIds.add(review.courtId);
      return true;
    });
}

function getSuggestedEdits(user) {
  const edits = backendContributions?.suggestedEdits || [];
  if (backendContributions?.suggestedEdits) return edits;
  return edits.filter(edit => edit.userId === user.id);
}

function locationContributionPhotos(place, user) {
  return normalizedPhotos(place.photos)
    .filter(photo => !photo.reviewId && (!photo.uploadedBy || photo.uploadedBy === user.id));
}

function reviewContributionPhotos(review, user) {
  const reviewIds = new Set(idCandidates(review));
  const court = allCourts.find(item => (
    item.id === review.courtId
    || item.remoteId === review.remoteLocationId
    || item.remoteId === review.courtId
  ));

  return normalizedPhotos(court?.photos || [])
    .filter(photo => (
      photo.reviewId
      && reviewIds.has(photo.reviewId)
      && (!photo.uploadedBy || photo.uploadedBy === user.id)
    ));
}

function suggestedEditContributionPhotos(edit) {
  return normalizedPhotos(
    edit.photos
    || edit.imageUrls
    || edit.images
    || edit.suggestedLocation?.photos
    || edit.suggestedLocation?.imageUrls
    || edit.suggestedLocation?.images
    || []
  );
}

function renderPlaceList(places, user, emptyMessage) {
  if (!places.length) return `<p class="empty-profile-list">${emptyMessage}</p>`;

  return `
    <ul class="profile-list">
      ${places.map(place => {
        const location = [place.city, place.state].filter(Boolean).join(', ');
        const status = contributionStatusLabel(place.status);
        const date = compactDate(place.createdAt || place.updatedAt);
        const photos = locationContributionPhotos(place, user);
        const credits = targetCreditValue('add-location', 'location', place, place.status === 'approved' ? CONTRIBUTION_CREDITS['add-location'] : 0)
          + imageCreditValue('location', place, photos);
        return `
          <li class="profile-contribution-item">
            <div class="profile-contribution-main">
              <strong>${escapeHtml(place.name)}</strong>
              <span>${escapeHtml([location, status, date, imageStatusLabel(photos.length > 0)].filter(Boolean).join(' · '))}</span>
            </div>
            ${contributionCreditPill(credits)}
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function reviewSummary(review) {
  return review.body
    || [
      review.openPlayReliability,
      review.crowdLevel,
      review.bestTime,
      review.netSetup,
      review.playFormat,
      review.amenities
    ].filter(Boolean).join(' · ')
    || 'Review details submitted.';
}

function renderReviewList(reviews, user) {
  if (!reviews.length) return '<p class="empty-profile-list">No reviews yet.</p>';

  return `
    <ul class="profile-list">
      ${reviews.map(review => {
        const status = contributionStatusLabel(review.status);
        const date = compactDate(review.visited || review.createdAt);
        const photos = reviewContributionPhotos(review, user);
        const credits = targetCreditValue('add-review', 'review', review, review.status === 'published' ? CONTRIBUTION_CREDITS['add-review'] : 0)
          + imageCreditValue('review', review, photos);
        return `
          <li class="profile-contribution-item">
            <div class="profile-contribution-main">
              <strong>${escapeHtml(review.courtName)}</strong>
              <span>${escapeHtml([date, status, imageStatusLabel(photos.length > 0), reviewSummary(review)].filter(Boolean).join(' · '))}</span>
            </div>
            ${contributionCreditPill(credits)}
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function renderSuggestedEditList(edits) {
  if (!edits.length) return '<p class="empty-profile-list">No suggested edits yet.</p>';

  return `
    <ul class="profile-list">
      ${edits.map(edit => {
        const status = contributionStatusLabel(edit.status);
        const date = compactDate(edit.approvedAt || edit.createdAt);
        const photos = suggestedEditContributionPhotos(edit);
        const imageCredits = imageCreditValue('suggested-edit', edit, photos);
        const credits = targetCreditValue('suggested-edit', 'suggested-edit', edit, edit.status === 'approved' ? CONTRIBUTION_CREDITS['suggested-edit'] : 0)
          + imageCredits;
        return `
          <li class="profile-contribution-item">
            <div class="profile-contribution-main">
              <strong>${escapeHtml(edit.locationName || edit.suggestedLocation?.name || 'Suggested edit')}</strong>
              <span>${escapeHtml([date, status, imageStatusLabel(photos.length > 0), edit.reason].filter(Boolean).join(' · '))}</span>
            </div>
            ${contributionCreditPill(credits)}
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function showAuthPanel(panelName) {
  elements.authTabs.forEach(tab => {
    tab.classList.toggle('is-active', tab.dataset.authTab === panelName);
  });

  elements.authPanels.forEach(panel => {
    panel.hidden = panel.dataset.authPanel !== panelName;
  });
}

async function createAccount(event) {
  event.preventDefault();

  const submitButton = elements.signupForm.querySelector('button[type="submit"]');
  const email = elements.signupEmail.value.trim().toLowerCase();
  const password = elements.signupPassword.value;
  const passwordConfirm = elements.signupPasswordConfirm.value;
  const username = elements.signupUsername.value.trim();
  const skillLevel = normalizeSkillLevel(elements.signupSkillLevel.value, '');
  const bio = elements.signupBio.value.trim();

  if (!email || !password || !username) {
    elements.signupHint.textContent = 'Email, password, and username are required.';
    return;
  }

  if (password.length < 8) {
    elements.signupHint.textContent = 'Password must be at least 8 characters.';
    return;
  }

  if (password !== passwordConfirm) {
    elements.signupHint.textContent = 'Passwords must match.';
    return;
  }

  if (bio.length > 140) {
    elements.signupHint.textContent = 'Bio must be 140 characters or less.';
    return;
  }

  if (!elements.signupTerms?.checked) {
    elements.signupHint.textContent = 'Please agree to the Terms and Privacy Policy to create an account.';
    return;
  }

  elements.signupHint.textContent = 'Creating account...';
  if (submitButton) submitButton.disabled = true;

  try {
    const result = await window.OpenPlayAuth.signUp({ email, password, username, skillLevel, bio });
    if (result.needsEmailConfirmation) {
      elements.signupHint.textContent = 'Check your email to confirm your account, then log in. Your form was left filled in case you need to try again.';
      return;
    }
    elements.signupForm.reset();
    elements.notice.textContent = 'Account created.';
    setCurrentUser(result.user);
    elements.currentUserCard.scrollIntoView({ block: 'start', behavior: 'smooth' });
  } catch (error) {
    elements.signupHint.textContent = error.message;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function login(event) {
  event.preventDefault();

  try {
    const user = await window.OpenPlayAuth.signIn({
      email: elements.loginEmail.value.trim(),
      password: elements.loginPassword.value
    });
    elements.loginForm.reset();
    elements.loginHint.textContent = 'Logged in.';
    backendContributions = null;
    await refreshAccount();
    window.dispatchEvent(new CustomEvent('open-play-session-changed'));
  } catch (error) {
    elements.loginHint.textContent = 'Email or password did not match.';
  }
}

async function refreshAccount() {
  if (refreshAccountPromise) return refreshAccountPromise;
  refreshAccountPromise = (async () => {
    const currentUser = await window.OpenPlayAuth?.currentUser?.() || null;
    await loadBackendContributions(currentUser);

    try {
      let seedCourts = await window.OpenPlaySupabase?.fetchApprovedLocations?.();
      if (!seedCourts) {
        const response = await fetch('data/courts.json');
        seedCourts = response.ok ? await response.json() : [];
      }
      allCourts = [...seedCourts, ...getSavedSubmissions()];
    } catch {
      allCourts = getSavedSubmissions();
    }

    renderCurrentUser(currentUser);
  })();

  try {
    await refreshAccountPromise;
  } finally {
    refreshAccountPromise = null;
  }
}

async function init() {
  const notice = params.get('notice');
  elements.notice.textContent = notice || '';
  await refreshAccount();
}

elements.authTabs.forEach(tab => {
  tab.addEventListener('click', () => showAuthPanel(tab.dataset.authTab));
});

elements.passwordToggles.forEach(button => {
  button.addEventListener('click', () => setPasswordVisibility(button));
});

elements.signupForm.addEventListener('submit', createAccount);
elements.loginForm.addEventListener('submit', login);
window.addEventListener('open-play-session-changed', async () => {
  try {
    await refreshAccount();
  } catch (error) {
    console.error(error);
    renderCurrentUser(null);
  }
});
window.addEventListener('pageshow', () => {
  refreshAccount().catch(error => console.error(error));
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    refreshAccount().catch(error => console.error(error));
  }
});
init().catch(error => {
  console.error(error);
  elements.notice.textContent = 'Could not load account details.';
});
