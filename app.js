import {
  Rating,
  store,
  save,
  grade,
  start,
  introduce,
  due,
  lapsed,
  isWordKey,
  isSentKey,
  today,
  xpToday,
  goalMet,
  streakDays,
  importBackup,
  eraseAll,
  exportBlob,
  setStorageFullHandler,
} from './js/store.js';
import * as C from './js/course.js';
import * as W from './js/writing.js';
import { startLesson, startPractice, lessonMode } from './js/lesson.js';

const $ = (id) => document.getElementById(id);
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

setStorageFullHandler(() =>
  toast('Storage is full — export a backup and erase old progress')
);

// ── the writing queue ─────────────────────────────────────────────────

// A session is split into small batches, each drilled on its own: its items
// cycle until every one has been answered cleanly enough to graduate, with
// missed ones coming back sooner. New characters form "learn" batches (first
// exposure is taught, then quizzed), due characters form "practice" batches,
// and whole words form "words" batches at the end. FSRS is graded once per
// item, at graduation.

const BATCH = 4;          // items per batch
const CLEAN_NEW = 2;      // clean passes to graduate a new item
const CLEAN_REVIEW = 1;   // clean passes to graduate a review item
const ATTEMPT_CAP = 5;    // give up (and grade Again) after this many tries

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function introduceChar(char) {
  introduce();
  if (store.settings.readCards) start(char, 'r');
}

function buildBatches() {
  const reviews = W.dueChars();
  const fresh = W.newChars();

  const practice = chunk(reviews, BATCH).map((items) => ({
    mode: 'practice',
    items,
  }));
  const learn = chunk(fresh, BATCH).map((items) => ({ mode: 'learn', items }));

  // Interleave: warm up on a practice batch, then meet a fresh batch, repeat.
  const batches = [];
  for (let i = 0; i < Math.max(practice.length, learn.length); i++) {
    if (i < practice.length) batches.push(practice[i]);
    if (i < learn.length) batches.push(learn[i]);
  }
  // Words come last: writing 你好 is the point of having written 你 and 好.
  for (const items of chunk(W.wordItems(), BATCH)) {
    batches.push({ mode: 'words', items });
  }
  return batches;
}

// ── screens ───────────────────────────────────────────────────────────

const screens = [
  'path', 'lesson', 'done', 'practice', 'deck', 'session', 'summary', 'settings',
];
function go(name) {
  for (const s of screens) $(s).hidden = s !== name;
  window.scrollTo(0, 0);
  if (name === 'path') paintPath();
  if (name === 'practice') paintPractice();
  if (name === 'deck') paintDeck();
  if (name === 'settings') paintSettings();
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('up');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('up'), 2600);
}

// ── the path ──────────────────────────────────────────────────────────

function paintPath() {
  const goal = store.settings.dailyGoal;
  const xp = xpToday();
  $('streak-n').textContent = streakDays();
  $('goal-ring').style.setProperty('--pct', `${Math.min(100, Math.round((xp / goal) * 100))}%`);
  $('goal-ring').classList.toggle('met', goalMet());
  $('goal-text').textContent = `${xp}/${goal}`;

  const current = C.currentUnit();
  $('path-note').textContent = C.course.spine.verified
    ? ''
    : 'Word lists are still unverified against the printed textbook.';
  $('path-note').hidden = C.course.spine.verified;

  $('sections').innerHTML = C.course.sections
    .map((sec) => {
      const nodes = sec.units
        .map((id) => C.unit(id))
        .map((u) => {
          if (!u.ready) {
            return `<li class="node pending"><span class="node-title">${esc(u.title)}</span>
              <span class="node-sub">${esc(u.textbook)} · not written yet</span></li>`;
          }
          const done = Math.min(u.levels, store.course.progress[u.id]?.done ?? 0);
          const open = C.unlocked(u);
          const cls = [
            'node',
            open ? 'open' : 'locked',
            done >= u.levels ? 'full' : '',
            u.id === current?.id ? 'now' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const dots = Array.from(
            { length: u.levels },
            (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`
          ).join('');
          return `<li class="${cls}" data-unit="${u.id}">
            <span class="node-title">${esc(u.title)}</span>
            <span class="node-sub">${esc(u.titleEn)} · ${esc(u.textbook)}</span>
            <span class="node-topic">${esc(u.topic)}</span>
            <span class="dots">${dots}</span>
          </li>`;
        })
        .join('');
      return `<section class="section">
        <h2>${esc(sec.title)}</h2>
        <ol class="nodes">${nodes}</ol>
      </section>`;
    })
    .join('');

  $('sections').querySelectorAll('[data-unit]').forEach((el) => {
    el.onclick = () => {
      const u = C.unit(el.dataset.unit);
      if (!C.unlocked(u)) return toast('Finish the unit before this one first');
      openLesson(u);
    };
  });
}

function openLesson(u) {
  go('lesson');
  startLesson(u, C.nextLevel(u), {
    onExit: (how) => go(how === 'done' ? 'done' : 'path'),
  });
}

function paintSettings() {
  $('set-new').value = store.settings.newPerDay;
  $('set-read').checked = store.settings.readCards;
  $('set-goal').value = store.settings.dailyGoal;
}

// ── the practice hub ──────────────────────────────────────────────────

// Three lanes over one scheduler. Mistakes is what you got wrong and have not
// yet put right; Words is everything the scheduler says is closest to being
// forgotten; Writing is the handwriting queue on its own screen.
function lanes() {
  const wordItems = [...due(['r'], isWordKey), ...due(['b'], isSentKey)];
  const missed = lapsed((k) => isWordKey(k) || isSentKey(k));
  const chars = W.dueChars().length;
  const words = W.wordItems().length;
  const fresh = W.newChars().length;

  return [
    {
      id: 'mistakes',
      title: 'Mistakes',
      n: missed.length,
      line: missed.length
        ? `${missed.length} to put right`
        : 'Nothing outstanding',
      run: () => runPractice('Mistakes', missed),
    },
    {
      id: 'words',
      title: 'Words and sentences',
      n: wordItems.length,
      line: wordItems.length
        ? `${wordItems.length} due`
        : 'Nothing due — play a lesson to add more',
      run: () => runPractice('Words and sentences', wordItems),
    },
    {
      id: 'writing',
      title: 'Writing',
      n: chars + words + fresh,
      line:
        [
          chars ? `${chars} to review` : '',
          fresh ? `${fresh} new` : '',
          words ? `${words} whole ${words === 1 ? 'word' : 'words'}` : '',
        ]
          .filter(Boolean)
          .join(', ') ||
        (W.trackProgress().unlocked
          ? 'Nothing due'
          : 'Unlocks when you play a lesson'),
      run: () => go('deck'),
    },
  ];
}

function paintPractice() {
  const list = lanes();
  $('lanes').innerHTML = list
    .map(
      (l) => `<li class="lane${l.n ? '' : ' empty'}" data-lane="${l.id}">
        <span class="lane-title">${esc(l.title)}</span>
        <span class="lane-line">${esc(l.line)}</span>
        <b class="lane-n">${l.n || ''}</b>
      </li>`
    )
    .join('');
  $('lanes').querySelectorAll('[data-lane]').forEach((el) => {
    const lane = list.find((l) => l.id === el.dataset.lane);
    el.onclick = () => (lane.n ? lane.run() : toast('Nothing due in that lane'));
  });
}

function runPractice(label, items) {
  go('lesson');
  startPractice(label, items, {
    onExit: (how) => go(how === 'done' ? 'done' : 'practice'),
  });
}

// ── the writing screen ────────────────────────────────────────────────

function paintDeck() {
  const reviews = W.dueChars();
  const fresh = W.newChars();
  const words = W.wordItems();
  const track = W.trackProgress();

  $('queue-glyphs').innerHTML =
    [...new Set(reviews.map((r) => r.id))]
      .slice(0, 24)
      .map((c) => `<span>${esc(c)}</span>`)
      .join('') +
    fresh
      .slice(0, 12)
      .map((i) => `<span class="fresh">${esc(i.id)}</span>`)
      .join('') +
    words
      .slice(0, 6)
      .map((i) => `<span class="whole">${esc(C.word(i.id).word)}</span>`)
      .join('');

  const bits = [];
  if (reviews.length) bits.push(`${reviews.length} to review`);
  if (fresh.length) bits.push(`${fresh.length} new`);
  if (words.length) bits.push(`${words.length} whole ${words.length === 1 ? 'word' : 'words'}`);
  $('queue-line').textContent = bits.length
    ? bits.join(', ')
    : track.unlocked
      ? 'Nothing is due. Come back tomorrow, or raise the new-per-day limit.'
      : 'Writing opens up a unit at a time — play a lesson on the path first.';
  $('start').disabled = !bits.length;

  $('progress-line').textContent = `${track.started} of ${track.unlocked} unlocked characters started`;

  const units = W.unlockedUnits();
  $('units').innerHTML = units
    .map((u) => {
      const done = u.writing.filter(W.started).length;
      const pct = Math.round((done / u.writing.length) * 100);
      const cls = pct === 100 ? 'full' : pct > 0 ? 'part' : '';
      return `<li class="${cls}" style="--fill:${pct}%" title="${esc(u.textbook)}: ${done} of ${u.writing.length}"></li>`;
    })
    .join('');

  const notes = [];
  if (track.locked) notes.push(`${track.locked} more behind later lessons`);
  const legacy = W.legacyStarted();
  if (legacy) notes.push(`${legacy} from the old HSK deck still in review`);
  $('progress-note').textContent = notes.join(' · ');
}

// ── the writing session runner ────────────────────────────────────────

let batches = [];      // [{ mode, items:[{id, kind, isNew, type, at, rail}] }]
let batchAt = 0;       // index of the batch being drilled
let drill = [];        // working queue of drill-states for the current batch
let allItems = [];     // every item across the session, for the progress rail
let current = null;    // the item currently on screen (an allItems entry)
let stats = null;
let writer = null;

// What is written on the card: a character, or the word a word card spells.
const glyphOf = (it) => (it.type === 'word' ? C.word(it.id).word : it.id);

// Every character a set of items will ask for, word cards included.
const charsOf = (items) => [
  ...new Set(items.flatMap((it) => (it.type === 'word' ? C.word(it.id).chars : [it.id]))),
];

async function startSession() {
  batches = buildBatches();
  if (!batches.length) return;

  allItems = [];
  let at = 0;
  for (const b of batches) {
    for (const it of b.items) {
      it.at = at++;
      it.rail = 'pending';
      allItems.push(it);
    }
  }
  stats = { reps: 0, missed: new Set() };

  await W.loadStrokes(charsOf(allItems));
  go('session');
  batchAt = 0;
  startBatch();
}

function startBatch() {
  const batch = batches[batchAt];
  drill = batch.items.map((it) => ({
    ...it,
    cleanNeed: it.isNew ? CLEAN_NEW : CLEAN_REVIEW,
    cleanDone: 0,
    attempts: 0,
    everMissed: false,
    fast: false,
  }));
  // Practice batches are shuffled; learn batches keep track order so the first
  // pass meets characters in the sequence they were designed to build on.
  if (batch.mode === 'practice') shuffle(drill);

  const label =
    batch.mode === 'learn' ? 'Learn' : batch.mode === 'words' ? 'Whole words' : 'Practice';
  $('batch-tag').textContent = `${label} · group ${batchAt + 1} of ${batches.length}`;
  paintRail();
  nextInBatch();
}

function nextInBatch() {
  if (!drill.length) {
    batchAt += 1;
    if (batchAt >= batches.length) return finish();
    return startBatch();
  }
  showCard(drill[0]);
}

// Called when a single card attempt resolves. Updates the character's drill
// state, decides whether it has graduated from the batch, and grades FSRS once
// at graduation. Missed characters loop back sooner; not-yet-mastered ones go
// to the back of the batch.
function resolveItem(state, clean, fast) {
  stats.reps += 1;
  state.attempts += 1;
  if (clean) {
    if (state.cleanDone === 0) state.fast = fast;
    state.cleanDone += 1;
  } else {
    state.everMissed = true;
    stats.missed.add(glyphOf(state));
  }

  drill.shift();

  const graduated = state.cleanDone >= state.cleanNeed || state.attempts >= ATTEMPT_CAP;
  if (graduated) {
    gradeDrill(state);
    allItems[state.at].rail = state.everMissed ? 'miss' : 'done';
    paintRail();
  } else {
    const pos = clean ? drill.length : Math.min(2, drill.length);
    drill.splice(pos, 0, state);
  }
  nextInBatch();
}

function gradeDrill(state) {
  if (state.isNew) {
    // First exposure is always a fresh schedule. Only characters count against
    // the new-per-day budget: a word card is a new arrangement of shapes you
    // have already learned, not a new shape.
    if (state.type !== 'word') introduceChar(state.id);
    grade(state.id, 'w', Rating.Good);
    return;
  }
  let rating;
  if (state.cleanDone < state.cleanNeed) rating = Rating.Again; // hit the cap unmastered
  else if (state.everMissed) rating = Rating.Hard;
  else rating = state.fast ? Rating.Easy : Rating.Good;
  grade(state.id, state.kind, rating);
}

function paintRail() {
  $('rail').innerHTML = allItems
    .map((it) => {
      const cls =
        it === current ? 'now' : it.rail === 'done' ? 'done' : it.rail === 'miss' ? 'miss' : '';
      return `<span class="${cls}"></span>`;
    })
    .join('');
}

function finish() {
  const clean = allItems.filter((i) => i.rail === 'done').length;
  const shaky = [...new Set(allItems.filter((i) => i.rail === 'miss').map(glyphOf))];
  $('summary-line').textContent =
    `${allItems.length} cards · ${clean} clean · ${stats.reps} writes`;
  $('summary-shaky').innerHTML = shaky.length
    ? shaky.map((c) => `<span>${c}</span>`).join('')
    : '';
  $('summary-note').textContent = shaky.length
    ? 'These come back sooner.'
    : 'Nothing needed a second pass.';
  go('summary');
}

function showCard(state) {
  current = allItems[state.at];
  paintRail();
  $('seal').className = 'seal';
  $('target').className = 'target';
  $('target').innerHTML = '';
  $('target').onclick = null;
  $('choices').hidden = true;
  $('mizige').hidden = false;

  if (state.type === 'word') return showWordCard(state, C.word(state.id));

  const card = W.card(state.id);
  if (state.kind === 'r') return showReadCard(state, card);
  // A brand-new character is taught before it is drilled: meet it, see the
  // components it is built from, recognise it among others — then write it. A
  // building block skips the recognise step; there is nothing to recognise it
  // among, because it is never a word on its own.
  if (state.isNew && state.attempts === 0) {
    return card.block ? showBlockIntro(state, card) : showIntro(state, card);
  }
  return showWriteCard(state, card);
}

// -- teaching a new character ---------------------------------------

// Distinct characters to sit beside the target in the recognise step. Drawn
// from the same batch first (its nearest neighbours in the course), then from
// the characters either side of it in the writing track.
function distractorsFor(char, n) {
  const pool = shuffle(charsOf(batches[batchAt]?.items ?? []));
  const track = W.track();
  const idx = track.indexOf(char);
  for (let r = 1; idx >= 0 && pool.length < 40 && r < track.length; r++) {
    if (track[idx - r]) pool.push(track[idx - r]);
    if (track[idx + r]) pool.push(track[idx + r]);
  }
  const uniq = [...new Set([...pool, ...shuffle([...track])])].filter((c) => c !== char);
  return uniq.slice(0, n);
}

function showIntro(state, card) {
  current = allItems[state.at];
  paintRail();
  $('seal').className = 'seal';
  $('choices').hidden = true;
  $('mizige').hidden = false;

  const showGlyph = () => {
    $('target').className = 'target glyph';
    $('target').onclick = null;
    $('target').textContent = card.char;
  };

  // 1 ── Meet it: character, meaning and sound together, no task.
  const meet = () => {
    $('prompt-meaning').textContent = card.meaning;
    $('prompt-pinyin').textContent = card.pinyin;
    $('prompt-pinyin').className = 'prompt-pinyin';
    showGlyph();
    $('card-meta').innerHTML = '<span class="intro-tag">New character</span>';
    setActions([{ label: 'Continue', solid: true, onTap: build }]);
  };

  // 2 ── Build it: reveal the components one at a time, then the mnemonic.
  const parts = card.parts.filter((p) => p.gloss && p.char !== card.char);
  const build = () => {
    if (!parts.length) return recognize();
    showGlyph();
    let shown = 0;
    const step = () => {
      shown += 1;
      const rows = parts
        .slice(0, shown)
        .map(
          (p) =>
            `<span class="part-row"><b>${p.char}</b>${p.gloss}` +
            `${p.known ? ' <em>· you know this</em>' : ''}</span>`
        )
        .join('');
      $('card-meta').innerHTML = '<span class="intro-lead">Built from</span>' + rows;
      if (shown >= parts.length) {
        if (card.hint) {
          $('card-meta').insertAdjacentHTML('beforeend', `<span class="hint">${card.hint}</span>`);
        }
        setActions([{ label: 'Continue', solid: true, onTap: recognize }]);
      } else {
        setActions([{ label: 'Next part', solid: true, onTap: step }]);
      }
    };
    step();
  };

  // 3 ── Recognise it: pick the character, cued by meaning and sound.
  const recognize = () => {
    $('prompt-meaning').textContent = card.meaning;
    $('prompt-pinyin').textContent = card.pinyin;
    $('prompt-pinyin').className = 'prompt-pinyin';
    $('card-meta').innerHTML = '<span class="intro-lead">Which one is this?</span>';
    $('mizige').hidden = true;
    const choices = $('choices');
    choices.hidden = false;

    const options = shuffle([card.char, ...distractorsFor(card.char, 3)]);
    choices.innerHTML = options.map((c) => `<button>${c}</button>`).join('');
    setActions([]);
    [...choices.children].forEach((btn, i) => {
      btn.onclick = () => {
        if (options[i] === card.char) {
          btn.className = 'right';
          setTimeout(done, 280);
        } else {
          btn.className = 'wrong';
          btn.disabled = true;
        }
      };
    });
  };

  const done = () => {
    const choices = $('choices');
    choices.hidden = true;
    choices.innerHTML = '';
    $('mizige').hidden = false;
    showWriteCard(state, card);
  };

  meet();
}

// -- teaching a building block --------------------------------------

// The characters further along the writing track that a block is a piece of.
function charsInside(block) {
  return W.track()
    .filter(
      (ch) => ch !== block && (W.card(ch)?.parts ?? []).some((p) => p.char === block)
    )
    .slice(0, 6);
}

// A building block is a piece of other characters and nothing else — 讠, 冂,
// 耂. There is no word to learn and nothing to recognise it among, so the card
// is the short one: meet it, see what it turns up inside, trace it.
function showBlockIntro(state, card) {
  current = allItems[state.at];
  paintRail();
  $('seal').className = 'seal';
  $('choices').hidden = true;
  $('mizige').hidden = false;
  $('target').className = 'target glyph';
  $('target').onclick = null;
  $('target').textContent = card.char;

  $('prompt-meaning').textContent = card.meaning ?? '';
  $('prompt-pinyin').textContent = card.pinyin ?? '';
  $('prompt-pinyin').className = 'prompt-pinyin';

  const inside = charsInside(card.char);
  $('card-meta').innerHTML =
    '<span class="intro-tag">Building block</span>' +
    (card.hint ? `<span class="hint">${esc(card.hint)}</span>` : '') +
    (inside.length
      ? '<span class="intro-lead">You will meet it inside</span>' +
        `<span class="parts">${inside.join(' ')}</span>`
      : '');

  setActions([
    { label: 'Trace it', solid: true, onTap: () => showWriteCard(state, card) },
  ]);
}

// -- writing --------------------------------------------------------

function makeWriter(char) {
  const size = $('mizige').clientWidth;
  return HanziWriter.create($('target'), char, {
    width: size,
    height: size,
    padding: Math.round(size * 0.06),
    charDataLoader: (ch, onLoad) => onLoad(W.strokeData(ch)),
    showCharacter: false,
    showOutline: false,
    strokeColor: cssVar('--ink'),
    outlineColor: cssVar('--ink-faint'),
    drawingColor: cssVar('--ink'),
    drawingWidth: 8,
    highlightColor: cssVar('--seal'),
    strokeAnimationSpeed: 1.1,
    delayBetweenStrokes: 130,
  });
}

function showWriteCard(state, card) {
  // The first time a new character appears it is scaffolded — animated in full,
  // with its components shown and hints on. Later passes drop the scaffolding so
  // the same batch shifts from learning to practising the character.
  const scaffold = state.isNew && state.attempts === 0;
  // Reset the stage — the intro flow may have left a glyph, choices, or seal here.
  $('target').className = 'target';
  $('target').innerHTML = '';
  $('target').onclick = null;
  $('choices').hidden = true;
  $('mizige').hidden = false;
  $('seal').className = 'seal';
  $('prompt-meaning').textContent = card.meaning;
  $('prompt-pinyin').textContent = card.pinyin;
  $('prompt-pinyin').className = 'prompt-pinyin';
  $('card-meta').innerHTML = scaffold ? metaHtml(card) : '';

  writer = makeWriter(card.char);

  let mistakes = 0;
  let hinted = false;
  let revealed = false;
  let strokeNum = 0;
  const began = Date.now();

  const runQuiz = () =>
    writer.quiz({
      leniency: 1.05,
      showHintAfterMisses: scaffold ? 1 : false,
      onMistake: (d) => {
        mistakes += 1;
        strokeNum = d.strokeNum;
      },
      onCorrectStroke: (d) => {
        strokeNum = d.strokeNum + 1;
      },
      onComplete: () => {
        const secs = (Date.now() - began) / 1000;
        const missed = revealed || mistakes >= 3 || hinted;
        const fast = !missed && mistakes === 0 && secs < card.strokes * 1.1;
        settle(!missed, fast);
      },
    });

  const settle = (clean, fast) => {
    writer.showCharacter();
    if (clean) $('seal').className = 'seal press';
    setActions([
      {
        label: 'Next',
        solid: true,
        onTap: () => resolveItem(state, clean, fast),
      },
    ]);
  };

  setActions([
    {
      label: 'Show a stroke',
      onTap: () => {
        hinted = true;
        writer.highlightStroke(strokeNum);
      },
    },
    {
      label: 'Show me',
      onTap: () => {
        revealed = true;
        writer.cancelQuiz();
        writer.animateCharacter({
          onComplete: () => settle(false, false),
        });
      },
    },
  ]);

  if (scaffold) {
    writer.animateCharacter({ onComplete: runQuiz });
  } else {
    runQuiz();
  }
}

// -- writing a whole word -------------------------------------------

// Two or three characters in sequence, in the one grid, with no outline and no
// scaffolding. It is the last thing a unit's writing track asks for: by now
// every character in the word has a card of its own, so what is being tested
// is the word — which character comes first, and getting through both without
// losing the shape of either.
function showWordCard(state, word) {
  const seq = word.chars;
  $('prompt-meaning').textContent = word.meaning;
  $('prompt-pinyin').textContent = word.pinyin;
  $('prompt-pinyin').className = 'prompt-pinyin';
  $('choices').hidden = true;
  $('mizige').hidden = false;
  $('seal').className = 'seal';

  const strokeTotal = seq.reduce((n, ch) => n + (W.card(ch)?.strokes ?? 0), 0);
  let at = 0;
  let mistakes = 0;
  let hinted = false;
  let revealed = false;
  const began = Date.now();

  const paintSeq = () => {
    $('card-meta').innerHTML =
      `<span class="word-seq">${seq
        .map(
          (ch, i) =>
            `<b class="${i < at ? 'written' : i === at ? 'now' : ''}">${esc(ch)}</b>`
        )
        .join('')}</span>`;
  };

  const settle = (clean, fast) => {
    paintSeq();
    writer.showCharacter();
    if (clean) $('seal').className = 'seal press';
    setActions([
      { label: 'Next', solid: true, onTap: () => resolveItem(state, clean, fast) },
    ]);
  };

  const advance = () => {
    at += 1;
    if (at < seq.length) return step();
    const secs = (Date.now() - began) / 1000;
    const missed = revealed || hinted || mistakes >= 3;
    settle(!missed, !missed && mistakes === 0 && secs < strokeTotal * 1.1);
  };

  const step = () => {
    paintSeq();
    $('target').className = 'target';
    $('target').innerHTML = '';
    $('target').onclick = null;
    writer = makeWriter(seq[at]);

    let strokeNum = 0;
    writer.quiz({
      leniency: 1.05,
      showHintAfterMisses: false,
      onMistake: (d) => {
        mistakes += 1;
        strokeNum = d.strokeNum;
      },
      onCorrectStroke: (d) => {
        strokeNum = d.strokeNum + 1;
      },
      onComplete: advance,
    });

    setActions([
      {
        label: 'Show a stroke',
        onTap: () => {
          hinted = true;
          writer.highlightStroke(strokeNum);
        },
      },
      {
        label: 'Show me',
        onTap: () => {
          revealed = true;
          writer.cancelQuiz();
          writer.animateCharacter({ onComplete: advance });
        },
      },
    ]);
  };

  step();
}

function metaHtml(card) {
  const parts = card.parts.filter((p) => p.gloss);
  return [
    parts.length
      ? `<span class="parts">${parts.map((p) => p.char).join(' ')}</span> — ${parts
          .map((p) => p.gloss)
          .join(', ')}`
      : '',
    card.hint ? `<span class="hint">${card.hint}</span>` : '',
    examplesHtml(card),
  ]
    .filter(Boolean)
    .join(' ');
}

function examplesHtml(card) {
  const list = card.examples || [];
  return list
    .map(
      (e) =>
        `<span class="example"><b>${e.word}</b> ${e.pinyin} · ${e.meaning}</span>`
    )
    .join('');
}

// -- reading --------------------------------------------------------

function showReadCard(state, card) {
  $('prompt-meaning').textContent = 'What does this say?';
  $('prompt-pinyin').textContent = card.pinyin;
  $('prompt-pinyin').className = 'prompt-pinyin veiled';
  $('card-meta').innerHTML = '';
  $('target').className = 'target glyph';
  $('target').textContent = card.char;

  const reveal = () => {
    $('prompt-meaning').textContent = card.meaning;
    $('prompt-pinyin').className = 'prompt-pinyin';
    $('card-meta').innerHTML = examplesHtml(card);
    setActions([
      { label: 'Missed it', onTap: () => resolveItem(state, false, false) },
      { label: 'Got it', onTap: () => resolveItem(state, true, false) },
      { label: 'Easy', onTap: () => resolveItem(state, true, true) },
    ]);
  };

  setActions([{ label: 'Reveal', solid: true, onTap: reveal }]);
  $('target').onclick = reveal;
}

function setActions(list) {
  const bar = $('actions');
  bar.innerHTML = '';
  for (const a of list) {
    const b = document.createElement('button');
    b.textContent = a.label;
    if (a.solid) b.className = 'solid';
    b.onclick = a.onTap;
    bar.append(b);
  }
}

// ── settings actions ──────────────────────────────────────────────────

$('set-new').addEventListener('change', (e) => {
  store.settings.newPerDay = Math.max(0, Math.min(40, Number(e.target.value) || 0));
  e.target.value = store.settings.newPerDay;
  save();
});

$('set-read').addEventListener('change', (e) => {
  store.settings.readCards = e.target.checked;
  save();
});

$('set-goal').addEventListener('change', (e) => {
  store.settings.dailyGoal = Math.max(10, Math.min(200, Number(e.target.value) || 10));
  e.target.value = store.settings.dailyGoal;
  save();
});

$('export').addEventListener('click', () => {
  const blob = new Blob([exportBlob()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hanzi-practice-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    importBackup(JSON.parse(await file.text()));
    toast('Progress restored');
    paintSettings();
  } catch {
    toast("That file isn't a Hanzi Practice backup");
  }
  e.target.value = '';
});

$('reset').addEventListener('click', () => {
  if (!confirm('Erase every card and start from the first lesson? This cannot be undone.')) return;
  eraseAll();
  toast('Progress erased');
  go('path');
});

document.querySelectorAll('[data-go]').forEach((el) => {
  el.addEventListener('click', () => go(el.dataset.go));
});
$('start').addEventListener('click', startSession);
$('lesson-quit').addEventListener('click', () => go('path'));
$('done-again').addEventListener('click', () => {
  if (lessonMode() === 'practice') return go('practice');
  const u = C.currentUnit();
  if (u) openLesson(u);
});

// ── boot ──────────────────────────────────────────────────────────────

(async () => {
  await Promise.all([W.loadDeck(), C.loadCourse()]);
  go('path');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
