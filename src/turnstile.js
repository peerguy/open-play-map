(function () {
  const WIDGET_SELECTOR = '[data-turnstile-widget]';
  const LOAD_TIMEOUT_MS = 8000;
  const config = window.OpenPlaySupabaseConfig || {};
  const siteKey = String(config.turnstileSiteKey || '').trim();
  const widgetStates = new WeakMap();

  function isConfigured() {
    return Boolean(siteKey);
  }

  function setHint(hint, message) {
    if (hint) hint.textContent = message;
  }

  function waitForTurnstile() {
    if (!isConfigured()) return Promise.resolve(null);
    if (window.turnstile?.render) return Promise.resolve(window.turnstile);

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (window.turnstile?.render) {
          window.clearInterval(timer);
          resolve(window.turnstile);
          return;
        }

        if (Date.now() - startedAt > LOAD_TIMEOUT_MS) {
          window.clearInterval(timer);
          reject(new Error('Turnstile did not load.'));
        }
      }, 50);
    });
  }

  async function render(container) {
    if (!isConfigured() || !container) return null;
    if (container.closest('[hidden]')) return null;

    const existing = widgetStates.get(container);
    if (existing && !existing.failed) return existing.pending || existing;
    if (existing?.failed) widgetStates.delete(container);

    const state = {
      widgetId: null,
      token: '',
      failed: false,
      pending: null
    };
    widgetStates.set(container, state);

    state.pending = waitForTurnstile()
      .then(api => {
        if (!api || state.widgetId !== null || !document.documentElement.contains(container)) {
          return state;
        }

        state.widgetId = api.render(container, {
          sitekey: siteKey,
          theme: 'light',
          callback(token) {
            state.token = token || '';
            state.failed = false;
            container.classList.remove('has-turnstile-error');
          },
          'expired-callback'() {
            state.token = '';
          },
          'error-callback'() {
            state.token = '';
            state.failed = true;
            container.classList.add('has-turnstile-error');
          }
        });

        return state;
      })
      .catch(error => {
        state.failed = true;
        state.token = '';
        container.classList.add('has-turnstile-error');
        console.error(error);
        return state;
      });

    return state.pending;
  }

  async function ensureToken(container, hint) {
    if (!isConfigured()) return '';

    if (!container) {
      setHint(hint, 'Security check could not load. Refresh and try again.');
      return '';
    }

    const state = await render(container);
    if (state?.token) return state.token;

    const message = container.classList.contains('has-turnstile-error')
      ? 'Security check could not load. Refresh and try again.'
      : 'Complete the security check to continue.';
    setHint(hint, message);
    return '';
  }

  function reset(container) {
    if (!isConfigured() || !container) return;

    const state = widgetStates.get(container);
    if (!state) return;

    state.token = '';
    if (state.widgetId !== null && window.turnstile?.reset) {
      window.turnstile.reset(state.widgetId);
    }
  }

  window.OpenPlayTurnstile = {
    isConfigured,
    render,
    ensureToken,
    reset
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll(WIDGET_SELECTOR).forEach(container => {
      render(container);
    });
  });
})();
