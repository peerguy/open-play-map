(() => {
  const header = document.querySelector('.site-header');
  if (!header || header.querySelector('[data-mobile-header-menu]')) return;

  const menu = document.createElement('div');
  menu.className = 'mobile-header-menu';
  menu.dataset.mobileHeaderMenu = '';
  header.append(menu);

  let currentUserCache = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isAdmin(user) {
    return user?.role === 'admin';
  }

  function currentPage() {
    return location.pathname.split('/').pop() || 'index.html';
  }

  function isCurrentPage(href) {
    return currentPage() === href;
  }

  function avatarMarkup(user) {
    if (user?.photo) {
      return `<img src="${escapeHtml(user.photo)}" alt="" />`;
    }
    return `<span>${escapeHtml((user?.username || user?.email || '?').slice(0, 2).toUpperCase())}</span>`;
  }

  function iconMarkup(label) {
    return `<span class="mobile-menu-item-icon" aria-hidden="true">${escapeHtml(label)}</span>`;
  }

  function navLink(label, href, icon) {
    const current = isCurrentPage(href);
    return `
      <a class="mobile-menu-item${current ? ' is-current' : ''}" href="${href}"${current ? ' aria-current="page"' : ''}>
        ${iconMarkup(icon)}
        <span>${escapeHtml(label)}</span>
      </a>
    `;
  }

  function actionButton(label, action, icon) {
    return `
      <button class="mobile-menu-item" type="button" data-mobile-menu-action="${action}">
        ${iconMarkup(icon)}
        <span>${escapeHtml(label)}</span>
      </button>
    `;
  }

  function menuToggleMarkup(user) {
    if (user) {
      return `
        <button class="mobile-menu-toggle has-user-avatar" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobileHeaderMenuPanel">
          <span class="mobile-menu-avatar" aria-hidden="true">${avatarMarkup(user)}</span>
        </button>
      `;
    }

    return `
      <button class="mobile-menu-toggle" type="button" aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobileHeaderMenuPanel">
        <span class="mobile-menu-bars" aria-hidden="true"><span></span><span></span><span></span></span>
      </button>
    `;
  }

  function menuItems(user) {
    const isMapPage = document.body.classList.contains('map-page');
    const items = [];

    if (isMapPage) {
      items.push(actionButton('Add location', 'add-location', '+'));
      items.push(actionButton('Filters', 'filters', 'F'));
    } else {
      items.push(navLink('Map', 'index.html', 'M'));
    }

    items.push(navLink('About', 'about.html', '?'));
    items.push(navLink('Leaderboard', 'leaderboard.html', '#'));
    items.push(navLink('Scoop Store', 'https://scooppickleball.com/', 'S'));
    items.push(navLink(user ? 'Profile' : 'Sign in / Join', 'account.html', user ? 'P' : 'IN'));

    if (isAdmin(user)) {
      items.push(navLink('Admin', 'admin.html', 'A'));
    }

    if (user) {
      items.push(actionButton('Log out', 'logout', 'OUT'));
    }

    return items.join('');
  }

  function setMenuOpen(open) {
    const toggle = menu.querySelector('.mobile-menu-toggle');
    const panel = menu.querySelector('#mobileHeaderMenuPanel');
    if (!toggle || !panel) return;

    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    panel.hidden = !open;
  }

  function runAction(action) {
    setMenuOpen(false);

    if (action === 'add-location') {
      document.querySelector('.site-header [data-open-submit], .mobile-add-action[data-open-submit], [data-open-submit]')?.click();
      return;
    }

    if (action === 'filters') {
      document.querySelector('#filterToggle')?.click();
      return;
    }

    if (action === 'logout') {
      window.OpenPlayAuth?.signOut?.()
        .catch(error => console.error(error))
        .finally(() => {
          currentUserCache = null;
          window.dispatchEvent(new CustomEvent('open-play-session-changed'));
          render();
          if (document.body.classList.contains('admin-page')) {
            location.reload();
          }
        });
    }
  }

  function bindMenuControls() {
    const toggle = menu.querySelector('.mobile-menu-toggle');
    toggle?.addEventListener('click', event => {
      event.stopPropagation();
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      setMenuOpen(!isOpen);
    });

    menu.querySelectorAll('[data-mobile-menu-action]').forEach(button => {
      button.addEventListener('click', event => {
        event.stopPropagation();
        runAction(button.dataset.mobileMenuAction);
      });
    });
  }

  function render() {
    const user = currentUserCache;
    menu.innerHTML = `
      ${menuToggleMarkup(user)}
      <div id="mobileHeaderMenuPanel" class="mobile-menu-panel" hidden>
        ${user ? `
          <div class="mobile-menu-user">
            <span class="mobile-menu-avatar" aria-hidden="true">${avatarMarkup(user)}</span>
            <span>
              <strong>${escapeHtml(user.username || 'Player')}</strong>
              ${user.email ? `<small>${escapeHtml(user.email)}</small>` : ''}
            </span>
          </div>
        ` : ''}
        <div class="mobile-menu-items">
          ${menuItems(user)}
        </div>
      </div>
    `;
    bindMenuControls();
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

  document.addEventListener('click', event => {
    if (!menu.contains(event.target)) setMenuOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setMenuOpen(false);
  });

  window.addEventListener('open-play-session-changed', refreshCurrentUser);
  window.OpenPlayAuth?.onAuthStateChange?.(refreshCurrentUser);

  window.openPlayRenderMobileHeader = refreshCurrentUser;
  render();
  refreshCurrentUser();
})();
