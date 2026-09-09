# Hanzi Practice

Handwriting drill for Mandarin, built for an iPhone home screen. You get a
meaning and a pinyin reading, an empty 米字格 grid, and you write the character
with your finger. Stroke order and shape are graded automatically, so there are
no self-rating buttons on the writing cards.

No network at runtime, no accounts, no AI calls. The whole course is a JSON
file and a folder of stroke outlines.

---

## Why not the Rosetta Stone order

Rosetta Stone's Foundations course is twenty thematic units — Language Basics,
Greetings and Introductions, Work and School, and so on. Two reasons not to
copy it here:

1. The per-language word index is theirs, published only through their support
   site. Not something to lift.
2. More importantly it is a *speaking* sequence. It introduces 谢谢 in the first
   unit, which means writing 谢 (17 strokes, three components) before 十 (2).
   For a handwriting app that ordering is actively harmful.

What this uses instead:

- **HSK 3.0 bands** set the coarse order. The dataset yields exactly 300
  characters per band, which matches the published handwriting lists.
- **Component dependency** is a hard constraint. You never meet a character
  before the characters it is built out of — 人 before 从, 门 and 人 before 们.
  A component only counts as a prerequisite if it is taught at the same band or
  earlier, so one HSK-1 character containing a rare component does not drag that
  component to the front of the course.
- **Corpus frequency and stroke count** break ties inside a band, so common and
  simple characters come first. `--strokeWeight` controls the balance.

The result opens 一 了 人 几 个 也 上 么 大 下 工 子 不 二 三 从 … and stays inside
HSK 1 for its first 300 characters.

That sequence is now the fallback deck rather than the course itself: the
course's writing track follows the textbook units, and reuses this order only to
break ties. See *The writing track* below.

## Running it

```sh
npm install          # only needed if you want to rebuild the curriculum
npm run serve        # prints a LAN address
npm test             # curriculum integrity + scheduling checks
```

## Getting it onto the phone

There is no App Store build. It installs as a home-screen web app, which on iOS
gets its own window, no browser chrome, and offline storage.

1. Run `npm run serve` and open the printed LAN address in **Safari** on the
   phone, with both devices on the same Wi-Fi. Safari specifically — Chrome on
   iOS cannot install web apps.
2. Share → Add to Home Screen.
3. Open it once from the home screen so the service worker caches the shell and
   the first two units. After that it works in airplane mode.

For something more permanent, push the repo to GitHub Pages or any static host
and install from that URL instead. Everything is relative paths; there is no
build step.

## Rebuilding the curriculum

```sh
node tools/build-curriculum.mjs --levels=6 --lesson=8 --unit=5 --strokeWeight=250
```

| flag | default | meaning |
| --- | --- | --- |
| `--levels` | 4 | include HSK 3.0 bands 1..N (6 gives ~1800 characters) |
| `--lesson` | 8 | characters per lesson |
| `--unit` | 5 | lessons per unit, and the stroke-bundle chunk size |
| `--strokeWeight` | 250 | places of frequency rank one extra stroke is worth |

Writes `data/curriculum.json` plus one stroke bundle per unit. Source datasets
download to `tools/cache/` on first run (gitignored, ~60 MB).

Bump `VERSION` in `sw.js` after rebuilding, or installed copies will keep
serving the old cache.

## Lessons

A unit is a textbook lesson, and it is played as a run of levels of fifteen
exercises each. A unit's words are split into batches of three: level 1 teaches
the first three, level 2 the next three, and so on, and two review levels follow
the last teaching level. So the level count follows the word count — Lesson 1
has eight words and five levels, Lesson 3 has eleven and six.

A teaching level introduces its three words spread through the lesson rather
than stacked at the front, and each one comes back at least three times inside
the same lesson: recognised one way, recognised the other, then produced inside
a sentence. The first time it comes back is two or three exercises after you met
it — long enough that you have to remember it, short enough that you can. In
practice each new word gets about five goes.

Nothing appears before it has been taught. At any point in a lesson the only
words that can show up — as the question, as a wrong answer, as a spare tile, or
inside a sentence — are the ones already introduced, which sometimes means three
tiles instead of four in the opening lesson of the course.

Why it works this way, what Duolingo does, and the research behind the numbers:
`docs/duolingo-teaching-pattern.md`. `npm run exposure` prints what the
generator is actually producing:

```sh
npm run exposure               # Book 1 Lesson 1, every level
npm run exposure -- b1l3 200   # another unit, 200 sampled lessons
```

## Scheduling

FSRS-5 via `ts-fsrs`, one card per character per skill. Writing cards are graded
from your performance rather than your opinion of it:

| outcome | rating |
| --- | --- |
| no mistakes, no hint, faster than ~1.1 s per stroke | Easy |
| no mistakes, no hint | Good |
| one or two mistakes | Hard |
| three or more, or you asked for a hint, or you gave up | Again |

Lesson cards are graded the same way, from how the exercise went rather than
from how you felt about it:

| outcome | rating |
| --- | --- |
| right first time, no hint | Good |
| right first time after a hint, or one slip | Hard |
| a slip after a hint, or two or more slips | Again |

A hint is always cheaper than a guess: tapping **Hint** shows the pinyin of
what is on screen, or takes one wrong tile out of play, and costs a grade. Four
tiles pay out one in four to a blind tap, which is why the hint exists and why
it is priced.

Alongside the FSRS cards the store keeps a plain count of how many times each
word has actually been retrieved. Nothing schedules off it; it orders which of
several eligible words a review slot picks, so practice leans toward the ones
that have had the least.

## The writing track

Writing follows the course rather than the HSK bands. A unit's characters
unlock once you have played a lesson of that unit, so writing trails reading by
a unit or so: you meet 谢谢 as a word first, and later write 讠, then 射, then
谢. Within a unit nothing arrives before its components.

Three kinds of card come out of that:

| card | what it asks | when it appears |
| --- | --- | --- |
| Building block | meet it, see what it turns up inside, trace it | a character no word uses on its own — 讠, 冂, 耂 |
| Character | meet it, see its parts, recognise it, write it | a character that words are built from |
| Whole word | write two or three characters in sequence | once every character in the word has a card of its own |

Characters started in the original HSK-band deck keep coming up for review, and
`data/curriculum.json` is still the stroke source for anything the course does
not carry.

## Practice

Practice → three lanes over the one scheduler, none of which move the path:

- **Mistakes** — cards you got wrong and have not yet put right (FSRS keeps
  them in relearning until they come back clean).
- **Words and sentences** — whatever is due, played as select and word-bank
  exercises drawn from everything taught so far.
- **Writing** — the handwriting queue: reviews, new characters, whole words.

## Progress and backups

Progress lives in `localStorage` under `hanzi-practice:v1`, now holding a `v: 3`
record: the FSRS cards, the lifetime retrieval count per card, the characters
introduced per day, course progress per unit, XP per day, and the streak. A
`v: 1` or `v: 2` record migrates on load, keeping every handwriting card; the
retrieval counts simply start from zero. iOS can evict
storage for sites you have not opened in a while — home-screen apps are treated
more durably than tabs, but not permanently. Settings → *Save a backup file*
writes a JSON you can restore from, and it is worth doing occasionally.

## Layout

```
index.html  app.css              markup and styling for every screen
app.js                           shell: screens, the path, the writing drill
js/store.js                      localStorage, FSRS grading, XP and streak
js/course.js                     course data, unit gating, taught-word pools
js/writing.js                    the writing track: what to write next, and
                                 where its stroke data comes from
js/exercises.js                  turns unit data into a lesson of 15 exercises,
                                 or a due queue into a practice set
js/lesson.js                     the lesson runner and its renderers
sw.js  manifest.webmanifest      offline + home-screen install
vendor/                          hanzi-writer, ts-fsrs (both vendored, no CDN)
data/course.json                 units, words, grammar, sentences, characters
data/units/<unitId>.json         stroke outlines for a unit's writing track
data/curriculum.json             writing-deck cards, in dependency order
data/strokes/unit-NN.json        stroke outlines, one bundle per writing unit
tools/spine/book-N.json          the lesson facts taken from the textbook
tools/build-course.mjs           builds course.json from a spine
tools/build-curriculum.mjs       the writing-deck ordering pipeline
tools/check.mjs                  integrity, coverage, generator and store tests
tools/exposure-report.mjs        how much retrieval a generated lesson gives
docs/                            research notes behind the teaching design
tools/serve.mjs                  static server for local testing
```

## Data sources and licensing

Worth reading before you publish this anywhere public.

| what | from | terms |
| --- | --- | --- |
| Lesson order, topics, per-lesson word and grammar lists | *HSK Standard Course* 1-3 (Beijing Language and Culture University Press) | the book is copyrighted. Only facts are used — which lesson comes next, what it is about, and which words and grammar points it introduces. No dialogues, exercise text or illustrations. |
| Grammar point index (which point belongs to which lesson) | [AllSet Learning Chinese Grammar Wiki](https://resources.allsetlearning.com/chinese/grammar/), mirrored at [ivankra/asg](https://github.com/ivankra/asg) | **CC BY-NC-SA 3.0** — attribution required on every view where it appears, and non-commercial only. No advertising, no revenue of any kind. The grammar tips in `tools/spine` are written here, not copied. |
| Stroke outlines and medians | [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data), derived from [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) | graphics derive from Arphic fonts under the **Arphic Public License** — copyleft, requires attribution and that derived font data stay under the same terms. `vendor/hanzi-writer.LICENSE` and the upstream `ARPHICPL.TXT` have the text. |
| Decomposition, glosses, etymology hints | Make Me a Hanzi | LGPL for the data files |
| HSK bands, pinyin, meanings, frequency | [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) | check the upstream repo; definitions trace back to CC-CEDICT (CC BY-SA) |
| `hanzi-writer` | chanind | MIT |
| `ts-fsrs` | open-spaced-repetition | MIT |

The code in this repo is yours to do as you like with. The bundled character
data is not uniformly permissive, so keep the attributions if you redistribute.

## Things it deliberately does not do

No pronunciation scoring, no conversation practice, no images. It is a writing
drill. Tone and speaking need a different tool.
