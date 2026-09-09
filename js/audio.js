// Sound comes from the system's speech synthesis and nothing else: no bundled
// clips, no network voice. iOS keeps its voices on the device, so once a
// Chinese voice is installed this works on a plane; until one is, nothing
// here is available and no exercise that needs sound is generated.
//
// Known limits, all designed around rather than fixed: the voice list may be
// empty when a PWA boots and fill in later (`onChange`), playback has to be
// triggered by a tap (every renderer speaks inside a click handler and puts a
// replay button on screen), and an utterance dies when the app is
// backgrounded (the replay button again).

// Mandarin voices only. zh-HK is Cantonese and would teach the wrong sounds.
const MANDARIN = /^(zh([-_](CN|TW|SG|Hans|Hant))?|cmn([-_].*)?)$/i;

const synth = () => globalThis.speechSynthesis ?? null;

export function voices() {
  const s = synth();
  if (!s) return [];
  return s
    .getVoices()
    .filter((v) => MANDARIN.test(v.lang.replace('_', '-')))
    .sort((a, b) => rank(a) - rank(b));
}

// Mainland pronunciation first, then whatever else speaks Mandarin. Among
// equals, a voice the system marks as default wins.
function rank(v) {
  const lang = v.lang.replace('_', '-').toLowerCase();
  const region = lang.startsWith('zh-cn') || lang.startsWith('cmn-cn') ? 0 : lang === 'zh' ? 1 : 2;
  return region * 2 + (v.default ? 0 : 1);
}

export const voice = () => voices()[0] ?? null;

export const available = () => voice() !== null;

// Speak `text` in Mandarin, cutting off whatever was still playing so a quick
// double tap on the replay button does not queue two readings back to back.
// Returns false when there is nothing to speak with.
export function speak(text, { rate = 0.85 } = {}) {
  const s = synth();
  const v = voice();
  if (!s || !v || !globalThis.SpeechSynthesisUtterance) return false;
  s.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = v;
  u.lang = v.lang;
  u.rate = rate;
  s.speak(u);
  return true;
}

// The voice list can change under us -- it is often empty at boot and arrives
// a moment later, and the user may install a voice while the app is open.
// Screens that show whether sound is available subscribe here.
const listeners = new Set();
let wired = false;

export function onChange(fn) {
  listeners.add(fn);
  const s = synth();
  if (s && !wired && 'addEventListener' in s) {
    wired = true;
    s.addEventListener('voiceschanged', () => {
      for (const l of listeners) l(available());
    });
  }
  return () => listeners.delete(fn);
}

// -- pinyin helpers for the tone exercise -------------------------------

// The tone number a marked syllable carries: 1 to 4, or 0 for a neutral tone.
const MARKS = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 };

export function toneOf(syllable) {
  for (const ch of syllable.normalize('NFD')) {
    if (MARKS[ch]) return MARKS[ch];
  }
  return 0;
}

// The syllable with its tone mark taken off and nothing else touched, so nǚ
// stays nü rather than collapsing to nu.
export function bare(syllable) {
  return syllable
    .normalize('NFD')
    .replace(/[\u0304\u0301\u030c\u0300]/g, '')
    .normalize('NFC');
}

// Put a tone mark on a bare syllable, following the usual rule: a or e take
// it if present, o takes it in ou, otherwise the last vowel does.
const DIACRITIC = { 1: '\u0304', 2: '\u0301', 3: '\u030c', 4: '\u0300' };

export function mark(syllable, tone) {
  const s = bare(syllable);
  if (!DIACRITIC[tone]) return s;
  const lower = s.toLowerCase();
  let at = -1;
  if (lower.includes('a')) at = lower.indexOf('a');
  else if (lower.includes('e')) at = lower.indexOf('e');
  else if (lower.includes('ou')) at = lower.indexOf('o');
  else {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('aeiouü'.includes(lower[i])) {
        at = i;
        break;
      }
    }
  }
  if (at < 0) return s;
  return (s.slice(0, at + 1) + DIACRITIC[tone] + s.slice(at + 1)).normalize('NFC');
}
