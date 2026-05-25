// auth.js — SSBForge Auth (Supabase Auth + profiles table)
// Replace these two values with your project details:
//   SUPABASE_URL → Supabase Dashboard → Settings → API → Project URL
//   SUPABASE_KEY → Supabase Dashboard → Settings → API → anon/public key

const SUPABASE_URL = 'https://cogcatpdaengjybswcnq.supabase.co/rest/v1/';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ2NhdHBkYWVuZ2p5YnN3Y25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjczOTYsImV4cCI6MjA5NDk0MzM5Nn0.RCD-qCYHtGAFPEqEAoqn76RzzEzs444DhETw2v8Tu_k';

// ---------------------------------------------------------------------------
// Supabase Auth REST helpers
// ---------------------------------------------------------------------------
const _sb = {
  // POST to Supabase Auth endpoint
  async authPost(path, body) {
    const res = await fetch(SUPABASE_URL + '/auth/v1/' + path, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Auth error');
    return data;
  },

  // GET/PATCH profiles table via REST
  async getProfile(userId) {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId + '&limit=1',
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Accept': 'application/json'
        }
      }
    );
    const rows = await res.json();
    return rows && rows.length ? rows[0] : null;
  },

  async updateProfile(userId, data, accessToken) {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + (accessToken || SUPABASE_KEY),
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(data)
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Profile update failed');
    }
  },

  // Refresh access token using refresh token
  async refreshSession(refreshToken) {
    return this.authPost('token?grant_type=refresh_token', { refresh_token: refreshToken });
  }
};

// ---------------------------------------------------------------------------
// Session cache — stores display data + tokens in localStorage
// ---------------------------------------------------------------------------
const _session = {
  key: 'ssbSession',

  get() {
    try { return JSON.parse(localStorage.getItem(this.key) || 'null'); }
    catch { return null; }
  },

  set(authData, profile) {
    localStorage.setItem(this.key, JSON.stringify({
      id:            authData.user.id,
      email:         authData.user.email,
      name:          profile?.name || authData.user.user_metadata?.name || '',
      isPremium:     profile?.premium || false,
      premiumExpiry: profile?.premium_expiry || null,
      role:          profile?.role || 'free',
      accessToken:   authData.access_token,
      refreshToken:  authData.refresh_token,
      expiresAt:     Date.now() + (authData.expires_in || 3600) * 1000
    }));
  },

  clear() { localStorage.removeItem(this.key); }
};

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
const Auth = {

  // ── Sync session read (no network) ────────────────────────────────────────
  getUser() {
    return _session.get();
  },

  // ── Premium check ─────────────────────────────────────────────────────────
  isPremium() {
    const u = _session.get();
    if (!u) return false;

    // Admin role always has full access
    if (u.role === 'admin') return true;

    if (!u.isPremium) return false;
    if (u.premiumExpiry && new Date(u.premiumExpiry) < new Date()) {
      const updated = { ...u, isPremium: false };
      localStorage.setItem(_session.key, JSON.stringify(updated));
      return false;
    }
    return true;
  },

  // ── Register via Supabase Auth ─────────────────────────────────────────────
  // Supabase automatically creates auth.users entry.
  // A TRIGGER on your DB should auto-create the profiles row (see setup note).
  async register(name, email, password) {
    try {
      const data = await _sb.authPost('signup', {
        email,
        password,
        data: { name }, // stored in auth.users.user_metadata
        options: {
          emailRedirectTo: window.location.origin + '/index.html'
        }
      });

      // Supabase may require email confirmation — check if session was returned
      if (!data.access_token) {
        // Email confirmation required — tell the user
        return { confirm: true, message: 'Check your email to confirm your account, then log in.' };
      }

      // Update profile name (trigger may not have set it)
      if (data.user?.id) {
        await _sb.updateProfile(data.user.id, { name }, data.access_token).catch(() => {});
      }

      const profile = await _sb.getProfile(data.user.id).catch(() => null);
      _session.set(data, profile);
      return { user: data.user };
    } catch (err) {
      console.error('Register error:', err);
      return { error: err.message || 'Registration failed. Please try again.' };
    }
  },

  // ── Login via Supabase Auth ────────────────────────────────────────────────
  async login(email, password) {
    try {
      const data = await _sb.authPost('token?grant_type=password', { email, password });

      // Fetch latest profile (premium status, streak, etc.)
      const profile = await _sb.getProfile(data.user.id).catch(() => null);
      _session.set(data, profile);
      return { user: data.user };
    } catch (err) {
      console.error('Login error:', err);
      const msg = err.message || '';
      // Supabase-specific error messages → user-friendly versions
      if (msg.toLowerCase().includes('email not confirmed')) {
        return { error: 'Please confirm your email first. Check your inbox for a confirmation link from SSBForge.' };
      }
      if (msg.toLowerCase().includes('invalid login credentials')) {
        return { error: 'Incorrect email or password. Please try again.' };
      }
      return { error: msg || 'Login failed. Please try again.' };
    }
  },

  // ── Upgrade to premium ─────────────────────────────────────────────────────
  async upgradeToPremium(razorpayPaymentId) {
    const session = _session.get();
    if (!session) return { error: 'Not logged in.' };

    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      await _sb.updateProfile(
        session.id,
        { premium: true, premium_expiry: expiry },
        session.accessToken
      );

      // Refresh local session
      const updated = { ...session, isPremium: true, premiumExpiry: expiry };
      localStorage.setItem(_session.key, JSON.stringify(updated));

      return { success: true, expiry };
    } catch (err) {
      console.error('Upgrade error:', err);
      return { error: err.message || 'Could not update premium status.' };
    }
  },

  // ── Refresh session token (call on page load if token is near expiry) ──────
  async refreshIfNeeded() {
    const session = _session.get();
    if (!session) return;
    const fiveMinutes = 5 * 60 * 1000;
    if (session.expiresAt && session.expiresAt - Date.now() > fiveMinutes) return;

    try {
      const data = await _sb.refreshSession(session.refreshToken);
      const profile = await _sb.getProfile(data.user.id).catch(() => null);
      _session.set(data, profile);
    } catch {
      // Token expired or invalid — log out silently
      _session.clear();
    }
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  async logout() {
    const session = _session.get();
    // Tell Supabase to invalidate the token
    if (session?.accessToken) {
      fetch(SUPABASE_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + session.accessToken
        }
      }).catch(() => {});
    }
    _session.clear();
    window.location.href = 'index.html';
  },

  // ── Legacy compat ─────────────────────────────────────────────────────────
  setUser(user) {
    const session = _session.get() || {};
    localStorage.setItem(_session.key, JSON.stringify({ ...session, ...user }));
  }
};

// ── Handle email confirmation redirect ────────────────────────────────────
// When user clicks the confirmation link, Supabase redirects back with tokens
// in the URL hash: #access_token=xxx&refresh_token=yyy&type=signup
// We detect this, establish the session, then clean the URL.
(async function handleEmailConfirmation() {
  const hash = window.location.hash;
  if (!hash) return;

  const params = new URLSearchParams(hash.replace('#', ''));
  const accessToken  = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type         = params.get('type'); // 'signup' or 'recovery'

  if (!accessToken || type !== 'signup') return;

  try {
    // Get user from the token
    const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + accessToken
      }
    });
    if (!res.ok) return;
    const user = await res.json();

    // Fetch profile
    const profile = await _sb.getProfile(user.id).catch(() => null);

    // Build a session-compatible object and store it
    _session.set({
      user,
      access_token:  accessToken,
      refresh_token: refreshToken,
      expires_in:    3600
    }, profile);

    // Clean the tokens out of the URL so they aren't visible / bookmarked
    history.replaceState(null, '', window.location.pathname + window.location.search);

    // If there's a confirmation view open, switch to login and show success
    if (typeof switchModalView === 'function') {
      switchModalView('login');
    }
    if (typeof showModalStatus === 'function') {
      showModalStatus('✓ Email confirmed! You are now logged in.', false);
      const modal = document.getElementById('loginModal');
      if (modal) modal.classList.add('active');
    }

    // Reload nav to show logged-in state
    if (typeof buildNav === 'function') buildNav();

  } catch (err) {
    console.error('Email confirmation handling failed:', err);
  }
})();

// Refresh token on every page load (silent, non-blocking)
Auth.refreshIfNeeded();

window.Auth = Auth;
