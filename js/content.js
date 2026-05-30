// content.js — SSBForge Content Registry
// Free content loads from practice-content-data.js (shipped with site).
// Premium content is fetched from Supabase at runtime — never in the repo.

const FREE_LIMIT = { tat: 5, wat: 30, ppdt: 3, lecturette: 10, srt: 15, gpe: 1 };

const MODULES = {
  tat: {
    label: 'TAT — Thematic Apperception Test',
    timePerSlide: 240,
    type: 'image',
    indexFile: 'content/tat/index.json',
    instructions: 'You will see an image and have 4 minutes to write your story. Write a complete story with: (1) Background leading up to the scene, (2) What is happening NOW, (3) How it will END. Your hero must have strong OLQs. The timer auto-advances to the next image.'
  },
  wat: {
    label: 'WAT — Word Association Test',
    timePerSlide: 15,
    type: 'text-word',
    indexFile: 'content/wat/index.json',
    instructions: 'A word will appear on screen for 15 seconds. Write the FIRST complete sentence that comes to mind. Do not overthink — responses must be spontaneous, positive, and action-oriented. Timer auto-advances to the next word.'
  },
  ppdt: {
    label: 'PPDT — Picture Perception & Discussion',
    timePerSlide: 240,
    type: 'image',
    indexFile: 'content/ppdt/index.json',
    instructions: 'A hazy picture is shown for 30 seconds. Then you have 4 minutes to write your story. Include: number of people, approximate age, mood (positive/negative), action happening, and a full narrative with positive outcome. The timer will count down 4 minutes per picture.'
  },
  lecturette: {
    label: 'Lecturette — 3-Minute Speaking',
    timePerSlide: 180,
    type: 'text-topic',
    indexFile: 'content/lecturette/index.json',
    instructions: 'A topic will appear on screen. You have 3 minutes to prepare mentally (use the timer), then speak aloud for 3 minutes. Structure: (1) Define the topic, (2) Present 3-4 key points, (3) Give your opinion, (4) Conclusion. Speak to an imaginary audience.'
  },
  srt: {
    label: 'SRT — Situation Reaction Test',
    timePerSlide: 30,
    type: 'text-situation',
    indexFile: 'content/srt/index.json',
    instructions: 'A situation will be shown for 30 seconds. Write your immediate, instinctive reaction — what you would actually do — in a few words. Responses must be practical, moral, and show initiative. Speed is critical: roughly 30 seconds per situation. Do not overthink.'
  },
  gpe: {
    label: 'GPE — Group Planning Exercise',
    timePerSlide: 600,
    type: 'image',
    indexFile: 'content/gpe/index.json',
    instructions: 'Study the GPE image carefully. Instructions for the exercise will appear here. You have 10 minutes to write a practical, time-bound group plan.'
  }
};

// ---------------------------------------------------------------------------
// Supabase premium content fetcher
// Reads SUPABASE_URL and SUPABASE_KEY from auth.js (already loaded before this)
// ---------------------------------------------------------------------------

// Generate signed URLs in batch for image modules
// Uses POST /storage/v1/object/sign/{bucket} with array of paths
async function generateSignedUrls(paths, bucket, accessToken) {
  if (!paths.length) return {};

  const url = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : null;
  const key = (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : null;
  if (!url || !key) return {};

  try {
    const res = await fetch(url + '/storage/v1/object/sign/' + bucket, {
      method: 'POST',
      headers: {
        'apikey':        key,
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ expiresIn: 3600, paths: paths })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Signed URL batch failed:', res.status, err.message || err.error);
      return {};
    }

    const results = await res.json();
    // Build map: path → full signed URL
    const map = {};
    results.forEach(item => {
      if (item.signedURL) {
        // signedURL is a relative path — prepend Supabase URL
        map[item.path] = url + item.signedURL;
      } else if (item.error) {
        console.warn('Signed URL error for', item.path, ':', item.error);
      }
    });
    return map;
  } catch (err) {
    console.warn('Signed URL generation error:', err);
    return {};
  }
}

// Extract the storage path from a src value
// Handles: 'tat/tat_006.jpg', 'premium_images/tat/tat_006.jpg', 'tat_006.jpg'
function toStoragePath(src, module) {
  if (!src) return null;
  if (src.startsWith('premium_images/')) return src.replace('premium_images/', '');
  if (src.includes('/')) return src; // already has subfolder e.g. 'tat/tat_006.jpg'
  return module + '/' + src;         // just filename — add module subfolder
}

async function fetchPremiumContent(module) {
  const url     = (typeof SUPABASE_URL !== 'undefined') ? SUPABASE_URL : null;
  const key     = (typeof SUPABASE_KEY !== 'undefined') ? SUPABASE_KEY : null;
  const session = (typeof Auth !== 'undefined') ? Auth.getUser() : null;

  if (!url || !key || !url.includes('supabase') || !session?.accessToken) return [];

  try {
    // ── Step 1: Fetch metadata from premium_content table ──────────────────
    const res = await fetch(
      url + '/rest/v1/premium_content?module=eq.' + module +
            '&order=sort_order.asc&select=*',
      {
        headers: {
          'apikey':        key,
          'Authorization': 'Bearer ' + session.accessToken,
          'Accept':        'application/json'
        }
      }
    );

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.warn('Premium content access denied (' + res.status + ') — user may not be premium or token expired');
        return [];
      }
      console.warn('Premium content fetch failed:', res.status);
      return [];
    }

    const rows = await res.json();
    if (!rows.length) return [];

    // ── Step 2: For image modules, batch-generate signed URLs ──────────────
    const IMAGE_MODULES = ['tat', 'ppdt', 'gpe'];
    let signedUrlMap = {};

    if (IMAGE_MODULES.includes(module)) {
      const storagePaths = rows
        .map(row => toStoragePath(row.src, module))
        .filter(Boolean);

      if (storagePaths.length) {
        signedUrlMap = await generateSignedUrls(storagePaths, 'premium_images', session.accessToken);
        console.log('Signed URLs generated:', Object.keys(signedUrlMap).length + '/' + storagePaths.length);
      }
    }

    // ── Step 3: Build items with resolved src URLs ─────────────────────────
    return rows.map(row => {
      let resolvedSrc = row.src;

      if (IMAGE_MODULES.includes(module) && row.src) {
        const storagePath = toStoragePath(row.src, module);
        resolvedSrc = signedUrlMap[storagePath] || null;

        if (!resolvedSrc) {
          console.warn('No signed URL for:', row.src, '— check storage path and RLS policy');
        }
      }

      return {
        id:           row.id,
        label:        row.label,
        word:         row.word,
        topic:        row.topic,
        situation:    row.situation,
        src:          resolvedSrc,
        instructions: row.instructions,
        timeSeconds:  row.time_seconds,
        free:         false,
        locked:       false
      };
    });

  } catch (err) {
    console.warn('Premium content fetch error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main content loader
// ---------------------------------------------------------------------------
async function loadContentIndex(module) {
  // Step 1: Load free content (from index.json → practice-content-data.js fallback)
  const freeItems = await loadFreeContent(module);

  // Step 2: Fetch premium metadata/content from Supabase
  // Premium users get unlocked content
  // Free users only get locked placeholders in the list
  const premiumItems = await fetchPremiumContent(module);

  if (premiumItems.length) {
    const combined = [...freeItems, ...premiumItems];
    return normalizeContentItems(combined, module);
  }

  return freeItems;
}

async function loadFreeContent(module) {
  const candidates = getIndexCandidates(module);
  let lastError = null;

  // Try index.json first
  for (const indexFile of candidates) {
    try {
      const sep  = indexFile.includes('?') ? '&' : '?';
      const resp = await fetch(indexFile + sep + 'v=' + Date.now(), { cache: 'no-store' });
      if (!resp.ok) throw new Error('No index at ' + indexFile);
      const data = await resp.json();
      // Only keep free items from index.json
      const list = Array.isArray(data) ? data : (data?.value || []);
      const freeOnly = list.filter(item => item.free !== false);
      return normalizeContentItems(freeOnly, module);
    } catch (err) {
      lastError = err;
    }
  }

  // Fallback to embedded data (free items only)
  const embedded = window.PRACTICE_CONTENT_DATA && window.PRACTICE_CONTENT_DATA[module];
  const embeddedItems = Array.isArray(embedded)
    ? embedded
    : (embedded && Array.isArray(embedded.value) ? embedded.value : []);

  if (embeddedItems.length) {
    console.warn('Using embedded content for ' + module + ':', lastError);
    const freeOnly = embeddedItems.filter(item => item.free !== false);
    return normalizeContentItems(freeOnly, module);
  }

  console.warn('Using sample content for ' + module + ':', lastError);
  return normalizeContentItems(getSampleContent(module).filter(i => i.free !== false), module);
}

function getIndexCandidates(module) {
  const configured = MODULES[module].indexFile;
  const upper = 'content/' + module.toUpperCase() + '/index.json';
  const title = 'content/' + module.charAt(0).toUpperCase() + module.slice(1) + '/index.json';
  return [...new Set([configured, upper, title])];
}

function normalizeContentItems(data, module) {
  const list = Array.isArray(data)
    ? data
    : (data && Array.isArray(data.value) ? data.value : []);
  const mod = MODULES[module];
  const freeLimit = FREE_LIMIT[module] || list.length;

  return list.map((raw, index) => {
    const item = typeof raw === 'string' ? stringToItem(raw, module, index) : { ...raw };
    const number = index + 1;

    if (!item.id) item.id = module + '_' + number;
    if (item.free == null) item.free = index < freeLimit;

    if (mod.type === 'text-word') {
      item.word  = item.word  || item.label || item.topic || item.situation || '';
      item.label = item.label || item.word  || ('Word ' + number);
    } else if (mod.type === 'text-topic') {
      item.topic = item.topic || item.label || item.word || item.situation || '';
      item.label = item.label || ('Topic ' + number);
    } else if (mod.type === 'text-situation') {
      item.situation = item.situation || item.label || item.topic || item.word || '';
      item.label     = item.label     || ('Situation ' + number);
    } else if (mod.type === 'image') {
      item.label        = item.label || ('Picture ' + number);
      item.alt          = item.alt   || item.label;
      item.src          = normalizeImageSrc(item.src, module, number);
      item.instructions = item.instructions || null;
    }

    return item;
  });
}

function normalizeImageSrc(src, module, number) {
  // Already a full signed URL or external URL — use as-is
  if (src && (src.startsWith('http://') || src.startsWith('https://'))) return src;
  // Local relative path (free content)
  if (src && src.includes('/')) return src;
  if (src) return 'content/' + module + '/' + src;
  // Auto-generate local path as last resort
  const prefix = module + '_';
  return 'content/' + module + '/' + prefix + String(number).padStart(3, '0') + '.jpg';
}

function stringToItem(value, module, index) {
  const number = index + 1;
  if (module === 'wat')        return { id: 'wat_'  + number, label: value,                    word:      value };
  if (module === 'lecturette') return { id: 'lec_'  + number, label: value,                    topic:     value };
  if (module === 'srt')        return { id: 'srt_'  + number, label: 'Situation ' + number,    situation: value };
  if (module === 'gpe')        return { id: 'gpe_'  + number, label: 'GPE ' + number,          src:       value, timeSeconds: 600 };
  return { id: module + '_' + number, label: value };
}

// ---------------------------------------------------------------------------
// filterContent — called by practice.js after loadContentIndex
// With Supabase gating: premium items come back already unlocked from server.
// Free users only see free items (no locked placeholders cluttering the list).
// ---------------------------------------------------------------------------
function filterContent(items, module) {
  const isPremiumUser = typeof Auth !== 'undefined' && Auth.isPremium();

  return items.map(item => {
    const isFree = item.free !== false;

    return {
      ...item,
      locked: !isPremiumUser && !isFree
    };
  });
}

// ---------------------------------------------------------------------------
// getSampleContent — last-resort fallback, free items only
// ---------------------------------------------------------------------------
function getSampleContent(module) {
  switch (module) {
    case 'tat':
      return [
        { id: 'tat_001', label: 'Scene 1', src: 'content/tat/tat_001.jpg', free: true },
        { id: 'tat_002', label: 'Scene 2', src: 'content/tat/tat_002.jpg', free: true },
        { id: 'tat_003', label: 'Scene 3', src: 'content/tat/tat_003.jpg', free: true },
        { id: 'tat_004', label: 'Scene 4', src: 'content/tat/tat_004.jpg', free: true },
        { id: 'tat_005', label: 'Scene 5', src: 'content/tat/tat_005.jpg', free: true },
      ];
    case 'wat':
      return ['COURAGE','LEADERSHIP','DEDICATION','SACRIFICE','INTEGRITY',
              'DISCIPLINE','TEAMWORK','PERSEVERANCE','HONOUR','INITIATIVE',
              'CONFIDENCE','RESPONSIBILITY','SERVICE','PATRIOTISM','CHALLENGE',
              'AMBITION','STRENGTH','RESILIENCE','JUSTICE','MISSION',
              'DUTY','NATION','VICTORY','SOLDIER','WISDOM',
              'LOYALTY','BRAVERY','DETERMINATION','FOCUS','PURPOSE'
             ].map((w, i) => ({ id: 'wat_' + (i+1), label: w, word: w, free: true }));
    case 'ppdt':
      return [
        { id: 'ppdt_001', label: 'Picture 1', src: 'content/ppdt/ppdt_001.jpg', free: true },
        { id: 'ppdt_002', label: 'Picture 2', src: 'content/ppdt/ppdt_002.jpg', free: true },
        { id: 'ppdt_003', label: 'Picture 3', src: 'content/ppdt/ppdt_003.jpg', free: true },
      ];
    case 'lecturette':
      return ["India's Role in UN Peacekeeping","Digital India: Progress and Challenges",
              "Women in the Indian Armed Forces","Climate Change and National Security",
              "India's Space Programme","Cyber Warfare: The New Battlefield",
              "India's Border Management","Nuclear Deterrence in South Asia",
              "Role of Youth in Nation Building","India-China Relations"
             ].map((t, i) => ({ id: 'lec_' + (i+1), label: t, topic: t, free: true }));
    case 'srt':
      return ["You are trekking alone and notice a fellow trekker has twisted his ankle 5 km from base camp.",
              "You see a shop on fire. The shopkeeper is inside and people are just watching.",
              "During a group project, you realise your team leader's plan has a serious flaw.",
              "You witness a road accident. The injured person needs help but bystanders are reluctant.",
              "Your friend confides that he has been cheating in exams you are also appearing for.",
              "You are in a bus. A passenger collapses suddenly. The driver says he cannot stop.",
              "You are on night duty and find your senior is misusing government property.",
              "A classmate is being bullied by seniors. He is too scared to complain.",
              "You find a wallet with cash and ID cards on the road.",
              "During a river crossing exercise, a batch-mate panics in the middle of the river.",
              "You are leading a platoon and your radio stops working 3 km behind enemy lines.",
              "You discover a supplier has been bribing an official for a government contract.",
              "Your team is exhausted after a 20 km march with 5 km still remaining.",
              "An elderly woman is being harassed on a crowded bus. Others are ignoring it.",
              "You are presenting to senior officers and realise you have incorrect data."
             ].map((s, i) => ({ id: 'srt_' + (i+1), label: 'Situation ' + (i+1), situation: s, free: true }));
    case 'gpe':
      return [{
        id: 'gpe_001', label: 'GPE 1', src: 'content/gpe/gpe_001.jpg', free: true, timeSeconds: 600,
        instructions: 'You are a group of 6 students on an educational excursion in a rural area. You encounter multiple emergency situations shown on the map. Map scale: 1 cm = 1 km. Current time: 11:30 AM. Resources: one vehicle, ropes, first-aid kit, nearby villagers.\n\nAs a group, identify all problems, assign priorities, calculate time and distance, divide manpower, coordinate with authorities, and write a practical execution plan.'
      }];
    default:
      return [];
  }
}

window.ContentLoader = { loadContentIndex, getSampleContent, filterContent, MODULES, FREE_LIMIT };
