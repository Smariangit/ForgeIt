// practice.js — SSBForge Practice Engine v3 (bug-fixed)

const Practice = (function() {
  let currentModule = null;
  let items = [];
  let currentIdx = 0;
  let timerInterval = null;
  let timerSecs = 0;
  let timerTotal = 0;
  let isRunning = false;
  let autoAdvance = true;
  let switchToken = 0;

  const el = {
    pageTitle:      () => document.getElementById('pageTitle'),
    tabs:           () => document.querySelectorAll('.module-tab'),
    slideImage:     () => document.getElementById('slideImage'),
    slideTextArea:  () => document.getElementById('slideTextArea'),
    slideTextInner: () => document.getElementById('slideTextInner'),
    progressBar:    () => document.getElementById('progressBar'),
    startBtn:       () => document.getElementById('startBtn'),
    prevBtn:        () => document.getElementById('prevBtn'),
    nextBtn:        () => document.getElementById('nextBtn'),
    resetBtn:       () => document.getElementById('resetBtn'),
    autoToggle:     () => document.getElementById('autoAdvance'),
    slideCounter:   () => document.getElementById('slideCounter'),
    timerDisplay:   () => document.getElementById('timerDisplay'),
    timerBarFill:   () => document.getElementById('timerBarFill'),
    timerInfo:      () => document.getElementById('timerInfo'),
    timerPause:     () => document.getElementById('timerPauseBtn'),
    timerSkip:      () => document.getElementById('timerSkipBtn'),
    contentList:    () => document.getElementById('contentList'),
    premiumNotice:  () => document.getElementById('premiumNotice'),
    instructions:   () => document.getElementById('instructionText'),
  };

  function init() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode') || 'tat';
    switchModule(mode);

    el.tabs().forEach(tab => tab.addEventListener('click', () => switchModule(tab.dataset.mode)));

    el.startBtn().addEventListener('click', handleStart);
    el.prevBtn().addEventListener('click', prevSlide);
    el.nextBtn().addEventListener('click', nextSlide);
    el.resetBtn().addEventListener('click', resetAll);
    el.autoToggle().addEventListener('change', e => { autoAdvance = e.target.checked; });
    el.timerPause().addEventListener('click', togglePause);
    el.timerSkip().addEventListener('click', nextSlide);
  }

  async function switchModule(mode) {
    if (!ContentLoader.MODULES[mode]) mode = 'tat';
    const token = ++switchToken;
    currentModule = mode;

    el.tabs().forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    history.replaceState(null, '', '?mode=' + mode);

    stopTimer();
    isRunning = false;
    currentIdx = 0;
    items = [];

    const mod = ContentLoader.MODULES[mode];
    el.pageTitle().textContent = mod.label;
    el.instructions().textContent = mod.instructions;
    el.startBtn().textContent = '▶ Start';
    el.slideCounter().textContent = '0 / 0';
    el.timerDisplay().textContent = formatTime(mod.timePerSlide || 1020);
    el.timerDisplay().classList.remove('danger');
    el.timerInfo().textContent = 'Loading content...';
    el.timerBarFill().style.width = '100%';
    clearSlideStage();
    renderContentList();

    const rawItems = await ContentLoader.loadContentIndex(mode);
    if (token !== switchToken || currentModule !== mode) return;

    items = ContentLoader.filterContent(rawItems, mode);
    currentIdx = 0;

    // BUG FIX: Enable nav buttons immediately after content loads
    el.prevBtn().disabled = false;
    el.nextBtn().disabled = false;

    renderContentList();
    showSlide();

    const duration = mod.timePerSlide || 1020;
    el.timerDisplay().textContent = formatTime(duration);
    el.timerDisplay().classList.remove('danger');
    el.timerInfo().textContent = (mod.timePerSlide ? mod.timePerSlide + 's per slide' : '17 min per paper') + ' · Press Start';
    el.timerBarFill().style.width = '100%';

    const hasLocked = items.some(i => i.locked);
    if (el.premiumNotice()) el.premiumNotice().style.display = hasLocked ? 'block' : 'none';
  }

  // showSlide: renders the current item, NO timer side-effects
  function showSlide() {
    if (!items.length) return;
    const item = items[currentIdx];
    const mod = ContentLoader.MODULES[currentModule];
    const img = el.slideImage();

    resetSlideImage(img);

    el.slideCounter().textContent = (currentIdx + 1) + ' / ' + items.length;
    el.instructions().textContent = item.instructions || mod.instructions;
    renderContentList();

    // Locked slide
    if (item.locked) {
      el.slideImage().classList.add('hidden');
      el.slideTextArea().classList.remove('hidden');
      el.slideTextInner().className = 'slide-topic';
      el.slideTextInner().textContent = '🔒 Premium Content\n\nUnlock unlimited practice for only ₹51/month';
      el.timerDisplay().textContent = '--:--';
      el.progressBar().style.width = '0%';
      if (isRunning) stopTimer();
      return;
    }

    // Render by type
    if (mod.type === 'image') {
      el.slideTextArea().classList.add('hidden');
      img.alt = item.label || '';
      loadSlideImage(img, item.src || '', item.label || 'image');
    } else if (mod.type === 'text-word') {
      el.slideTextArea().classList.remove('hidden');
      el.slideTextInner().className = 'slide-word';
      el.slideTextInner().textContent = item.word || item.label;
    } else if (mod.type === 'text-topic' || mod.type === 'text-situation') {
      el.slideTextArea().classList.remove('hidden');
      el.slideTextInner().className = 'slide-topic';
      el.slideTextInner().textContent = item.situation || item.topic || item.label;
    }

    // Show the correct duration in timer display when not running
    const duration = item.timeSeconds || mod.timePerSlide || 30;
    el.progressBar().style.width = '100%';
    if (!isRunning) {
      el.timerDisplay().textContent = formatTime(duration);
      el.timerDisplay().classList.remove('danger');
    }
  }

  function clearSlideStage() {
    resetSlideImage(el.slideImage());
    el.slideTextArea().classList.remove('hidden');
    el.slideTextInner().className = 'slide-topic';
    el.slideTextInner().textContent = 'Loading...';
  }

  function resetSlideImage(img) {
    img.onload = null;
    img.onerror = null;
    img.removeAttribute('src');
    img.alt = '';
    img.classList.add('hidden');
  }

  function loadSlideImage(img, src, label) {
    if (!src) {
      showImageMissing(label);
      return;
    }

    const tried = [];

    function trySrc(nextSrc) {
      tried.push(nextSrc);
      img.onload = function() {
        img.classList.remove('hidden');
        el.slideTextArea().classList.add('hidden');
      };
      img.onerror = function() {
        const fallback = getImageFallbacks(nextSrc).find(path => !tried.includes(path));
        if (fallback) {
          trySrc(fallback);
          return;
        }
        showImageMissing(label);
      };
      img.src = nextSrc;
    }

    trySrc(src);
  }

  function showImageMissing(label) {
    el.slideImage().classList.add('hidden');
    el.slideTextArea().classList.remove('hidden');
    el.slideTextInner().className = 'slide-topic';
    el.slideTextInner().textContent = 'Image not found: ' + label + '\n\nCheck the image path in this module index.json.';
  }

  // ===== Timer =====
  function startSlideTimer(seconds) {
    stopTimer(); // always clear previous before starting new
    timerTotal = seconds;
    timerSecs = seconds;
    updateTimerUI();

    timerInterval = setInterval(() => {
      if (!isRunning) return;
      timerSecs--;
      updateTimerUI();
      if (timerSecs <= 0) {
        stopTimer();
        if (autoAdvance) setTimeout(nextSlide, 400);
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function togglePause() {
    isRunning = !isRunning;
    el.timerPause().textContent = isRunning ? '⏸ Pause' : '▶ Resume';
  }

  function updateTimerUI() {
    const pct = timerTotal > 0 ? (timerSecs / timerTotal) * 100 : 0;
    el.timerDisplay().textContent = formatTime(timerSecs);
    el.timerBarFill().style.width = pct + '%';
    el.timerDisplay().classList.toggle('danger', timerSecs <= 5 && timerSecs > 0);
    el.timerInfo().textContent = 'Slide ' + (currentIdx + 1) + '/' + items.length + ' · ' + (timerSecs <= 0 ? 'Time up!' : timerSecs + 's left');
  }

  function formatTime(s) {
    if (s == null) return '--:--';
    const m = Math.floor(Math.abs(s) / 60);
    const sec = Math.abs(s) % 60;
    return m + ':' + sec.toString().padStart(2, '0');
  }

  // ===== Navigation — BUG FIX: nextSlide/prevSlide only start timer if session is running =====
  function handleStart() {
  if (!items.length) return;

  // If already running, clicking again resets everything
  if (isRunning) {
    stopTimer();
    isRunning = false;
    currentIdx = 0;

    el.startBtn().textContent = '▶ Start';
    showSlide();

    const mod = ContentLoader.MODULES[currentModule];
    el.timerDisplay().textContent = formatTime(mod.timePerSlide || 1020);
    el.timerDisplay().classList.remove('danger');
    el.timerBarFill().style.width = '100%';
    el.timerInfo().textContent = 'Press Start to begin.';
    
    return;
  }

  // Start session normally
  isRunning = true;
  currentIdx = 0;

  el.startBtn().textContent = '⬛ Running...';
    showSlide();

  const mod = ContentLoader.MODULES[currentModule];
  startSlideTimer(items[0].timeSeconds || mod.timePerSlide || 30);
}

  function nextSlide() {
    if (!items.length) return;
    if (currentIdx < items.length - 1) {
      currentIdx++;
      showSlide();
      // Only run timer if actively started — this was the core bug
      if (isRunning && !items[currentIdx].locked) {
        const mod = ContentLoader.MODULES[currentModule];
        startSlideTimer(items[currentIdx].timeSeconds || mod.timePerSlide || 30);
      }
    } else {
      stopTimer();
      isRunning = false;
      el.timerDisplay().textContent = '✓ Done';
      el.timerDisplay().classList.remove('danger');
      el.timerInfo().textContent = 'Session complete! Great work.';
      el.progressBar().style.width = '100%';
      el.startBtn().textContent = '▶ Start Again';
    }
  }

  function prevSlide() {
    if (!items.length || currentIdx <= 0) return;
    currentIdx--;
    showSlide();
    if (isRunning && !items[currentIdx].locked) {
      const mod = ContentLoader.MODULES[currentModule];
      startSlideTimer(items[currentIdx].timeSeconds || mod.timePerSlide || 30);
    }
  }

  function resetAll() {
    stopTimer();
    isRunning = false;
    currentIdx = 0;
    el.startBtn().textContent = '▶ Start';
    showSlide();
    const mod = ContentLoader.MODULES[currentModule];
    el.timerDisplay().textContent = formatTime(mod.timePerSlide || 1020);
    el.timerDisplay().classList.remove('danger');
    el.timerBarFill().style.width = '100%';
    el.timerInfo().textContent = 'Press Start to begin.';
  }


  function getImageFallbacks(src) {
    if (!src || !/\.(png|jpe?g|webp)$/i.test(src)) return [];
    const base = src.replace(/\.(png|jpe?g|webp)$/i, '');
    return ['.jpg', '.jpeg', '.png', '.webp'].map(ext => base + ext);
  }
  function getContentListLabel(item, index) {
    const shouldMaskLabel = (currentModule === 'wat' || currentModule === 'lecturette') && !Auth.isPremium();
    if (shouldMaskLabel) {
      return 'Topic ' + (index + 1);
    }
    return item.label || item.word || item.topic || item.situation || ('Item ' + (index + 1));
  }

  function renderContentList() {
    const list = el.contentList();
    if (!list) return;
    list.innerHTML = '';
    items.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'content-item' + (i === currentIdx ? ' current' : '');
      const label = getContentListLabel(item, i);
      div.innerHTML = '<span>' + label + '</span>' + (item.locked ? '<span class="item-lock">🔒</span>' : '');
      div.addEventListener('click', () => {
        if (item.locked) { window.location.href = 'premium.html'; return; }
        currentIdx = i;
        showSlide();
        if (isRunning) {
          const mod = ContentLoader.MODULES[currentModule];
          startSlideTimer(item.timeSeconds || mod.timePerSlide || 30);
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
