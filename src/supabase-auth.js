(function () {
  function client() {
    return window.OpenPlaySupabaseClient?.getClient?.() || null;
  }

  function normalizeProfile(profile, authUser) {
    if (!authUser && !profile) return null;
    const profileEmail = profile?.email || '';
    const authEmail = authUser?.email || '';
    const email = profileEmail || authEmail;
    return {
      id: profile?.id || authUser?.id || '',
      email,
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

  function authErrorMessage(error) {
    const message = String(error?.message || '');
    const details = String(error?.details || '');
    const combined = `${message} ${details}`.toLowerCase();
    const lowerMessage = message.toLowerCase();
    if (combined.includes('email') && (combined.includes('already registered') || combined.includes('already exists') || combined.includes('duplicate'))) {
      return 'An account already exists for that email.';
    }
    if (combined.includes('username') || combined.includes('profiles_username') || combined.includes('duplicate key')) {
      return 'That username is already taken.';
    }
    if (lowerMessage.includes('password')) {
      return message;
    }
    return message || 'Could not complete that request.';
  }

  async function checkSignupAvailability({ email, username }) {
    const supabase = client();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase
      .rpc('profile_signup_availability', {
        check_email: email,
        check_username: username
      })
      .single();

    if (error) throw error;
    return {
      emailAvailable: data?.email_available !== false,
      usernameAvailable: data?.username_available !== false
    };
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

  async function signUp({ email, password, username, skillLevel, bio, captchaToken }) {
    const supabase = client();
    if (!supabase) throw new Error('Supabase is not configured.');

    const availability = await checkSignupAvailability({ email, username });
    if (!availability.emailAvailable) {
      throw new Error('An account already exists for that email.');
    }
    if (!availability.usernameAvailable) {
      throw new Error('That username is already taken.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        captchaToken,
        emailRedirectTo: `${window.location.origin}/account.html`,
        data: {
          username,
          skill_level: skillLevel || null,
          bio: bio || ''
        }
      }
    });

    if (error) throw new Error(authErrorMessage(error));
    if (!data.session?.user) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError && signInData.user) {
        return {
          user: await ensureProfile(signInData.user, { username, skillLevel, bio }),
          needsEmailConfirmation: false
        };
      }

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

  async function signIn({ email, password, captchaToken }) {
    const supabase = client();
    if (!supabase) throw new Error('Supabase is not configured.');

    const credentials = { email, password };
    if (captchaToken) {
      credentials.options = { captchaToken };
    }

    const { data, error } = await supabase.auth.signInWithPassword(credentials);
    if (error) throw new Error(authErrorMessage(error));

    return normalizeProfile(await fetchProfile(data.user.id), data.user);
  }

  async function sendPasswordReset(email, { captchaToken } = {}) {
    const supabase = client();
    if (!supabase) throw new Error('Supabase is not configured.');

    const options = {
      redirectTo: `${window.location.origin}/account-settings.html`
    };
    if (captchaToken) {
      options.captchaToken = captchaToken;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, options);
    if (error) throw new Error(authErrorMessage(error));
  }

  async function updatePassword(password) {
    const supabase = client();
    if (!supabase) throw new Error('Supabase is not configured.');

    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(authErrorMessage(error));
    if (!data.user?.id) return currentUser();
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

    if (error) throw new Error(authErrorMessage(error));
    return normalizeProfile(data, { id: user.id, email: values.email });
  }

  async function listProfiles() {
    const supabase = client();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,username,role,skill_level,bio,avatar_url,created_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(authErrorMessage(error));
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

    if (error) throw new Error(authErrorMessage(error));
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

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return data.subscription;
  }

  window.OpenPlayAuth = {
    currentUser,
    checkSignupAvailability,
    signUp,
    signIn,
    sendPasswordReset,
    updatePassword,
    updateProfile,
    listProfiles,
    updateProfileById,
    signOut,
    onAuthStateChange
  };
})();
