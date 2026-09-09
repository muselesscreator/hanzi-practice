import {
  Rating,
  grade,
  start,
  addXp,
  completeLevel,
  countExposure,
  keyOf,
} from './store.js';
import { buildLesson, buildPractice, checkBank } from './exercises.js';
import * as audio from './audio.js';

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// A lesson is a queue of exercises. Every exercise has to be answered
// correctly once before the lesson ends; a missed one goes to the back of the
// queue and comes round again. FSRS is graded once per item, at the end,
// from how many times it was missed along the way.
let queue = [];
let plan = [];
let misses = new Map(); // exercise -> how many times it was answered wrong
let unit = null;
let level = 1;
let mode = 'lesson'; // 'lesson' advances the path; 'practice' just reviews
let hard = false; // a replay of a finished unit: no hints, more to choose between
let title = '';
let onLeave = () => {};
let stats = null;
let current = null;
let answered = false;

// Which exercises offer a hint, and what the hint does. Revealing the answer
// is never on offer: where the prompt already shows everything but the answer,
// the hint takes a wrong tile away instead. A hint is priced in ratingFor --
// the writing track already grades a hinted card down, and the reading track
// had no way to say "I do not know" short of a blind tap.
const HINTS = {
  selectMeaning: 'reveal',
  bankZh: 'reveal',
  selectHanzi: 'narrow',
  cloze: 'narrow',
  listenWord: 'reveal',
  listenSent: 'reveal',
  tone: 'reveal',
};

const XP_LESSON = 10;
const XP_CLEAN = 5;
const XP_HARD = 5;
const XP_PRACTICE_ITEM = 1;

// `hard` replays a finished unit: the path does not move, the hint button is
// gone, and the exercises lean on production with more to choose between.
export function startLesson(u, lv, { onExit, hard: isHard = false }) {
  unit = u;
  level = lv;
  mode = 'lesson';
  hard = isHard;
  title = hard ? `${u.textbook} · hard replay` : `${u.textbook} · level ${lv} of ${u.levels}`;
  begin(buildLesson(u, lv, { hard }), onExit);
}

// A practice set is the same runner over a queue FSRS picked, so a missed item
// still comes round again before the set can end. It earns XP but moves
// nothing along the path.
export function startPractice(label, items, { onExit }) {
  unit = null;
  level = 0;
  mode = 'practice';
  hard = false;
  title = label;
  begin(buildPractice(items), onExit);
}

function begin(items, onExit) {
  onLeave = onExit;
  plan = items;
  queue = plan.map((ex) => ({ ex }));
  misses = new Map(plan.map((ex) => [ex, 0]));
  stats = { began: Date.now(), answers: 0, wrong: 0, done: 0 };
  paint();
  next();
}

function paint() {
  const pct = Math.round((stats.done / plan.length) * 100);
  $('lesson-bar').style.width = `${pct}%`;
  $('lesson-tag').textContent = title;
}

function next() {
  if (!queue.length) return finish();
  current = queue[0];
  answered = false;
  hideFeedback();
  render(current.ex);
  paint();
}

// Called by every exercise when the learner commits an answer.
function resolve(correct, shown) {
  if (answered) return;
  answered = true;
  stats.answers += 1;
  const item = queue.shift();
  if (correct) {
    stats.done += 1;
  } else {
    stats.wrong += 1;
    misses.set(item.ex, (misses.get(item.ex) ?? 0) + 1);
    queue.push(item);
  }
  paint();
  showFeedback(correct, shown);
}

function hideFeedback() {
  const f = $('feedback');
  f.hidden = true;
  f.className = 'feedback';
  f.innerHTML = '';
  const go = $('lesson-go');
  go.hidden = true;
  go.className = 'press';
  go.onclick = null;
  const hint = $('lesson-hint');
  hint.hidden = true;
  hint.onclick = null;
}

function showFeedback(correct, shown) {
  $('lesson-hint').hidden = true;
  const f = $('feedback');
  f.hidden = false;
  f.className = `feedback ${correct ? 'right' : 'wrong'}`;
  f.innerHTML = correct
    ? `<b>Correct</b>${shown ? `<span>${shown}</span>` : ''}`
    : `<b>Not quite</b>${shown ? `<span>${shown}</span>` : ''}`;
  const go = $('lesson-go');
  go.hidden = false;
  go.className = `press ${correct ? '' : 'again'}`;
  go.textContent = queue.length ? 'Continue' : 'Finish';
  go.onclick = next;
}

// -- rendering ----------------------------------------------------------

function ask(text) {
  return `<p class="ask">${esc(text)}</p>`;
}

function render(ex) {
  const box = $('ex');
  box.className = `ex ex-${ex.type}`;
  const draw = {
    meet: renderMeet,
    selectHanzi: renderSelectHanzi,
    selectMeaning: renderSelectMeaning,
    match: renderMatch,
    bankZh: renderBank,
    bankEn: renderBank,
    listenSent: renderBank,
    cloze: renderCloze,
    listenWord: renderListenWord,
    tone: renderTone,
  }[ex.type];
  draw(ex, box);
  armHint(ex, box);
  // Every exercise that is about a sound plays it as it comes up. This runs
  // inside the tap that advanced the lesson, which is what iOS requires.
  if (ex.audio) audio.speak(ex.say);
}

// An audio exercise's hint is its pinyin, and it stays on offer in a hard
// replay: it is the way through when the voice has died, not a leg up.
function armHint(ex, box) {
  const kind = HINTS[ex.type];
  const btn = $('lesson-hint');
  if (!kind || (hard && !ex.audio)) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  btn.disabled = false;
  btn.textContent = ex.audio ? 'Show pinyin' : 'Hint';
  btn.onclick = () => {
    if (answered) return;
    ex.hinted = true;
    btn.disabled = true;
    if (kind === 'reveal') revealHint(ex, box);
    else narrowHint(ex, box);
  };
}

// Show the sound of what is on screen. Never the meaning, which is the answer.
// An audio exercise names what to show: its pinyin, or for a tone question
// the pinyin with the tone marks off.
function revealHint(ex, box) {
  const cue = box.querySelector('.cue');
  if (!cue || cue.querySelector('.cue-pinyin')) return;
  const pinyin = ex.fallback ?? (ex.type === 'bankZh' ? ex.sentence.pinyin : ex.word.pinyin);
  if (pinyin) cue.insertAdjacentHTML('beforeend', `<p class="cue-pinyin">${esc(pinyin)}</p>`);
}

// The replay button: the one control every audio exercise must have, because
// an utterance can be cut off by anything from a notification to the screen
// dimming. Wherever a voice is on hand, a word's sound is one tap away.
function playButton(text, cls = '') {
  return `<button class="play ${cls}" data-say="${esc(text)}" aria-label="Play again">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="wave" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>
  </button>`;
}

function armPlay(box) {
  box.querySelectorAll('[data-say]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      audio.speak(btn.dataset.say);
    };
  });
}

// Take one wrong tile out of play, so an honest "I am not sure" beats a guess.
function narrowHint(ex, box) {
  const wrap = box.querySelector('.tiles');
  if (!wrap) return;
  const right = (o) => (ex.type === 'cloze' ? o === ex.answer : o.id === ex.answer);
  const spare = ex.options
    .map((o, i) => (right(o) || wrap.children[i].disabled ? -1 : i))
    .filter((i) => i >= 0);
  if (spare.length < 2) return;
  const btn = wrap.children[spare[Math.floor(Math.random() * spare.length)]];
  btn.disabled = true;
  btn.classList.add('ruled');
}

function renderMeet(ex, box) {
  const w = ex.word;
  const parts = ex.chars
    .map(
      (c) =>
        `<span class="char-part"><b>${esc(c.char)}</b>${
          c.parts.length
            ? `<em>${esc(c.parts.map((p) => p.char).join(' + '))}</em>`
            : ''
        }</span>`
    )
    .join('');
  const hear = audio.available();
  box.innerHTML =
    ask('A new word') +
    `<div class="meet">
       <p class="meet-word">${esc(w.word)}</p>
       <p class="meet-pinyin">${esc(w.pinyin)}${hear ? playButton(w.word, 'inline') : ''}</p>
       <p class="meet-meaning">${esc(w.meaning)}</p>
       ${parts ? `<div class="meet-parts">${parts}</div>` : ''}
     </div>`;
  armPlay(box);
  if (hear) audio.speak(w.word);
  const go = $('lesson-go');
  go.hidden = false;
  go.className = 'press';
  go.textContent = 'Got it';
  go.onclick = () => {
    go.hidden = true;
    go.onclick = null;
    start(w.id, 'r');
    if (ex.check) askMeetCheck(ex, box);
    else resolve(true, '');
  };
}

// The introduction ends in one tap: the word, its sound, and its meaning among
// two. The meaning comes off the screen first, or there is nothing to check.
// It is deliberately trivial -- it does not count as a retrieval, and it
// starts the FSRS card rather than grading it. See
// docs/duolingo-teaching-pattern.md section 5.4.
function askMeetCheck(ex, box) {
  const w = ex.word;
  box.className = 'ex ex-meetCheck';
  box.innerHTML =
    ask('Which one is it?') +
    `<div class="cue"><p class="cue-hanzi">${esc(w.word)}</p>
     <p class="cue-pinyin">${esc(w.pinyin)}</p></div>`;
  tiles(box, ex.check, (x) => esc(x.meaning), (x, btn, wrap) => {
    const ok = x.id === ex.answer;
    btn.className = ok ? 'right' : 'wrong';
    if (!ok) markCorrect(wrap, ex.check, (y) => y.id === ex.answer);
    resolve(ok, `${w.word} ${w.pinyin} — ${w.meaning}`);
  });
}

function tiles(box, options, label, onPick) {
  box.insertAdjacentHTML(
    'beforeend',
    `<div class="tiles">${options
      .map((o, i) => `<button data-i="${i}">${label(o)}</button>`)
      .join('')}</div>`
  );
  const wrap = box.querySelector('.tiles');
  [...wrap.children].forEach((btn, i) => {
    btn.onclick = () => {
      if (answered) return;
      onPick(options[i], btn, wrap);
    };
  });
}

function renderSelectHanzi(ex, box) {
  const hear = audio.available();
  box.innerHTML =
    ask('Which one is this?') +
    `<div class="cue"><p class="cue-pinyin">${esc(ex.prompt)}${
      hear ? playButton(ex.word.word, 'inline') : ''
    }</p>
     <p class="cue-hint">${esc(ex.hint)}</p></div>`;
  armPlay(box);
  tiles(box, ex.options, (w) => esc(w.word), (w, btn, wrap) => {
    const ok = w.id === ex.answer;
    btn.className = ok ? 'right' : 'wrong';
    if (!ok) markCorrect(wrap, ex.options, (x) => x.id === ex.answer);
    resolve(ok, `${ex.word.word} — ${ex.word.pinyin} — ${ex.word.meaning}`);
  });
}

function renderSelectMeaning(ex, box) {
  box.innerHTML =
    ask('What does this mean?') +
    `<div class="cue"><p class="cue-hanzi">${esc(ex.prompt)}</p></div>`;
  tiles(box, ex.options, (w) => esc(w.meaning), (w, btn, wrap) => {
    const ok = w.id === ex.answer;
    btn.className = ok ? 'right' : 'wrong';
    if (!ok) markCorrect(wrap, ex.options, (x) => x.id === ex.answer);
    resolve(ok, `${ex.word.word} ${ex.word.pinyin} — ${ex.word.meaning}`);
  });
}

// Hear it, pick it. The cue is nothing but the replay button until the learner
// asks for the pinyin.
function renderListenWord(ex, box) {
  box.innerHTML =
    ask('What did you hear?') + `<div class="cue cue-audio">${playButton(ex.say, 'big')}</div>`;
  armPlay(box);
  tiles(box, ex.options, (w) => esc(w.word), (w, btn, wrap) => {
    const ok = w.id === ex.answer;
    btn.className = ok ? 'right' : 'wrong';
    if (!ok) markCorrect(wrap, ex.options, (x) => x.id === ex.answer);
    resolve(ok, `${ex.word.word} ${ex.word.pinyin} — ${ex.word.meaning}`);
  });
}

// Hear the word, name the tone of the marked syllable. The word is on screen
// so the learner knows which syllable is asked about; its pinyin is not.
function renderTone(ex, box) {
  const chars = [...ex.word.word]
    .map((ch, i) => (i === ex.at ? `<b class="tone-at">${esc(ch)}</b>` : esc(ch)))
    .join('');
  box.innerHTML =
    ask(ex.word.tones.length > 1 ? 'Which tone is the marked syllable?' : 'Which tone?') +
    `<div class="cue cue-audio"><p class="cue-hanzi">${chars}</p>${playButton(ex.say, 'big')}</div>`;
  armPlay(box);
  tiles(box, ex.options, (o) => esc(o.label), (o, btn, wrap) => {
    const ok = o.tone === ex.answer;
    btn.className = ok ? 'right' : 'wrong';
    if (!ok) markCorrect(wrap, ex.options, (x) => x.tone === ex.answer);
    resolve(ok, `${ex.word.word} ${ex.word.pinyin} — ${ex.word.meaning}`);
  });
}

function markCorrect(wrap, options, test) {
  options.forEach((o, i) => {
    if (test(o)) wrap.children[i].classList.add('was-right');
  });
}

function renderMatch(ex, box) {
  const rightLabel = (w) => (ex.mode === 'pinyin' ? w.pinyin : w.meaning);
  box.innerHTML =
    ask(ex.mode === 'pinyin' ? 'Match the sounds' : 'Match the meanings') +
    `<div class="match">
       <div class="col" data-side="l">${ex.left
         .map((w, i) => `<button data-i="${i}">${esc(w.word)}</button>`)
         .join('')}</div>
       <div class="col" data-side="r">${ex.right
         .map((w, i) => `<button data-i="${i}">${esc(rightLabel(w))}</button>`)
         .join('')}</div>
     </div>`;

  let pickedLeft = null;
  let matched = 0;
  let wrong = 0;
  const cols = box.querySelectorAll('.col');

  const wire = (col, list) => {
    [...col.children].forEach((btn, i) => {
      btn.onclick = () => {
        if (answered || btn.disabled) return;
        const side = col.dataset.side;
        if (side === 'l') {
          for (const b of col.children) b.classList.remove('on');
          btn.classList.add('on');
          pickedLeft = { word: list[i], btn };
          return;
        }
        if (!pickedLeft) return;
        if (list[i].id === pickedLeft.word.id) {
          pickedLeft.btn.className = 'gone';
          btn.className = 'gone';
          pickedLeft.btn.disabled = true;
          btn.disabled = true;
          pickedLeft = null;
          matched += 1;
          if (matched === ex.left.length) {
            resolve(
              wrong === 0,
              ex.left.map((w) => `${w.word} ${w.pinyin}`).join(' · ')
            );
          }
        } else {
          wrong += 1;
          // The learner did not know the word they had selected on the left,
          // so the miss belongs to that word and not to all four.
          const k = keyOf(pickedLeft.word.id, 'r');
          ex.wrongBy?.set(k, (ex.wrongBy.get(k) ?? 0) + 1);
          btn.classList.add('wrong');
          setTimeout(() => btn.classList.remove('wrong'), 350);
        }
      };
    });
  };
  wire(cols[0], ex.left);
  wire(cols[1], ex.right);
}

// Word bank: tap tiles to build the answer, tap a placed tile to take it back.
// A listening bank is the Chinese one with the sentence heard instead of read
// in English.
function renderBank(ex, box) {
  const zh = ex.type !== 'bankEn';
  const cue =
    ex.type === 'listenSent'
      ? `<div class="cue cue-audio">${playButton(ex.say, 'big')}</div>`
      : `<div class="cue"><p class="${zh ? 'cue-en' : 'cue-hanzi'}">${esc(ex.prompt)}</p>
     ${!zh && ex.sentence.pinyin ? `<p class="cue-pinyin">${esc(ex.sentence.pinyin)}</p>` : ''}</div>`;
  const question =
    ex.type === 'listenSent' ? 'What did you hear?' : zh ? 'Say this in Chinese' : 'Say this in English';
  box.innerHTML =
    ask(question) +
    `${cue}
     <div class="line" id="bank-line"></div>
     <div class="tiles" id="bank-tiles">${ex.tiles
       .map((t, i) => `<button data-i="${i}">${esc(t)}</button>`)
       .join('')}</div>`;

  const line = $('bank-line');
  const bank = $('bank-tiles');
  const placed = [];

  const refresh = () => {
    line.innerHTML = placed
      .map((p, i) => `<button data-p="${i}">${esc(p.text)}</button>`)
      .join('');
    [...line.children].forEach((btn, i) => {
      btn.onclick = () => {
        if (answered) return;
        placed[i].tile.disabled = false;
        placed[i].tile.classList.remove('used');
        placed.splice(i, 1);
        refresh();
      };
    });
    const go = $('lesson-go');
    go.hidden = false;
    go.className = 'press';
    go.textContent = 'Check';
    go.disabled = placed.length === 0;
    go.onclick = () => {
      const given = placed.map((p) => p.text);
      const ok = checkBank(ex, given);
      resolve(ok, zh ? `${ex.sentence.zh} — ${ex.sentence.pinyin}` : ex.sentence.en);
      $('lesson-go').disabled = false;
    };
  };

  [...bank.children].forEach((btn, i) => {
    btn.onclick = () => {
      if (answered) return;
      btn.disabled = true;
      btn.classList.add('used');
      placed.push({ text: ex.tiles[i], tile: btn });
      refresh();
    };
  });
  armPlay(box);
  refresh();
}

function renderCloze(ex, box) {
  const shown = ex.sentence.tokens
    .map((t, i) => (i === ex.at ? '<span class="hole">?</span>' : esc(t)))
    .join('');
  box.innerHTML =
    ask('Fill the gap') +
    `<div class="cue"><p class="cue-hanzi">${shown}</p>
     <p class="cue-en">${esc(ex.sentence.en)}</p></div>` +
    (ex.tip
      ? `<p class="tip"><b>${esc(ex.tip.title)}</b> ${esc(ex.tip.pattern)}</p>`
      : '');
  tiles(box, ex.options, (t) => esc(t), (t, btn, wrap) => {
    const ok = t === ex.answer;
    btn.className = ok ? 'right' : 'wrong';
    if (!ok) markCorrect(wrap, ex.options, (x) => x === ex.answer);
    resolve(ok, `${ex.sentence.zh} — ${ex.sentence.pinyin}`);
  });
}

// -- finishing ----------------------------------------------------------

// One FSRS grade per item, from how badly it went: clean first pass is Good,
// one slip is Hard, more than one is Again. A hint costs a grade, the way it
// already does on the writing cards -- otherwise a lucky one-in-four tap and a
// known answer read the same.
export function ratingFor(missed, hinted) {
  if (missed === 0) return hinted ? Rating.Hard : Rating.Good;
  if (missed === 1 && !hinted) return Rating.Hard;
  return Rating.Again;
}

function finish() {
  // An item may carry several cards (a match exercise covers four words), and
  // a card may appear in several exercises. Grade each card once, off its
  // worst showing in the lesson.
  //
  // An introduction is not evidence, so it grades nothing -- it has already
  // started the card, and whichever retrieval follows it in this lesson is
  // what says how well the word landed.
  const byKey = new Map(); // card key -> { missed, hinted }
  const reps = new Map(); // card key -> active retrievals to count
  for (const ex of plan) {
    if (ex.type === 'meet') continue;
    const m = misses.get(ex) ?? 0;
    for (const k of ex.keys ?? (ex.key ? [ex.key] : [])) {
      const worst = byKey.get(k) ?? { missed: 0, hinted: false };
      worst.missed = Math.max(worst.missed, ex.wrongBy?.get(k) ?? m);
      worst.hinted = worst.hinted || Boolean(ex.hinted);
      byKey.set(k, worst);
    }
    // A sentence exercise grades the sentence's card but exercises its words,
    // so exposure is counted over `wordKeys` where an exercise has them. One
    // count per answered attempt: a re-queued item was retrieved twice.
    for (const k of ex.wordKeys ?? ex.keys ?? (ex.key ? [ex.key] : [])) {
      reps.set(k, (reps.get(k) ?? 0) + 1 + m);
    }
  }
  for (const [key, worst] of byKey) {
    const id = key.slice(0, key.lastIndexOf(':'));
    const kind = key.slice(key.lastIndexOf(':') + 1);
    grade(id, kind, ratingFor(worst.missed, worst.hinted));
  }
  for (const [key, n] of reps) {
    countExposure(key.slice(0, key.lastIndexOf(':')), key.slice(key.lastIndexOf(':') + 1), n);
  }

  const clean = stats.wrong === 0;
  const xp =
    mode === 'lesson'
      ? XP_LESSON + (hard ? XP_HARD : 0) + (clean ? XP_CLEAN : 0)
      : plan.length * XP_PRACTICE_ITEM;
  addXp(xp);
  // A hard replay is only offered once the unit is finished, so it has no
  // level to complete.
  const done = mode === 'lesson' && !hard ? completeLevel(unit.id, unit.levels) : 0;

  const secs = Math.round((Date.now() - stats.began) / 1000);
  const accuracy = Math.round((plan.length / Math.max(1, stats.answers)) * 100);
  const shaky = [
    ...new Set(
      plan
        .filter((ex) => (misses.get(ex) ?? 0) > 0)
        .map((ex) => ex.word?.word ?? ex.sentence?.zh)
        .filter(Boolean)
    ),
  ];

  $('done-title').textContent =
    mode !== 'lesson' ? 'Practice complete' : hard ? 'Hard replay complete' : 'Lesson complete';
  $('done-again').textContent = mode === 'lesson' ? 'Next lesson' : 'Back to practice';
  $('done-xp').textContent = `+${xp} XP`;
  $('done-line').textContent =
    `${accuracy}% accuracy · ${Math.floor(secs / 60)}m ${secs % 60}s` +
    (mode !== 'lesson'
      ? ` · ${plan.length} item${plan.length === 1 ? '' : 's'}`
      : hard
        ? ` · ${unit.textbook}`
        : ` · level ${done} of ${unit.levels}`);
  $('done-shaky').innerHTML = shaky.length
    ? shaky.map((s) => `<span>${esc(s)}</span>`).join('')
    : '';
  $('done-note').textContent = shaky.length
    ? 'These come back sooner.'
    : 'Nothing needed a second pass.';
  onLeave('done');
}

export function quitLesson() {
  onLeave('quit');
}

export const lessonUnit = () => unit;
export const lessonLevel = () => level;
export const lessonMode = () => mode;
export const lessonHard = () => hard;
