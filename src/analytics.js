(function () {
  const STORAGE_KEY = 'open-play-map-analytics-events';
  const MAX_LOCAL_EVENTS = 100;

  function cleanEventName(name) {
    return String(name || 'event')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'event';
  }

  function cleanProperties(properties = {}) {
    return Object.fromEntries(
      Object.entries(properties)
        .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null)
        .slice(0, 16)
        .map(([key, value]) => [
          String(key).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 40),
          typeof value === 'string' ? value.slice(0, 160) : value
        ])
    );
  }

  function readLocalEvents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (error) {
      return [];
    }
  }

  function writeLocalEvent(record) {
    try {
      const events = readLocalEvents();
      events.push(record);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_LOCAL_EVENTS)));
    } catch (error) {
      // Analytics should never break the app.
    }
  }

  function sendToConfiguredEndpoint(record) {
    const endpoint = window.OPEN_PLAY_ANALYTICS_ENDPOINT;
    if (!endpoint || !navigator.sendBeacon) return;

    try {
      const payload = new Blob([JSON.stringify(record)], { type: 'application/json' });
      navigator.sendBeacon(endpoint, payload);
    } catch (error) {
      // Ignore transport failures.
    }
  }

  function forwardToAnalyticsProviders(name, properties) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, properties);
    }
    if (typeof window.plausible === 'function') {
      window.plausible(name, { props: properties });
    }
    if (window.fathom && typeof window.fathom.trackEvent === 'function') {
      window.fathom.trackEvent(name);
    }
  }

  function track(name, properties = {}) {
    const eventName = cleanEventName(name);
    const cleanProps = cleanProperties(properties);
    const record = {
      event: eventName,
      properties: cleanProps,
      path: window.location.pathname || '/',
      timestamp: new Date().toISOString()
    };

    writeLocalEvent(record);
    sendToConfiguredEndpoint(record);
    forwardToAnalyticsProviders(eventName, cleanProps);
    window.dispatchEvent(new CustomEvent('open-play-analytics', { detail: record }));

    return record;
  }

  window.OpenPlayAnalytics = {
    track,
    getLocalEvents: readLocalEvents,
    clearLocalEvents() {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  document.addEventListener('click', event => {
    const storeLink = event.target.closest?.('a[href*="scooppickleball.com"]');
    if (!storeLink) return;

    track('store_click', {
      href: storeLink.href,
      label: storeLink.textContent.trim(),
      source: document.body.className || 'unknown'
    });
  });

  track('page_view', {
    title: document.title,
    referrer: document.referrer ? new URL(document.referrer).hostname : ''
  });
})();
