const STORAGE_KEY = 'open-play-map-submissions';
const REVIEWS_KEY = 'open-play-map-reviews';
const CREDITS_KEY = 'open-play-map-credits';

const params = new URLSearchParams(location.search);
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

function getCreditBalances(userId) {
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

function skillLevelOptions(selected) {
  const current = normalizeSkillLevel(selected);
  return [
    `<option value=""${current ? '' : ' selected'}>No skill level selected</option>`,
    ...Object.entries(SKILL_LEVELS)
    .map(([value, label]) => `<option value="${value}"${current === value ? ' selected' : ''}>${label}</option>`)
  ]
    .join('');
}

function setCurrentUser(user) {
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

async function updateProfile(event, originalUser) {
  event.preventDefault();

  const form = event.currentTarget;
  const hint = form.querySelector('#editHint');
  const email = form.querySelector('#editEmail').value.trim().toLowerCase();
  const username = form.querySelector('#editUsername').value.trim();
  const skillLevel = normalizeSkillLevel(form.querySelector('#editSkillLevel').value, '');
  const bio = form.querySelector('#editBio').value.trim();

  if (!email || !username) {
    hint.textContent = 'Email and username are required.';
    return;
  }

  if (bio.length > 140) {
    hint.textContent = 'Bio must be 140 characters or less.';
    return;
  }

  try {
    const updatedUser = await window.OpenPlayAuth.updateProfile(originalUser, {
      email,
      username,
      skillLevel,
      bio
    });
    setCurrentUser(updatedUser);
    elements.notice.textContent = 'Profile updated.';
  } catch (error) {
    hint.textContent = error.message;
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
    setCurrentUser(user);
  } catch (error) {
    elements.loginHint.textContent = 'Email or password did not match.';
  }
}

async function init() {
  const notice = params.get('notice');
  elements.notice.textContent = notice || '';
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

  renderCurrentUser(await window.OpenPlayAuth?.currentUser?.() || null);
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
    renderCurrentUser(await window.OpenPlayAuth?.currentUser?.() || null);
  } catch (error) {
    console.error(error);
    renderCurrentUser(null);
  }
});
init().catch(error => {
  console.error(error);
  elements.notice.textContent = 'Could not load account details.';
});
