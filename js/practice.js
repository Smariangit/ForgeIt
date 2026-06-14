// practice.js — SSBForge Practice Engine v5
// Changes from v4: ProgressTracker hooks added at session start/slide/complete

const Practice = (function () {

  let currentModule = null;
  let items         = [];
  let currentIdx    = 0;
  let timerInterval = null;
  let timerSecs     = 0;
  let timerTotal    = 0;
  let sessionState  = 'idle'; // 'idle' | 'running' | 'paused' | 'done'
  let autoAdvance   = true;
  let slidesCompletedThisSession = 0;

  function $  (id) { return document.getElementById(id); }
  function startBtn()  { return $('startBtn'); }
  function prevBtn()   { return $('prevBtn'); }
  function nextBtn()   { return $('nextBtn'); }

  // ── Boot ───────────────────────────────────────────────────────────────
  function init() {
    const mode = new URLSearchParams(window.location.search).get('mode') || 'tat';
    switchModule(mode);

    document.querySelectorAll('.module-tab').forEach(tab =>
      tab.addEventListener('click', () => switchModule(tab.dataset.mode))
    );

    startBtn().addEventListener('click',  handleStartBtn);
    prevBtn() .addEventListener('click',  prevSlide);
    nextBtn() .addEventListener('click',  () => nextSlide(true));
    $('resetBtn')      .addEventListener('click', resetAll);
    $('autoAdvance')   .addEventListener('change', e => { autoAdvance = e.target.checked; });
    $('timerPauseBtn') .addEventListener('click', togglePause);
    $('timerSkipBtn')  .addEventListener('click', () => nextSlide(true));
  }

  // ── Module switch ──────────────────────────────────────────────────────
  async function switchModule(mode) {
    if (!ContentLoader.MODULES[mode]) return;
    currentModule = mode;

    document.querySelectorAll('.module-tab')
      .forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    history.replaceState(null, '', '?mode=' + mode);

    killTimer();
    sessionState = 'idle';
    slidesCompletedThisSession = 0;

    const mod = ContentLoader.MODULES[mode];
    $('pageTitle').textContent       = mod.label;
    $('instructionText').textContent = mod.instructions;
    syncStartBtn();

    const raw = await ContentLoader.loadContentIndex(mode);
    items      = ContentLoader.filterContent(raw, mode);
    currentIdx = 0;

    prevBtn().disabled = false;
    nextBtn().disabled = false;

    // GPE-specific: tall scrollable sidebar list
    const cl = $('contentList');
    if (cl) {
      if (mode === 'gpe') cl.classList.add('gpe-list');
      else                cl.classList.remove('gpe-list');
    }

    renderSidebar();
    renderSlide();
    renderTimerIdle();

    const hasLocked = items.some(i => i.locked);
    const notice = $('premiumNotice');
    if (notice) notice.style.display = hasLocked ? 'block' : 'none';
  }

  // ── Render slide ───────────────────────────────────────────────────────
  function renderSlide() {
    if (!items.length) return;
    const item = items[currentIdx];
    const mod  = ContentLoader.MODULES[currentModule];

    $('slideCounter').textContent = (currentIdx + 1) + ' / ' + items.length;
    renderSidebar();

    if (item.locked) {
      $('slideImage')    .classList.add('hidden');
      $('slideTextArea') .classList.remove('hidden');
      $('slideTextInner').className   = 'slide-topic';
      $('slideTextInner').textContent = '🔒 Premium Content\n\nUnlock unlimited practice for ₹51/month';
      $('progressBar')   .style.width = '0%';
      killTimer();
      sessionState = 'idle';
      syncStartBtn();
      return;
    }

    if (mod.type === 'image') {
      $('slideTextArea').classList.add('hidden');
      const img = $('slideImage');
      img.classList.remove('hidden');
      img.onerror = null;
      img.src = '';
      img.src = item.src || '';
      img.alt = item.label || '';
      img.onerror = function () {
        img.classList.add('hidden');
        $('slideTextArea') .classList.remove('hidden');
        $('slideTextInner').className   = 'slide-topic';
        $('slideTextInner').textContent =
          '📷 Image not yet uploaded\n\n' + item.label +
          '\n\nAdd the file to the GitHub content folder.';
      };

      // Show OIR fullscreen button if it exists
      const fsBtn = $('oirFullscreen');
      if (fsBtn) fsBtn.style.display = (currentModule === 'oir') ? 'inline-flex' : 'none';

    } else {
      // Text types: WAT word / Lecturette topic / SRT situation / GPE scenario
      $('slideImage')    .classList.add('hidden');
      $('slideTextArea') .classList.remove('hidden');

      if (mod.type === 'text-word') {
        $('slideTextInner').className   = 'slide-word';
        $('slideTextInner').textContent = item.word || item.label;
      } else {
        $('slideTextInner').className   = 'slide-topic';
        $('slideTextInner').textContent = item.situation || item.topic || item.scenario || item.label;
      }
    }

    $('progressBar').style.width = '100%';
    if (sessionState !== 'running') {
      $('timerDisplay').textContent = formatTime(item.timeSeconds || mod.timePerSlide || 30);
      $('timerDisplay').classList.remove('danger');
    }
  }

  // ── Timer ──────────────────────────────────────────────────────────────
  function startTimer(seconds) {
    killTimer();
    timerTotal = seconds;
    timerSecs  = seconds;
    tickUI();

    timerInterval = setInterval(() => {
      if (sessionState !== 'running') return;
      timerSecs--;
      tickUI();
      if (timerSecs <= 0) {
        killTimer();
        // Count this slide as completed
        slidesCompletedThisSession++;
        if (typeof ProgressTracker !== 'undefined') ProgressTracker.onSlideComplete();

        if (autoAdvance) setTimeout(() => nextSlide(false), 500);
      }
    }, 1000);
  }

  function killTimer() {
    if (timerInterval !== null) { clearInterval(timerInterval); timerInterval = null; }
  }

  function tickUI() {
    const pct = timerTotal > 0 ? (timerSecs / timerTotal) * 100 : 0;
    $('timerBarFill').style.width = pct + '%';
    $('timerDisplay').textContent = formatTime(timerSecs);
    $('timerDisplay').classList.toggle('danger', timerSecs <= 5 && timerSecs > 0);
    $('timerInfo').textContent =
      'Slide ' + (currentIdx + 1) + '/' + items.length + ' · ' +
      (timerSecs <= 0 ? 'Time up!' : timerSecs + 's left');
  }

  function renderTimerIdle() {
    const mod = ContentLoader.MODULES[currentModule];
    const dur = (items[0] && items[0].timeSeconds) || mod.timePerSlide || 30;
    $('timerDisplay').textContent = formatTime(dur);
    $('timerDisplay').classList.remove('danger');
    $('timerBarFill').style.width = '100%';
    $('timerInfo').textContent =
      (mod.timePerSlide ? mod.timePerSlide + 's per slide' : '17 min per paper') + ' · Press Start';
  }

  function formatTime(s) {
    if (s == null) return '--:--';
    s = Math.max(0, s);
    return Math.floor(s / 60) + ':' + (s % 60).toString().padStart(2, '0');
  }

  // ── Start / Pause / Resume (three-state button) ────────────────────────
  function handleStartBtn() {
    if (sessionState === 'idle' || sessionState === 'done') {
      if (!items.length) return;
      currentIdx = 0;
      slidesCompletedThisSession = 0;
      sessionState = 'running';
      syncStartBtn();

      // ── HOOK: notify ProgressTracker a new session has started ──
      if (typeof ProgressTracker !== 'undefined') {
        ProgressTracker.startSession(currentModule);
      }

      renderSlide();
      const mod = ContentLoader.MODULES[currentModule];
      startTimer(items[0].timeSeconds || mod.timePerSlide || 30);

    } else if (sessionState === 'running') {
      sessionState = 'paused';
      syncStartBtn();

    } else if (sessionState === 'paused') {
      sessionState = 'running';
      syncStartBtn();
      if (timerSecs <= 0 && autoAdvance) nextSlide(false);
    }
  }

  function syncStartBtn() {
    const btn = startBtn();
    const map = {
      idle:    '▶ Start',
      running: '⏸ Pause',
      paused:  '▶ Resume',
      done:    '↺ Restart',
    };
    btn.textContent = map[sessionState] || '▶ Start';
  }

  function togglePause() { handleStartBtn(); }

  // ── Navigation ─────────────────────────────────────────────────────────
  function nextSlide(userTriggered) {
    if (!items.length) return;

    if (currentIdx < items.length - 1) {
      // Count as completed when user manually skips too (userTriggered)
      if (userTriggered && sessionState === 'running') {
        slidesCompletedThisSession++;
        if (typeof ProgressTracker !== 'undefined') ProgressTracker.onSlideComplete();
      }
      currentIdx++;
      renderSlide();
      if (sessionState === 'running' && !items[currentIdx].locked) {
        const mod = ContentLoader.MODULES[currentModule];
        startTimer(items[currentIdx].timeSeconds || mod.timePerSlide || 30);
      }
    } else {
      // ── SESSION COMPLETE ──
      killTimer();
      slidesCompletedThisSession++;
      if (typeof ProgressTracker !== 'undefined') ProgressTracker.onSlideComplete();
      sessionState = 'done';
      syncStartBtn();
      $('timerDisplay').textContent = '✓ Done';
      $('timerDisplay').classList.remove('danger');
      $('timerBarFill').style.width = '100%';
      $('timerInfo').textContent = 'Session complete! Great work.';

      // ── HOOK: record to Supabase ──
      if (typeof ProgressTracker !== 'undefined') {
        ProgressTracker.onSessionComplete(slidesCompletedThisSession);
      }
    }
  }

  function prevSlide() {
    if (!items.length || currentIdx <= 0) return;
    currentIdx--;
    renderSlide();
    if (sessionState === 'running' && !items[currentIdx].locked) {
      const mod = ContentLoader.MODULES[currentModule];
      startTimer(items[currentIdx].timeSeconds || mod.timePerSlide || 30);
    }
  }

  function resetAll() {
    killTimer();
    sessionState = 'idle';
    currentIdx   = 0;
    slidesCompletedThisSession = 0;
    syncStartBtn();
    renderSlide();
    renderTimerIdle();
  }

  // ── Sidebar ────────────────────────────────────────────────────────────
  function renderSidebar() {
    const list = $('contentList');
    if (!list) return;
    list.innerHTML = '';
    items.forEach((item, i) => {
      const div   = document.createElement('div');
      div.className = 'content-item' + (i === currentIdx ? ' current' : '');
      const label = item.label || item.word || item.topic || item.situation || item.scenario || ('Item ' + (i + 1));
      div.innerHTML =
        '<span>' + label + '</span>' +
        (item.locked ? '<span class="item-lock">🔒</span>' : '');
      div.addEventListener('click', () => {
        if (item.locked) { window.location.href = 'premium.html'; return; }
        currentIdx = i;
        renderSlide();
        if (sessionState === 'running') {
          const mod = ContentLoader.MODULES[currentModule];
          startTimer(item.timeSeconds || mod.timePerSlide || 30);
        }
      });
      list.appendChild(div);
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('moduleTabs')) Practice.init();
});
