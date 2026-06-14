const USERS_KEY = 'open-play-map-users';
const SESSION_KEY = 'open-play-map-session';
const STORAGE_KEY = 'open-play-map-submissions';
const REVIEWS_KEY = 'open-play-map-reviews';
const CREDITS_KEY = 'open-play-map-credits';

const params = new URLSearchParams(location.search);
const returnTo = params.get('return') || 'index.html';
let allCourts = [];

const SKILL_LEVELS = {
  beginner: 'Beginner: Under 3.0',
  intermediate: 'Intermediate: 3.0-4.0',
  advanced: 'Advanced: 4.0+'
};

const elements = {
  notice: document.querySelector('#accountNotice'),
  currentUserCard: document.querySelector('#currentUserCard'),
  signupForm: document.querySelector('#signupForm'),
  signupEmail: document.querySelector('#signupEmail'),
  signupPassword: document.querySelector('#signupPassword'),
  signupPasswordConfirm: document.querySelector('#signupPasswordConfirm'),
  signupUsername: document.querySelector('#signupUsername'),
  signupPhoto: document.querySelector('#signupPhoto'),
  photoFileName: document.querySelector('#photoFileName'),
  signupSkillLevel: document.querySelector('#signupSkillLevel'),
  signupBio: document.querySelector('#signupBio'),
  signupHint: document.querySelector('#signupHint'),
  loginForm: document.querySelector('#loginForm'),
  loginEmail: document.querySelector('#loginEmail'),
  loginPassword: document.querySelector('#loginPassword'),
  loginHint: document.querySelector('#loginHint'),
  authTabs: document.querySelectorAll('[data-auth-tab]'),
  authPanels: document.querySelectorAll('[data-auth-panel]'),
  passwordToggles: document.querySelectorAll('[data-toggle-password]')
};

function normalize(value) {
  return String(value ?? '').toLowerCase();
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

function getSavedUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    const migratedUsers = migrateUserSkillLevels(users);
    if (JSON.stringify(users) !== JSON.stringify(migratedUsers)) {
      saveUsers(migratedUsers);
      migratedUsers.forEach(syncUserAttribution);
    }
    return migratedUsers;
  } catch {
    return [];
  }
}

function getSavedSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function getSavedReviews() {
  try {
    return JSON.parse(localStorage.getItem(REVIEWS_KEY) || '{}');
  } catch {
    return {};
  }
}

function getSavedCredits() {
  try {
    return JSON.parse(localStorage.getItem(CREDITS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSubmissions(submissions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions));
}

function saveReviews(reviews) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
}

function saveCredits(credits) {
  localStorage.setItem(CREDITS_KEY, JSON.stringify(credits));
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
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

function skillLevelLabel(value) {
  return SKILL_LEVELS[normalizeSkillLevel(value)] || '';
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

  saveCredits(getSavedCredits().map(credit => (
    credit.userId === user.id ? { ...credit, username: user.username } : credit
  )));
}

function findUserByEmail(email) {
  return getSavedUsers().find(user => normalize(user.email) === normalize(email)) || null;
}

function findUserById(id) {
  return getSavedUsers().find(user => user.id === id) || null;
}

async function digestPassword(password) {
  if (!globalThis.crypto?.subtle) return password;
  const data = new TextEncoder().encode(password);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function readProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }

    if (file.size > 1_500_000) {
      reject(new Error('Profile picture must be under 1.5 MB for this local prototype.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}

function setCurrentUser(user) {
  localStorage.setItem(SESSION_KEY, user.id);
  renderCurrentUser(user);
  window.dispatchEvent(new CustomEvent('open-play-session-changed'));
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
  const isAdmin = normalize(user.username) === 'scoop';
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
    <p class="credit-disclaimer">Rewards are in beta. Credits have no cash value, are not transferable, and do not guarantee a prize.</p>
    <div class="profile-contributions">
      <section>
        <h3>Places you added</h3>
        ${renderPlaceList(addedPlaces, 'No added places yet.')}
      </section>
      <section>
        <h3>Places you reviewed</h3>
        ${renderReviewList(reviewedPlaces)}
      </section>
    </div>
    <div class="current-user-actions">
      ${isAdmin ? '<a class="primary-button" href="admin.html">Admin</a>' : ''}
      <button class="secondary-button" type="button" data-edit-profile>Edit profile</button>
      <button class="secondary-button" type="button" data-logout>Log out</button>
    </div>
    <form id="profileEditForm" class="profile-edit-form" hidden>
      <h3>Edit profile</h3>
      <label>Email
        <input id="editEmail" type="email" required value="${escapeHtml(user.email)}" />
      </label>
      <label>Username
        <input id="editUsername" required maxlength="28" value="${escapeHtml(user.username)}" />
      </label>
      <label>New profile picture
        <span class="upload-control">
          <span class="upload-avatar" aria-hidden="true">${escapeHtml(user.username.slice(0, 2).toUpperCase())}</span>
          <span>
            <span class="upload-button-text">Choose photo</span>
            <span class="field-help">Leave blank to keep current photo.</span>
          </span>
          <input id="editPhoto" type="file" accept="image/*" />
        </span>
      </label>
      <label>Skill level
        <select id="editSkillLevel">
          ${skillLevelOptions(user.skillLevel)}
        </select>
      </label>
      <label>Bio
        <textarea id="editBio" maxlength="140" rows="3">${escapeHtml(user.bio || '')}</textarea>
        <span class="field-help">140 characters max.</span>
      </label>
      <p id="editHint" class="form-hint"></p>
      <div class="profile-edit-actions">
        <button class="secondary-button" type="button" data-cancel-edit>Cancel</button>
        <button class="primary-button" type="submit">Save changes</button>
      </div>
    </form>
  `;

  const editForm = elements.currentUserCard.querySelector('#profileEditForm');
  elements.currentUserCard.querySelector('[data-edit-profile]').addEventListener('click', () => {
    editForm.hidden = false;
    elements.currentUserCard.querySelector('#editUsername').focus();
  });
  elements.currentUserCard.querySelector('[data-cancel-edit]').addEventListener('click', () => {
    editForm.hidden = true;
  });
  editForm.addEventListener('submit', event => updateProfile(event, user));
  elements.currentUserCard.querySelector('[data-logout]').addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    renderCurrentUser(null);
    window.dispatchEvent(new CustomEvent('open-play-session-changed'));
  });
}

function getAddedPlaces(user) {
  return getSavedSubmissions().filter(court => court.submittedBy === user.id);
}

function getReviewedPlaces(user) {
  const courtsById = new Map(allCourts.map(court => [court.id, court]));
  const allReviews = getSavedReviews();
  const seenCourtIds = new Set();

  return Object.entries(allReviews)
    .flatMap(([courtId, reviews]) => reviews
      .filter(review => review.userId === user.id)
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

function renderPlaceList(places, emptyMessage) {
  if (!places.length) return `<p class="empty-profile-list">${emptyMessage}</p>`;

  return `
    <ul class="profile-list">
      ${places.map(place => `
        <li>
          <strong>${escapeHtml(place.name)}</strong>
          <span>${escapeHtml([place.city, place.state].filter(Boolean).join(', '))}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

function renderReviewList(reviews) {
  if (!reviews.length) return '<p class="empty-profile-list">No reviews yet.</p>';

  return `
    <ul class="profile-list">
      ${reviews.map(review => `
        <li>
          <strong>${escapeHtml(review.courtName)}</strong>
          <span>${escapeHtml(review.visited || review.createdAt)} · ${escapeHtml(review.body)}</span>
        </li>
      `).join('')}
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

  const users = getSavedUsers();
  if (users.some(user => normalize(user.email) === normalize(email))) {
    elements.signupHint.textContent = 'An account already exists for that email.';
    return;
  }

  if (users.some(user => normalize(user.username) === normalize(username))) {
    elements.signupHint.textContent = 'That username is already taken.';
    return;
  }

  try {
    const photo = await readProfilePhoto(elements.signupPhoto.files?.[0]);
    const user = {
      id: `user-${Date.now()}`,
      email,
      passwordHash: await digestPassword(password),
      username,
      photo,
      skillLevel,
      bio,
      createdAt: todayIso()
    };
    users.push(user);
    saveUsers(users);
    elements.signupForm.reset();
    elements.signupHint.textContent = 'Account created.';
    setCurrentUser(user);
  } catch (error) {
    elements.signupHint.textContent = error.message;
  }
}

async function updateProfile(event, originalUser) {
  event.preventDefault();

  const form = event.currentTarget;
  const hint = form.querySelector('#editHint');
  const email = form.querySelector('#editEmail').value.trim().toLowerCase();
  const username = form.querySelector('#editUsername').value.trim();
  const skillLevel = normalizeSkillLevel(form.querySelector('#editSkillLevel').value, '');
  const bio = form.querySelector('#editBio').value.trim();
  const photoFile = form.querySelector('#editPhoto').files?.[0];

  if (!email || !username) {
    hint.textContent = 'Email and username are required.';
    return;
  }

  if (bio.length > 140) {
    hint.textContent = 'Bio must be 140 characters or less.';
    return;
  }

  const users = getSavedUsers();
  if (users.some(user => user.id !== originalUser.id && normalize(user.email) === normalize(email))) {
    hint.textContent = 'Another account already uses that email.';
    return;
  }

  if (users.some(user => user.id !== originalUser.id && normalize(user.username) === normalize(username))) {
    hint.textContent = 'That username is already taken.';
    return;
  }

  try {
    const photo = photoFile ? await readProfilePhoto(photoFile) : originalUser.photo;
    const updatedUser = {
      ...originalUser,
      email,
      username,
      skillLevel,
      bio,
      photo
    };
    saveUsers(users.map(user => user.id === originalUser.id ? updatedUser : user));
    syncUserAttribution(updatedUser);
    setCurrentUser(updatedUser);
  } catch (error) {
    hint.textContent = error.message;
  }
}

async function login(event) {
  event.preventDefault();

  const user = findUserByEmail(elements.loginEmail.value.trim());
  const passwordHash = await digestPassword(elements.loginPassword.value);
  const matchesHash = user?.passwordHash === passwordHash;
  const matchesLegacyPassword = user?.password === elements.loginPassword.value;

  if (!user || (!matchesHash && !matchesLegacyPassword)) {
    elements.loginHint.textContent = 'Email or password did not match.';
    return;
  }

  elements.loginForm.reset();
  elements.loginHint.textContent = 'Logged in.';
  setCurrentUser(user);
}

async function init() {
  const notice = params.get('notice');
  elements.notice.textContent = notice || '';
  try {
    const response = await fetch('data/courts.json');
    const seedCourts = response.ok ? await response.json() : [];
    allCourts = [...seedCourts, ...getSavedSubmissions()];
  } catch {
    allCourts = getSavedSubmissions();
  }

  const userId = localStorage.getItem(SESSION_KEY);
  renderCurrentUser(userId ? findUserById(userId) : null);
}

elements.authTabs.forEach(tab => {
  tab.addEventListener('click', () => showAuthPanel(tab.dataset.authTab));
});

elements.passwordToggles.forEach(button => {
  button.addEventListener('click', () => setPasswordVisibility(button));
});

elements.signupPhoto.addEventListener('change', () => {
  const file = elements.signupPhoto.files?.[0];
  elements.photoFileName.textContent = file ? file.name : 'PNG or JPG under 1.5 MB.';
});

elements.signupForm.addEventListener('submit', createAccount);
elements.loginForm.addEventListener('submit', login);
window.addEventListener('open-play-session-changed', () => {
  const userId = localStorage.getItem(SESSION_KEY);
  renderCurrentUser(userId ? findUserById(userId) : null);
});
init().catch(error => {
  console.error(error);
  elements.notice.textContent = 'Could not load account details.';
});
