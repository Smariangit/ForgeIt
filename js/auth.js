// auth.js — SSBForge Auth (Supabase Auth + profiles table)
// Replace these two values with your project details:
//   SUPABASE_URL → Supabase Dashboard → Settings → API → Project URL
//   SUPABASE_KEY → Supabase Dashboard → Settings → API → anon/public key

const SUPABASE_URL = 'https://cogcatpdaengjybswcnq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ2NhdHBkYWVuZ2p5YnN3Y25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjczOTYsImV4cCI6MjA5NDk0MzM5Nn0.RCD-qCYHtGAFPEqEAoqn76RzzEzs444DhETw2v8Tu_k';


function isSupabaseConfigured() {
  return SUPABASE_URL && SUPABASE_KEY
    && !SUPABASE_URL.includes('YOUR_SUPABASE')
    && !SUPABASE_KEY.includes('YOUR_SUPABASE');
}

// ---------------------------------------------------------------------------
// Supabase Auth REST helpers
// ---------------------------------------------------------------------------
const _sb = {
  // POST to Supabase Auth endpoint
  async authPost(path, body) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Add your Project URL and anon key in js/auth.js.');
    }
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
  async getProfile(userId, accessToken) {
    if (!isSupabaseConfigured()) return null;
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId) + '&limit=1',
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + (accessToken || SUPABASE_KEY),
          'Accept': 'application/json'
        }
      }
    );
    const rows = await res.json();
    return rows && rows.length ? rows[0] : null;
  },

  async updateProfile(userId, data, accessToken) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Add your Project URL and anon key in js/auth.js.');
    }
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?id=eq.' + encodeURIComponent(userId),
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
  },

  // Send password reset email
  async resetPassword(email) {
    return this.authPost('recover', {
      email: email,
      redirect_to: window.location.origin + '/reset-password.html'
    });
  },

  async updatePassword(accessToken, password) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured. Add your Project URL and anon key in js/auth.js.');
    }

    const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      method: 'PUT',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Password update failed');
    return data;
  },


  async insertPremiumPayment(data, accessToken) {
    if (!isSupabaseConfigured()) return;
    const res = await fetch(SUPABASE_URL + '/rest/v1/premium_payments', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Payment record could not be saved');
    }
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

function saveProfileToSession(profile) {
  const session = _session.get();
  if (!session || !profile) return session;
  const updated = {
    ...session,
    name: profile.name || session.name || '',
    isPremium: profile.premium || false,
    premiumExpiry: profile.premium_expiry || null,
    role: profile.role || session.role || 'free'
  };
  localStorage.setItem(_session.key, JSON.stringify(updated));
  return updated;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
const Auth = {

  // ── Sync session read (no network) ────────────────────────────────────────
  getUser() {
    return _session.get();
  },

  isConfigured() {
    return isSupabaseConfigured();
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
        email_redirect_to: window.location.origin + window.location.pathname
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

      const profile = await _sb.getProfile(data.user.id, data.access_token).catch(() => null);
      _session.set(data, profile);
      return { user: data.user, session: _session.get() };
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
      const profile = await _sb.getProfile(data.user.id, data.access_token).catch(() => null);
      _session.set(data, profile);
      return { user: data.user, session: _session.get() };
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
      await _sb.insertPremiumPayment({
        user_id: session.id,
        email: session.email,
        razorpay_payment_id: razorpayPaymentId,
        amount: 51,
        currency: 'INR',
        status: 'paid',
        created_at: new Date().toISOString()
      }, session.accessToken).catch(err => {
        console.warn('Premium payment record skipped:', err);
      });

      await _sb.updateProfile(
        session.id,
        { premium: true, premium_expiry: expiry },
        session.accessToken
      );

      const verified = await this.waitForPremiumVerification({ attempts: 8, delayMs: 1200 });
      if (!verified.success) return verified;

      return { success: true, expiry: verified.user.premiumExpiry || expiry };
    } catch (err) {
      console.error('Upgrade error:', err);
      return { error: err.message || 'Could not update premium status.' };
    }
  },

  async refreshUserProfile() {
    let session = _session.get();
    if (!session) return null;

    await this.refreshIfNeeded();
    session = _session.get();
    if (!session) return null;

    const profile = await _sb.getProfile(session.id, session.accessToken).catch(() => null);
    return saveProfileToSession(profile);
  },

  async recordPracticeProgress(moduleName) {
    const session = _session.get();
    if (!session) return { skipped: true, reason: 'Not logged in.' };

    const moduleColumns = {
      wat: 'wat_attempts',
      tat: 'tat_attempts',
      ppdt: 'ppdt_attempts',
      lecturette: 'lecturette_attempts',
      srt: 'srt_attempts',
      gpe: 'gpe_attempts'
    };
    const moduleColumn = moduleColumns[moduleName];
    if (!moduleColumn) return { skipped: true, reason: 'Unknown practice module.' };

    try {
      await this.refreshIfNeeded();
      const freshSession = _session.get();
      if (!freshSession) return { skipped: true, reason: 'Session expired.' };

      const profile = await _sb.getProfile(freshSession.id, freshSession.accessToken).catch(() => null);
      const now = new Date();
      const todayKey = toLocalDateKey(now);
      const lastActivity = profile?.last_activity ? new Date(profile.last_activity) : null;
      const lastKey = lastActivity && !Number.isNaN(lastActivity.getTime()) ? toLocalDateKey(lastActivity) : null;
      const yesterdayKey = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

      let nextStreak = Number(profile?.streak || 0);
      if (lastKey === todayKey) {
        nextStreak = Math.max(nextStreak, 1);
      } else if (lastKey === yesterdayKey) {
        nextStreak += 1;
      } else {
        nextStreak = 1;
      }

      const update = {
        tests_attempted: Number(profile?.tests_attempted || 0) + 1,
        [moduleColumn]: Number(profile?.[moduleColumn] || 0) + 1,
        streak: nextStreak,
        last_activity: now.toISOString()
      };

      await _sb.updateProfile(freshSession.id, update, freshSession.accessToken);
      return { success: true, update };
    } catch (err) {
      console.error('Practice progress update failed:', err);
      return { error: err.message || 'Practice progress update failed.' };
    }
  },

  async waitForPremiumVerification(options = {}) {
    const attempts = options.attempts || 10;
    const delayMs = options.delayMs || 1500;

    for (let i = 0; i < attempts; i++) {
      const user = await this.refreshUserProfile();
      if (user && this.isPremium()) {
        return { success: true, user };
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return {
      pending: true,
      error: 'Payment was received, but premium verification is still pending. Please wait a minute and log in again, or contact support with your payment ID.'
    };
  },

  // ── Refresh session token (call on page load if token is near expiry) ──────
  async refreshIfNeeded() {
    const session = _session.get();
    if (!session) return;
    if (!session.refreshToken) return;
    const fiveMinutes = 5 * 60 * 1000;
    if (session.expiresAt && session.expiresAt - Date.now() > fiveMinutes) return;

    try {
      const data = await _sb.refreshSession(session.refreshToken);
      const profile = await _sb.getProfile(data.user.id, data.access_token).catch(() => null);
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
    if (isSupabaseConfigured() && session?.accessToken) {
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

function toLocalDateKey(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

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
  const errorCode    = params.get('error_code');

  if (accessToken && type === 'recovery') {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage !== 'reset-password.html') {
      window.location.replace('reset-password.html' + hash);
    }
    return;
  }

  if (errorCode && (errorCode === 'otp_expired' || params.get('error'))) {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage !== 'reset-password.html') {
      window.location.replace('reset-password.html' + hash);
    }
    return;
  }

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
    const profile = await _sb.getProfile(user.id, accessToken).catch(() => null);

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


// Forgot password helper
window.resetPasswordFlow = async function(email) {
  if (!email) {
    alert('Enter your email first.');
    return;
  }

  try {
    await _sb.resetPassword(email);
    alert('Password reset email sent. Check your inbox.');
  } catch(err) {
    alert(err.message || 'Could not send reset email.');
  }
};

window.updatePasswordFromRecovery = async function(password) {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.replace('#', ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');

  if (!accessToken || type !== 'recovery') {
    return { error: 'This reset link is invalid or expired. Please request a new password reset email.' };
  }

  try {
    const user = await _sb.updatePassword(accessToken, password);
    const profile = await _sb.getProfile(user.id, accessToken).catch(() => null);
    _session.set({
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600
    }, profile);
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return { success: true };
  } catch(err) {
    return { error: err.message || 'Could not update password.' };
  }
};
