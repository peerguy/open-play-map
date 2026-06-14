(function () {
  const config = window.OpenPlaySupabaseConfig || {};
  let client = null;

  function getClient() {
    if (client) return client;
    if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;

    client = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'open-play-map-supabase-auth'
      }
    });

    return client;
  }

  window.OpenPlaySupabaseClient = {
    getClient
  };
})();
