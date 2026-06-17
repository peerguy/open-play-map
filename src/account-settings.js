const params = new URLSearchParams(location.search);
const hashParams = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '');
let currentUser = null;
let passwordRecoveryMode = params.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
const resetRequestMode = params.get('mode') === 'reset';

const SKILL_LEVELS = {
  beginner: 'Beginner: Under 3.0',
  intermediate: 'Intermediate: 3.0-4.0',
  advanced: 'Advanced: 4.0+'
};

const elements = {
  notice: document.querySelector('#settingsNotice'),
  userCard: document.querySelector('#settingsUserCard'),
  signedOut: document.querySelector('#settingsSignedOut'),
  profileForm: document.querySelector('#profileSettingsForm'),
  email: document.querySelector('#settingsEmail'),
  username: document.querySelector('#settingsUsername'),
  skillLevel: document.querySelector('#settingsSkillLevel'),
  bio: document.querySelector('#settingsBio'),
  profileHint: document.querySelector('#profileSettingsHint'),
  passwordForm: document.querySelector('#passwordSettingsForm'),
  password: document.querySelector('#settingsPassword'),
  passwordConfirm: document.querySelector('#settingsPasswordConfirm'),
  passwordHint: document.querySelector('#passwordSettingsHint'),
  resetForm: document.querySelector('#passwordResetForm'),
  resetEmail: document.querySelector('#resetEmail'),
  resetHint: document.querySelector('#resetHint'),
  newPasswordForm: document.querySelector('#newPasswordForm'),
  newPassword: document.querySelector('#newPassword'),
  newPasswordConfirm: document.querySelector('#newPasswordConfirm'),
  newPasswordHint: document.querySelector('#newPasswordHint'),
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

function normalizeSkillLevel(value, fallback = '') {
  return Object.hasOwn(SKILL_LEVELS, value) ? value : fallback;
}

function skillLevelLabel(value) {
  return SKILL_LEVELS[normalizeSkillLevel(value)] || '';
}

function avatarMarkup(user) {
  if (user?.photo) {
    return `<img src="${escapeHtml(user.photo)}" alt="" />`;
  }
  return `<span>${escapeHtml((user?.username || user?.email || '?').slice(0, 2).toUpperCase())}</span>`;
}

function setPasswordVisibility(button) {
  const input = document.querySelector(`#${button.dataset.passwordTarget}`);
  if (!input) return;

  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  button.textContent = isHidden ? 'Hide' : 'Show';
}

function setMode(mode) {
  elements.signedOut.hidden = mode !== 'signed-out';
  elements.profileForm.hidden = mode !== 'settings';
  elements.passwordForm.hidden = mode !== 'settings';
  elements.resetForm.hidden = mode !== 'reset';
  elements.newPasswordForm.hidden = mode !== 'new-password';
  document.body.classList.toggle('is-password-recovery', mode === 'new-password');
}

function renderUserCard(user) {
  if (!user) {
    elements.userCard.hidden = true;
    elements.userCard.innerHTML = '';
    return;
  }

  const profileSkillLevel = skillLevelLabel(user.skillLevel);
  elements.userCard.hidden = false;
  elements.userCard.innerHTML = `
    <div class="profile-overview">
      <div class="profile-avatar user-avatar" aria-hidden="true">${avatarMarkup(user)}</div>
      <div>
        <strong>${escapeHtml(user.username || 'Player')}</strong>
        <p>${escapeHtml(user.email || '')}</p>
        ${profileSkillLevel ? `<p>${escapeHtml(profileSkillLevel)}</p>` : ''}
      </div>
    </div>
  `;
}

function fillProfileForm(user) {
  elements.email.value = user.email || '';
  elements.username.value = user.username || '';
  elements.skillLevel.value = normalizeSkillLevel(user.skillLevel, '');
  elements.bio.value = user.bio || '';
}

function showRecoveryForm() {
  passwordRecoveryMode = true;
  elements.notice.textContent = 'Enter a new password to finish resetting your account.';
  renderUserCard(currentUser);
  setMode('new-password');
  requestAnimationFrame(() => elements.newPassword?.focus());
}

function showResetRequestForm() {
  elements.notice.textContent = '';
  if (currentUser?.email) {
    elements.resetEmail.value = currentUser.email;
  }
  setMode('reset');
  requestAnimationFrame(() => elements.resetEmail?.focus());
}

function showSettings(user) {
  elements.notice.textContent = '';
  renderUserCard(user);
  fillProfileForm(user);
  setMode('settings');
}

function showSignedOut() {
  renderUserCard(null);
  elements.notice.textContent = '';
  setMode('signed-out');
}

async function refreshSettings() {
  try {
    currentUser = await window.OpenPlayAuth?.currentUser?.() || null;
  } catch (error) {
    console.error(error);
    currentUser = null;
  }

  if (passwordRecoveryMode) {
    showRecoveryForm();
    return;
  }

  if (resetRequestMode) {
    showResetRequestForm();
    return;
  }

  if (!currentUser) {
    showSignedOut();
    return;
  }

  showSettings(currentUser);
}

async function saveProfile(event) {
  event.preventDefault();
  if (!currentUser) return;

  const email = elements.email.value.trim().toLowerCase();
  const username = elements.username.value.trim();
  const skillLevel = normalizeSkillLevel(elements.skillLevel.value, '');
  const bio = elements.bio.value.trim();

  if (!email || !username) {
    elements.profileHint.textContent = 'Email and username are required.';
    return;
  }

  if (bio.length > 140) {
    elements.profileHint.textContent = 'Bio must be 140 characters or less.';
    return;
  }

  const submitButton = elements.profileForm.querySelector('button[type="submit"]');
  elements.profileHint.textContent = 'Saving profile...';
  if (submitButton) submitButton.disabled = true;

  try {
    currentUser = await window.OpenPlayAuth.updateProfile(currentUser, {
      email,
      username,
      skillLevel,
      bio
    });
    elements.profileHint.textContent = 'Profile updated.';
    renderUserCard(currentUser);
    window.dispatchEvent(new CustomEvent('open-play-session-changed'));
  } catch (error) {
    elements.profileHint.textContent = error.message;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function updatePasswordFromForm(form, passwordInput, confirmInput, hint) {
  const password = passwordInput.value;
  const passwordConfirm = confirmInput.value;

  if (password.length < 8) {
    hint.textContent = 'Password must be at least 8 characters.';
    return null;
  }

  if (password !== passwordConfirm) {
    hint.textContent = 'Passwords must match.';
    return null;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  hint.textContent = 'Updating password...';
  if (submitButton) submitButton.disabled = true;

  try {
    const user = await window.OpenPlayAuth.updatePassword(password);
    form.reset();
    hint.textContent = 'Password updated.';
    currentUser = user || await window.OpenPlayAuth.currentUser();
    window.dispatchEvent(new CustomEvent('open-play-session-changed'));
    return currentUser;
  } catch (error) {
    hint.textContent = error.message;
    return null;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function changePassword(event) {
  event.preventDefault();
  await updatePasswordFromForm(elements.passwordForm, elements.password, elements.passwordConfirm, elements.passwordHint);
}

async function requestPasswordReset(event) {
  event.preventDefault();

  const submitButton = elements.resetForm.querySelector('button[type="submit"]');
  const email = elements.resetEmail.value.trim().toLowerCase();
  if (!email) {
    elements.resetHint.textContent = 'Enter the email for your account.';
    return;
  }

  elements.resetHint.textContent = 'Sending reset link...';
  if (submitButton) submitButton.disabled = true;

  try {
    await window.OpenPlayAuth.sendPasswordReset(email);
    elements.resetHint.textContent = 'Check your email for a password reset link.';
  } catch (error) {
    elements.resetHint.textContent = error.message;
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function submitRecoveryPassword(event) {
  event.preventDefault();

  const user = await updatePasswordFromForm(
    elements.newPasswordForm,
    elements.newPassword,
    elements.newPasswordConfirm,
    elements.newPasswordHint
  );
  if (!user) return;

  passwordRecoveryMode = false;
  history.replaceState(null, document.title, location.pathname);
  elements.notice.textContent = 'Password updated. You are signed in.';
  showSettings(user);
}

elements.passwordToggles.forEach(button => {
  button.addEventListener('click', () => setPasswordVisibility(button));
});

elements.profileForm.addEventListener('submit', saveProfile);
elements.passwordForm.addEventListener('submit', changePassword);
elements.resetForm.addEventListener('submit', requestPasswordReset);
elements.newPasswordForm.addEventListener('submit', submitRecoveryPassword);

window.OpenPlayAuth?.onAuthStateChange?.((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    showRecoveryForm();
  }
});

window.addEventListener('pageshow', () => {
  refreshSettings().catch(error => {
    console.error(error);
    elements.notice.textContent = 'Could not load account settings.';
  });
});

init().catch(error => {
  console.error(error);
  elements.notice.textContent = 'Could not load account settings.';
});

async function init() {
  await refreshSettings();
}
