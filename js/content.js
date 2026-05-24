// content.js — SSBForge Content Registry

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

async function loadContentIndex(module) {
  const candidates = getIndexCandidates(module);
  let lastError = null;

  for (const indexFile of candidates) {
    try {
      const separator = indexFile.includes('?') ? '&' : '?';
      const resp = await fetch(indexFile + separator + 'v=' + Date.now(), { cache: 'no-store' });
      if (!resp.ok) throw new Error('No index at ' + indexFile);
      const data = await resp.json();
      return normalizeContentItems(data, module);
    } catch (err) {
      lastError = err;
    }
  }

  const embedded = window.PRACTICE_CONTENT_DATA && window.PRACTICE_CONTENT_DATA[module];
  const embeddedItems = Array.isArray(embedded)
    ? embedded
    : (embedded && Array.isArray(embedded.value) ? embedded.value : []);

  if (embeddedItems.length) {
    console.warn('Using embedded content fallback for ' + module + ':', lastError);
    return normalizeContentItems(embeddedItems, module);
  }

  console.warn('Using sample content for ' + module + ':', lastError);
  return normalizeContentItems(getSampleContent(module), module);
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
      item.word = item.word || item.label || item.topic || item.situation || '';
      item.label = item.label || item.word || ('Word ' + number);
    } else if (mod.type === 'text-topic') {
      item.topic = item.topic || item.label || item.word || item.situation || '';
      item.label = item.label || ('Topic ' + number);
    } else if (mod.type === 'text-situation') {
      item.situation = item.situation || item.label || item.topic || item.word || '';
      item.label = item.label || ('Situation ' + number);
    } else if (mod.type === 'image') {
      item.label = item.label || ('Picture ' + number);
      item.alt = item.alt || item.label;
      item.src = normalizeImageSrc(item.src, module, number);
      // Preserve per-item instructions (e.g. GPE scenario text)
      item.instructions = item.instructions || null;
    }

    return item;
  });
}


function normalizeImageSrc(src, module, number) {
  if (src && src.includes('/')) return src;
  if (src) return 'content/' + module + '/' + src;

  const prefix = module + '_';
  return 'content/' + module + '/' + prefix + String(number).padStart(3, '0') + '.jpg';
}
function stringToItem(value, module, index) {
  const number = index + 1;
  if (module === 'wat') return { id: 'wat_' + number, label: value, word: value };
  if (module === 'lecturette') return { id: 'lec_' + number, label: value, topic: value };
  if (module === 'srt') return { id: 'srt_' + number, label: 'Situation ' + number, situation: value };
  if (module === 'gpe') return { id: 'gpe_' + number, label: 'GPE ' + number, src: value, timeSeconds: 600 };
  return { id: module + '_' + number, label: value };
}

function getSampleContent(module) {
  switch(module) {
    case 'tat':
      return [
        { id: 'tat_001', label: 'Scene 1', src: 'content/tat/tat_001.jpg', free: true },
        { id: 'tat_002', label: 'Scene 2', src: 'content/tat/tat_002.jpg', free: true },
        { id: 'tat_003', label: 'Scene 3', src: 'content/tat/tat_003.jpg', free: true },
        { id: 'tat_004', label: 'Scene 4', src: 'content/tat/tat_004.jpg', free: true },
        { id: 'tat_005', label: 'Scene 5', src: 'content/tat/tat_005.jpg', free: true },
        { id: 'tat_006', label: 'Scene 6', src: 'content/tat/tat_006.jpg', free: true },
        { id: 'tat_007', label: 'Scene 7', src: 'content/tat/tat_007.jpg', free: true },
		{ id: 'tat_008', label: 'Scene 8', src: 'content/tat/tat_008.jpg', free: false },
		{ id: 'tat_009', label: 'Scene 9', src: 'content/tat/tat_009.jpg', free: false },
		{ id: 'tat_0010', label: 'Scene 10', src: 'content/tat/tat_010.jpg', free: false },
      ];
    case 'wat':
      return [
        'COURAGE','LEADERSHIP','DEDICATION','SACRIFICE','INTEGRITY',
        'DISCIPLINE','TEAMWORK','PERSEVERANCE','HONOUR','INITIATIVE',
        'CONFIDENCE','RESPONSIBILITY','SERVICE','PATRIOTISM','CHALLENGE',
        'AMBITION','STRENGTH','RESILIENCE','JUSTICE','MISSION',
        'DUTY','NATION','VICTORY','SOLDIER','WISDOM',
        'LOYALTY','BRAVERY','DETERMINATION','FOCUS','SACRIFICE',
        // Premium
        'STRATEGY','ENDURANCE','UNITY','EMPATHY','COMMAND'
      ].map((w, i) => ({ id: 'wat_' + (i+1), label: w, word: w, free: i < 30 }));
    case 'ppdt':
      return [
        { id: 'ppdt_001', label: 'Picture 1', src: 'content/ppdt/ppdt_001.jpg', free: true },
        { id: 'ppdt_002', label: 'Picture 2', src: 'content/ppdt/ppdt_002.jpg', free: true },
        { id: 'ppdt_003', label: 'Picture 3', src: 'content/ppdt/ppdt_003.jpg', free: true },
        { id: 'ppdt_004', label: 'Picture 4', src: 'content/ppdt/ppdt_004.jpg', free: false },
        { id: 'ppdt_005', label: 'Picture 5', src: 'content/ppdt/ppdt_005.jpg', free: false },
      ];
    case 'lecturette':
      return [
        "India's Role in UN Peacekeeping",
        "Digital India: Progress and Challenges",
        "Women in the Indian Armed Forces",
        "Climate Change and National Security",
        "India's Space Programme",
        "Cyber Warfare: The New Battlefield",
        "India's Border Management",
        "Nuclear Deterrence in South Asia",
        "Role of Youth in Nation Building",
        "India-China Relations",
        // Premium
        "India's Arctic Policy",
        "Hypersonic Missiles and Future Warfare",
        "Agnipath Scheme: Pros and Cons",
        "QUAD and Indo-Pacific Strategy",
        "AI in Defence Applications",
      ].map((t, i) => ({ id: 'lec_' + (i+1), label: t, topic: t, free: i < 10 }));
    case 'srt':
      return [
        "You are trekking alone and notice a fellow trekker has twisted his ankle 5 km from the base camp.",
        "You see a shop on fire. The shopkeeper is inside and people around are just watching.",
        "During a group project, you realise your team leader's plan has a serious flaw that will cause failure.",
        "You witness a road accident. The injured person needs immediate help but people are reluctant to help fearing legal trouble.",
        "Your friend confides that he has been cheating in exams. You are appearing for the same exam next week.",
        "You are in a bus. A passenger collapses suddenly. The driver says he cannot stop.",
        "You are on night duty. You find your senior is misusing government property.",
        "A classmate is being bullied by seniors in the hostel. He is too scared to complain.",
        "You find a wallet with cash and ID cards on the road. The owner's address is on the ID.",
        "During a river crossing exercise, a batch-mate panics in the middle of the river.",
        "You are leading a platoon and your radio stops working 3 km behind enemy lines.",
        "You discover that a supplier has been bribing an official to get a government contract.",
        "Your team is exhausted after a 20 km march. There is still 5 km left. Morale is very low.",
        "An elderly woman is being harassed on a crowded bus. Other passengers are ignoring it.",
        "You are giving a presentation to senior officers when you realise you have incorrect data.",
        // Premium situations
        "You are part of a rescue team. One of your colleagues refuses to proceed, citing danger.",
        "You discover your batch-mate has been leaking examination papers to others.",
        "A fire breaks out in the camp kitchen at midnight. Most personnel are asleep.",
        "You are in charge of supplies. You find 20% of rations are spoiled and troops are hungry.",
        "During a flood relief operation, locals are fighting over relief material.",
      ].map((s, i) => ({ id: 'srt_' + (i+1), label: 'Situation ' + (i+1), situation: s, free: i < 15 }));
    case 'gpe':
      return [
        {
          id: 'gpe_001',
          label: 'GPE 1',
          src: 'content/gpe/gpe_001.jpg',
          instructions: 'You are a group of 6 students from your school going on an educational excursion in a rural area. While travelling, you encounter multiple emergency situations shown in the map. The map scale is 1 cm = 1 km. Current time is 11:30 AM. Your group has one vehicle, ropes, first-aid material, and support from nearby villagers.\n\nSituation Details:\n1. A major flood has damaged the road bridge and disrupted movement across the river.\n2. A nearby road accident has seriously injured a civilian who must be shifted to the hospital immediately.\n3. Intelligence inputs reveal that terrorists are planning to attack an army convoy passing through the area at 1:00 PM.\n4. A school building near the flooded region has stranded civilians and children waiting for rescue.\n5. Railway communication is disturbed and an incoming train may cross the damaged rail bridge.\n6. One member of your group is the leader whose mother is critically ill at home, and he must reach home by 12:30 PM.\n\nAs a group, identify all problems, assign priorities, calculate time and distance using the given scale, divide manpower and resources effectively, coordinate with police/army/railway/local administration, rescue injured civilians, prevent further casualties, and ensure maximum tasks are completed practically within the available time.',
          free: true,
          timeSeconds: 600
        },
        {
          id: 'gpe_002',
          label: 'GPE 2',
          src: 'content/gpe/gpe_002.jpg',
          instructions: 'Instructions for this GPE will be added here. Study the image, identify all problems, prioritize them, divide resources, and write a practical group plan.',
          free: false,
          timeSeconds: 600
        },
        {
          id: 'gpe_003',
          label: 'GPE 3',
          src: 'content/gpe/gpe_003.jpg',
          instructions: 'Instructions for this GPE will be added here. Study the image, identify all problems, prioritize them, divide resources, and write a practical group plan.',
          free: false,
          timeSeconds: 600
        }
      ];
    default:
      return [];
  }
}

function filterContent(items, module) {
  if (Auth.isPremium()) {
    return items.map(item => ({ ...item, locked: false }));
  }

  return items.map(item => ({
    ...item,
    locked: item.free === false
  }));
}

window.ContentLoader = { loadContentIndex, getSampleContent, filterContent, MODULES, FREE_LIMIT };

