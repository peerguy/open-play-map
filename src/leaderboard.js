const USERS_KEY = 'open-play-map-users';
const SESSION_KEY = 'open-play-map-session';
const CREDITS_KEY = 'open-play-map-credits';
const WINNERS_KEY = 'open-play-map-monthly-winners';

const elements = {
  userPanel: document.querySelector('#leaderboardUserPanel'),
  list: document.querySelector('#leaderboardList'),
  winnersList: document.querySelector('#monthlyWinnersList'),
  tabs: document.querySelectorAll('[data-leaderboard-tab]'),
  leadersPanel: document.querySelector('#leadersPanel'),
  winnersPanel: document.querySelector('#winnersPanel')
};

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
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function getCurrentUser() {
  const userId = localStorage.getItem(SESSION_KEY);
  if (!userId) return null;
  return getSavedUsers().find(user => user.id === userId) || null;
}

function getSavedCredits() {
  try {
    return JSON.parse(localStorage.getItem(CREDITS_KEY) || '[]');
  } catch {
    return [];
  }
}

function getMonthlyWinners() {
  try {
    return JSON.parse(localStorage.getItem(WINNERS_KEY) || '[]');
  } catch {
    return [];
  }
}

function avatarInitials(user) {
  return (user.username || user.email || '?').slice(0, 2).toUpperCase();
}

function userAvatar(user) {
  if (user?.photo) {
    return `<img src="${escapeHtml(user.photo)}" alt="" />`;
  }
  return `<span>${escapeHtml(avatarInitials(user))}</span>`;
}

function renderHeaderUser() {
  if (!elements.userPanel) return;

  const user = getCurrentUser();
  if (!user) {
    elements.userPanel.innerHTML = '<a class="header-link" href="account.html">Sign in</a>';
    return;
  }

  elements.userPanel.innerHTML = `
    <div class="active-user">
      <a class="header-profile-link" href="account.html">
        <div class="user-avatar" aria-hidden="true">${userAvatar(user)}</div>
        <strong>${escapeHtml(user.username || user.email || 'Player')}</strong>
      </a>
      <button class="logout-text-button" type="button" data-logout>Logout</button>
    </div>
  `;

  elements.userPanel.querySelector('[data-logout]')?.addEventListener('click', () => {
    localStorage.removeItem(SESSION_KEY);
    renderHeaderUser();
    window.dispatchEvent(new CustomEvent('open-play-session-changed'));
  });
}

function leaderboardRows() {
  const users = getSavedUsers();
  const usersById = new Map(users.map(user => [user.id, user]));
  const rowsById = new Map(users.map(user => [user.id, {
    user,
    active: 0,
    lifetime: 0
  }]));

  getSavedCredits()
    .filter(credit => credit.status === 'approved' || !credit.status)
    .forEach(credit => {
      const userId = credit.userId || credit.username || 'unknown';
      if (!rowsById.has(userId)) {
        rowsById.set(userId, {
          user: usersById.get(userId) || {
            id: userId,
            username: credit.username || 'Unknown player',
            email: ''
          },
          active: 0,
          lifetime: 0
        });
      }

      const row = rowsById.get(userId);
      row.active += Number(credit.activeCreditsDelta || 0);
      row.lifetime += Number(credit.lifetimeCreditsDelta || 0);
      if (!row.user.username && credit.username) row.user.username = credit.username;
    });

  return [...rowsById.values()]
    .sort((a, b) => b.lifetime - a.lifetime || b.active - a.active || (a.user.username || '').localeCompare(b.user.username || ''));
}

function renderLeaderboard() {
  const rows = leaderboardRows();

  if (!rows.length) {
    elements.list.innerHTML = '<p class="leaderboard-empty">No contributors yet.</p>';
    return;
  }

  elements.list.innerHTML = rows.map((row, index) => `
    <article class="leaderboard-row" role="row">
      <span class="leaderboard-rank" role="cell">#${index + 1}</span>
      <span class="leaderboard-player" role="cell">
        <span class="leaderboard-avatar" aria-hidden="true">${escapeHtml(avatarInitials(row.user))}</span>
        <span>
          <strong>${escapeHtml(row.user.username || 'Unknown player')}</strong>
          ${row.user.email ? `<small>${escapeHtml(row.user.email)}</small>` : ''}
        </span>
      </span>
      <strong class="leaderboard-score" role="cell">${escapeHtml(row.lifetime)}</strong>
      <span class="leaderboard-active" role="cell">${escapeHtml(row.active)}</span>
    </article>
  `).join('');
}

function renderMonthlyWinners() {
  const winners = getMonthlyWinners()
    .sort((a, b) => String(b.month || b.drawnAt || '').localeCompare(String(a.month || a.drawnAt || '')));

  if (!winners.length) {
    elements.winnersList.innerHTML = `
      <section class="leaderboard-empty monthly-winners-empty">
        <strong>No monthly winners recorded yet.</strong>
        <span>Once a monthly paddle drawing is completed, winners will show up here with the drawing month, player, prize, and winning entry details.</span>
      </section>
    `;
    return;
  }

  elements.winnersList.innerHTML = winners.map(winner => `
    <article class="monthly-winner-card">
      <span class="leaderboard-avatar" aria-hidden="true">${escapeHtml((winner.username || winner.email || 'W').slice(0, 2).toUpperCase())}</span>
      <div>
        <strong>${escapeHtml(winner.username || 'Monthly winner')}</strong>
        <span>${escapeHtml(winner.month || winner.drawnAt || 'Drawing month')}</span>
      </div>
      <div class="monthly-winner-prize">
        <strong>${escapeHtml(winner.prize || 'Free Scoop paddle')}</strong>
        <span>${escapeHtml(winner.activeCreditsAtDraw ?? winner.winningCredits ?? '')}${winner.activeCreditsAtDraw || winner.winningCredits ? ' active credits at drawing' : 'Monthly drawing winner'}</span>
      </div>
    </article>
  `).join('');
}

function showLeaderboardTab(tabName) {
  const showWinners = tabName === 'winners';
  elements.tabs.forEach(tab => {
    const isActive = tab.dataset.leaderboardTab === tabName;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  elements.leadersPanel.hidden = showWinners;
  elements.winnersPanel.hidden = !showWinners;
}

elements.tabs.forEach(tab => {
  tab.addEventListener('click', () => showLeaderboardTab(tab.dataset.leaderboardTab));
});

window.addEventListener('open-play-session-changed', renderHeaderUser);

renderHeaderUser();
renderLeaderboard();
renderMonthlyWinners();
