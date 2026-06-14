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

  // ── CONFIG — set these to your actual Supabase project values ──────────
  // Replace with your real values from Supabase → Settings → API
  const SUPABASE_URL = window.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY';

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

    // Try Supabase first; fall back to localStorage
    const ok = await _recordToSupabase(sessionModule, count);
    if (!ok) _recordToLocalStorage(sessionModule, count);

    // Update practice streak regardless of backend
    await _updatePracticeStreak();

    // Fire a custom event so progress.html can refresh if open
    window.dispatchEvent(new CustomEvent('ssbforge:progress-updated', {
      detail: { module: sessionModule, count }
    }));
  }

  // ── Supabase upsert ────────────────────────────────────────────────────
  async function _recordToSupabase(module, count) {
    const col = MODULE_COL[module];
    if (!col) return false;

    // Get current session token from Supabase auth (via localStorage key it sets)
    const token = _getSupabaseToken();
    if (!token) return false;  // not logged in with Supabase

    try {
      // 1. Fetch current value
      const getResp = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id,${col}&limit=1`,
        { headers: _headers(token) }
      );
      if (!getResp.ok) return false;
      const rows = await getResp.json();
      if (!rows.length) return false;

      const userId  = rows[0].id;
      const current = rows[0][col] || 0;

      // 2. Increment
      const now = new Date().toISOString();
      const patchResp = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
        {
          method:  'PATCH',
          headers: { ..._headers(token), 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            [col]:       current + count,
            updated_at:  now,
            last_practice_date: now.slice(0, 10),
          }),
        }
      );
      return patchResp.ok;
    } catch (e) {
      console.warn('[ProgressTracker] Supabase error:', e);
      return false;
    }
  }

  // ── Practice streak update ─────────────────────────────────────────────
  async function _updatePracticeStreak() {
    const token = _getSupabaseToken();
    if (!token) return;

    try {
      const getResp = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id,practice_streak,last_practice_date&limit=1`,
        { headers: _headers(token) }
      );
      if (!getResp.ok) return;
      const rows = await getResp.json();
      if (!rows.length) return;

      const { id, practice_streak, last_practice_date } = rows[0];
      const today     = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      let newStreak = 1;
      if (last_practice_date === yesterday) {
        newStreak = (practice_streak || 0) + 1;   // extended streak
      } else if (last_practice_date === today) {
        newStreak = practice_streak || 1;           // already practised today
      }
      // if last_practice_date is older → streak resets to 1

      await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`,
        {
          method:  'PATCH',
          headers: { ..._headers(token), 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            practice_streak:     newStreak,
            last_practice_date:  today,
            updated_at:          new Date().toISOString(),
          }),
        }
      );
    } catch (e) {
      console.warn('[ProgressTracker] Streak update error:', e);
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
    const token = _getSupabaseToken();
    if (token) {
      try {
        const cols = [
          'tat_attempts','wat_attempts','ppdt_attempts',
          'srt_attempts','lecturette_attempts','gpe_attempts','oir_attempts',
          'login_streak','practice_streak','last_practice_date','last_login_date',
        ].join(',');
        const resp = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?select=${cols}&limit=1`,
          { headers: _headers(token) }
        );
        if (resp.ok) {
          const rows = await resp.json();
          if (rows.length) return { source: 'supabase', ...rows[0] };
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

  function _getSupabaseToken() {
    // Supabase JS client stores the session under a key like
    // "sb-<project-ref>-auth-token" in localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const obj = JSON.parse(localStorage.getItem(k) || '{}');
          return obj?.access_token || null;
        }
      }
    } catch { /* ignore */ }
    return null;
  }

  // ── Public API ─────────────────────────────────────────────────────────
  return { startSession, onSlideComplete, onSessionComplete, getProgress };
})();

window.ProgressTracker = ProgressTracker;
