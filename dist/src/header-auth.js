(() => {
  const panels = document.querySelectorAll('[data-auth-user-panel]');
  if (!panels.length) return;

  let currentUserCache = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function avatarInitials(user) {
    return (user?.username || user?.email || '?').slice(0, 2).toUpperCase();
  }

  function userAvatar(user) {
    if (user?.photo) {
      return `<img src="${escapeHtml(user.photo)}" alt="" />`;
    }
    return `<span>${escapeHtml(avatarInitials(user))}</span>`;
  }

  function userMarkup(user) {
    if (!user) return '<a class="header-link" href="account.html">Sign in</a>';

    return `
      ${user.role === 'admin' ? '<a class="header-link" href="admin.html">Admin</a>' : ''}
      <div class="active-user">
        <a class="header-profile-link" href="account.html">
          <div class="user-avatar" aria-hidden="true">${userAvatar(user)}</div>
          <strong>${escapeHtml(user.username || user.email || 'Player')}</strong>
        </a>
        <button class="logout-text-button" type="button" data-logout>Logout</button>
      </div>
    `;
  }

  function renderPanel(panel) {
    const slot = panel.querySelector('[data-auth-user-slot]') || panel;
    slot.innerHTML = userMarkup(currentUserCache);
    slot.querySelector('[data-logout]')?.addEventListener('click', async () => {
      try {
        await window.OpenPlayAuth?.signOut?.();
        currentUserCache = null;
        render();
        window.dispatchEvent(new CustomEvent('open-play-session-changed'));
      } catch (error) {
        console.error(error);
      }
    });
  }

  function render() {
    panels.forEach(renderPanel);
  }

  async function refreshCurrentUser() {
    try {
      currentUserCache = await window.OpenPlayAuth?.currentUser?.() || null;
    } catch (error) {
      console.error(error);
      currentUserCache = null;
    }
    render();
  }

  window.addEventListener('open-play-session-changed', refreshCurrentUser);
  window.OpenPlayAuth?.onAuthStateChange?.(refreshCurrentUser);

  render();
  refreshCurrentUser();
})();
