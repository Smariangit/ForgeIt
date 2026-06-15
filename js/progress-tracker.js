// progress-tracker.js — SSBForge
// Hooks into the Practice engine and records completed attempts to Supabase.
//
// Supabase profiles table columns expected:
//   id (uuid, FK to auth.users)
//   tat_attempts        integer default 0
//   wat_attempts        integer default 0
//   ppdt_attempts       integer default 0
//   srt_attempts        integer default 0
//   lecturette_attempts integer default 0
//   gpe_attempts        integer default 0
//   oir_attempts        integer default 0
//   login_streak        integer default 0
//   practice_streak     integer default 0
//   last_practice_date  date
//   last_login_date     date
//   updated_at          timestamptz
//
// RLS policy needed:
//   CREATE POLICY "users can update own profile"
//   ON profiles FOR UPDATE USING (auth.uid() = id);
//   CREATE POLICY "users can read own profile"
//   ON profiles FOR SELECT USING (auth.uid() = id);

const ProgressTracker = (function () {

  // ── CONFIG ──────────────────────────────────────────────────────────────
  // Keep these aligned with js/auth.js. This site uses a custom ssbSession
  // cache instead of the Supabase JS client's sb-... localStorage key.
  const SUPABASE_URL = window.SUPABASE_URL || 'https://cogcatpdaengjybswcnq.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvZ2NhdHBkYWVuZ2p5YnN3Y25xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjczOTYsImV4cCI6MjA5NDk0MzM5Nn0.RCD-qCYHtGAFPEqEAoqn76RzzEzs444DhETw2v8Tu_k';

  // Map practice module names → profiles column names
  const MODULE_COL = {
    tat:        'tat_attempts',
    wat:        'wat_attempts',
    ppdt:       'ppdt_attempts',
    srt:        'srt_attempts',
    lecturette: 'lecturette_attempts',
    gpe:        'gpe_attempts',
    oir:        'oir_attempts',
  };

  // ── State ──────────────────────────────────────────────────────────────
  let sessionModule = null;   // which module is currently being practised
  let sessionCount  = 0;      // slides completed this session
  let recorded      = false;  // prevent double-recording per session

  // ── Init: called once by practice.js when a module session starts ──────
  function startSession(module) {
    sessionModule = module;
    sessionCount  = 0;
    recorded      = false;
  }

  // ── Called by practice.js every time a slide advances ─────────────────
  function onSlideComplete() {
    if (!sessionModule) return;
    sessionCount++;
  }

  // ── Called by practice.js when the session reaches the final slide ─────
  // slidesCompleted: total slides the user actually went through
  async function onSessionComplete(slidesCompleted) {
    if (recorded || !sessionModule) return;
    recorded = true;

    const count = slidesCompleted ?? sessionCount;
    if (count < 1) return;   // don't record empty sessions

    // Try the app's primary Auth helper first; fall back to localStorage.
    // One completed timed session counts as one attempt.
    const ok = await _recordToSupabase(sessionModule);
    if (!ok) _recordToLocalStorage(sessionModule, 1);

    // Fire a custom event so progress.html can refresh if open
    window.dispatchEvent(new CustomEvent('ssbforge:progress-updated', {
      detail: { module: sessionModule, count: 1 }
    }));
  }

  // ── Supabase upsert ────────────────────────────────────────────────────
  async function _recordToSupabase(module) {
    const col = MODULE_COL[module];
    if (!col) return false;

    if (typeof Auth !== 'undefined' && Auth.recordPracticeProgress) {
      const result = await Auth.recordPracticeProgress(module);
      return !!result?.success;
    }

    try {
      const session = _getSession();
      const token = session?.accessToken;
      if (!session?.id || !token) return false;

      // 1. Fetch current value
      const getResp = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id,${col},tests_attempted,streak,last_activity&id=eq.${encodeURIComponent(session.id)}&limit=1`,
        { headers: _headers(token) }
      );
      if (!getResp.ok) return false;
      const rows = await getResp.json();
      if (!rows.length) return false;

      const userId  = rows[0].id;
      const current = rows[0][col] || 0;
      const currentTests = rows[0].tests_attempted || 0;
      const nextStreak = _nextStreak(rows[0].streak, rows[0].last_activity);

      // 2. Increment
      const now = new Date().toISOString();
      const patchResp = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
        {
          method:  'PATCH',
          headers: { ..._headers(token), 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            [col]:             current + 1,
            tests_attempted:   currentTests + 1,
            streak:            nextStreak,
            last_activity:     now,
          }),
        }
      );
      return patchResp.ok;
    } catch (e) {
      console.warn('[ProgressTracker] Supabase error:', e);
      return false;
    }
  }

  // ── localStorage fallback (when not logged in with Supabase) ──────────
  function _recordToLocalStorage(module, count) {
    try {
      const key  = 'ssbforge_progress';
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      const col  = MODULE_COL[module] || (module + '_attempts');
      data[col]  = (data[col] || 0) + count;

      // Streak (local)
      const today     = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (data.last_practice_date === yesterday) {
        data.practice_streak = (data.practice_streak || 0) + 1;
      } else if (data.last_practice_date !== today) {
        data.practice_streak = 1;
      }
      data.last_practice_date = today;
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[ProgressTracker] localStorage error:', e);
    }
  }

  // ── Read progress (used by progress.html) ─────────────────────────────
  // Returns a merged object: Supabase data if logged in, localStorage otherwise
  async function getProgress() {
    const session = _getSession();
    const token = session?.accessToken;
    if (session?.id && token) {
      try {
        const cols = [
          'tat_attempts','wat_attempts','ppdt_attempts',
          'srt_attempts','lecturette_attempts','gpe_attempts',
          'tests_attempted','streak','last_activity',
        ].join(',');
        const resp = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?select=${cols}&id=eq.${encodeURIComponent(session.id)}&limit=1`,
          { headers: _headers(token) }
        );
        if (resp.ok) {
          const rows = await resp.json();
          if (rows.length) return _normalizeProfile(rows[0]);
        }
      } catch (e) {
        console.warn('[ProgressTracker] getProgress Supabase error:', e);
      }
    }
    // Fall back to localStorage
    const local = JSON.parse(localStorage.getItem('ssbforge_progress') || '{}');
    return { source: 'local', ...local };
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  function _headers(token) {
    return {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token,
      'Accept':        'application/json',
    };
  }

  function _getSession() {
    try {
      if (typeof Auth !== 'undefined' && Auth.getUser) return Auth.getUser();
      return JSON.parse(localStorage.getItem('ssbSession') || 'null');
    } catch { /* ignore */ }
    return null;
  }

  function _normalizeProfile(profile) {
    return {
      source: 'supabase',
      ...profile,
      oir_attempts: profile.oir_attempts || 0,
      login_streak: 0,
      practice_streak: profile.streak || 0,
      last_practice_date: profile.last_activity || null,
      updated_at: profile.last_activity || null,
    };
  }

  function _nextStreak(currentStreak, lastActivity) {
    const now = new Date();
    const today = _dateKey(now);
    const yesterday = _dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const last = lastActivity ? _dateKey(new Date(lastActivity)) : null;

    if (last === today) return Math.max(Number(currentStreak || 0), 1);
    if (last === yesterday) return Number(currentStreak || 0) + 1;
    return 1;
  }

  function _dateKey(date) {
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  // ── Public API ─────────────────────────────────────────────────────────
  return { startSession, onSlideComplete, onSessionComplete, getProgress };
})();

window.ProgressTracker = ProgressTracker;
