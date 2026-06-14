(function () {
  function client() {
    return window.OpenPlaySupabaseClient?.getClient?.() || null;
  }

  function normalizeProfile(profile, authUser) {
    if (!authUser && !profile) return null;
    return {
      id: profile?.id || authUser?.id || '',
      email: profile?.email || authUser?.email || '',
      username: profile?.username || authUser?.user_metadata?.username || authUser?.email?.split('@')[0] || 'Player',
      photo: profile?.avatar_url || '',
      skillLevel: profile?.skill_level || authUser?.user_metadata?.skill_level || '',
      bio: profile?.bio || authUser?.user_metadata?.bio || '',
      role: profile?.role || 'player',
      createdAt: profile?.created_at?.slice(0, 10) || authUser?.created_at?.slice(0, 10) || '',
      isSupabaseUser: true
    };
  }

  async function fetchProfile(userId) {
    const supabase = client();
    if (!supabase || !userId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,username,role,skill_level,bio,avatar_url,created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function ensureProfile(authUser, values = {}) {
    const supabase = client();
    if (!supabase || !authUser) return null;

    const existing = await fetchProfile(authUser.id);
    if (existing) return normalizeProfile(existing, authUser);

    const fallbackUsername = values.username || authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'Player';
    const payload = {
      id: authUser.id,
      email: authUser.email,
      username: fallbackUsername,
      skill_level: values.skillLevel || authUser.user_metadata?.skill_level || null,
      bio: values.bio || authUser.user_metadata?.bio || null
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert(payload)
      .select('id,email,username,role,skill_level,bio,avatar_url,created_at')
      .single();

    if (error) throw error;
    return normalizeProfile(data, authUser);
  }

  async function currentUser() {
    const supabase = client();
    if (!supabase) return null;

    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const authUser = data.session?.user;
    if (!authUser) return null;

    const profile = await fetchProfile(authUser.id);
    return normalizeProfile(profile, authUser);
  }

  async function signUp({ email, password, username, skillLevel, bio }) {
    const supabase = client();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/account.html`,
        data: {
          username,
          skill_level: skillLevel || null,
          bio: bio || ''
        }
      }
    });

    if (error) throw error;
    if (!data.session?.user) {
      return {
        user: null,
        needsEmailConfirmation: true
      };
    }

    return {
      user: await ensureProfile(data.session.user, { username, skillLevel, bio }),
      needsEmailConfirmation: false
    };
  }

  async function signIn({ email, password }) {
    const supabase = client();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    return normalizeProfile(await fetchProfile(data.user.id), data.user);
  }

  async function updateProfile(user, values) {
    const supabase = client();
    if (!supabase || !user) throw new Error('You must be signed in to update your profile.');

    if (values.email && values.email !== user.email) {
      const { error: emailError } = await supabase.auth.updateUser({ email: values.email });
      if (emailError) throw emailError;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        email: values.email,
        username: values.username,
        skill_level: values.skillLevel || null,
        bio: values.bio || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select('id,email,username,role,skill_level,bio,avatar_url,created_at')
      .single();

    if (error) throw error;
    return normalizeProfile(data, { id: user.id, email: values.email });
  }

  async function listProfiles() {
    const supabase = client();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,username,role,skill_level,bio,avatar_url,created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(profile => normalizeProfile(profile, null));
  }

  async function updateProfileById(userId, values) {
    const supabase = client();
    if (!supabase || !userId) throw new Error('A profile is required.');

    const { data, error } = await supabase
      .from('profiles')
      .update({
        email: values.email,
        username: values.username,
        role: values.role === 'admin' ? 'admin' : 'player',
        skill_level: values.skillLevel || null,
        bio: values.bio || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id,email,username,role,skill_level,bio,avatar_url,created_at')
      .single();

    if (error) throw error;
    return normalizeProfile(data, null);
  }

  async function signOut() {
    const supabase = client();
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  function onAuthStateChange(callback) {
    const supabase = client();
    if (!supabase) return { unsubscribe() {} };

    const { data } = supabase.auth.onAuthStateChange(() => {
      callback();
    });

    return data.subscription;
  }

  window.OpenPlayAuth = {
    currentUser,
    signUp,
    signIn,
    updateProfile,
    listProfiles,
    updateProfileById,
    signOut,
    onAuthStateChange
  };
})();
