# Hanzi Practice

A Mandarin course for an iPhone home screen, following *HSK Standard Course*
lesson by lesson. Each textbook lesson is a unit on the path: you meet its
words, recognise them, build sentences from them, fill grammar-targeted gaps,
and then write the characters by hand on a 米字格 grid, with stroke order and
shape graded automatically. A guidebook per unit holds the word list and the
grammar tips, so the app reads alongside the book instead of replacing it.

No network at runtime, no accounts, no AI calls. The whole course is a JSON
file and a folder of stroke outlines, and once it is installed it works in
airplane mode.

---

## The path

Book 1 is one section; its fifteen lessons are the units. A unit unlocks when
the one before it is finished, and finishing a unit means playing every one of
its levels.

Tap a unit to play its next level. Tap **Guide** beside it to open the
guidebook. A finished unit does not go quiet: tapping it plays a **hard
replay** of everything taught up to that point.

Only Lessons 1 to 3 have content today. Lessons 4 to 15 show on the path as
titles, greyed out, until their word lists are transcribed into the spine (see
*The spine* below). Until the spine is checked against the printed book the
path says so at the top.

## Lessons

A unit is played as a run of levels of fifteen exercises each. Its words are
split into batches of three: level 1 teaches the first three, level 2 the next
three, and so on, and two review levels follow the last teaching level. So the
level count follows the word count. Lesson 1 has eight words and five levels,
Lesson 3 has eleven and six.

A teaching level introduces its three words spread through the lesson rather
than stacked at the front, and each one comes back at least three times inside
the same lesson: recognised one way, recognised the other, then produced inside
a sentence. The first time it comes back is two to four exercises after you met
it, long enough that you have to remember it, short enough that you can.

The first review level drills the unit's own words and sentences. The second
widens to everything taught so far and leans on production.

Nothing appears before it has been taught. At any point in a lesson the only
words that can show up, as the question, as a wrong answer, as a spare tile, or
inside a sentence, are the ones already introduced. Early in the course that
sometimes means three tiles instead of four.

A missed exercise goes to the back of the queue and comes round again. The
lesson ends only when every exercise has been answered correctly once.

Exercise types:

| type | what you do |
| --- | --- |
| Meet | see the word, its pinyin, its meaning and the characters it is built of, then pick its meaning out of two |
| Select | pinyin to hanzi, or hanzi to meaning, out of four |
| Match | pair hanzi with pinyin or meaning, four at a time |
| Word bank | build the Chinese sentence from tiles, or the English one |
| Fill the gap | one token of a sentence is missing, and the grammar point it belongs to is named |
| Listen | hear a word and pick its hanzi, or hear a sentence and build it from tiles |
| Tone | hear a word and name the tone of the marked syllable, out of five |

The last two need a Chinese voice on the device (see Sound, below). Without
one they are simply not generated, and the lesson is the same fifteen slots
without them. With one, a new word's sound-to-hanzi step is played by ear
half the time instead of from pinyin, and review levels and hard replays
mix all three audio forms in.

Why it works this way, what Duolingo does, and the research behind the numbers:
`docs/duolingo-teaching-pattern.md`. `npm run exposure` prints what the
generator is actually producing:

```sh
npm run exposure               # Book 1 Lesson 1, every level
npm run exposure -- b1l3 200   # another unit, 200 sampled lessons
```

## Hard replay

Once a unit is finished, tapping it on the path or in its guidebook plays a
hard replay instead of a level. It is the same fifteen slots over everything
taught up to that unit, with three differences: the exercises are production
first (word bank and fill the gap, with recognition only once those run out),
there are five wrong answers beside the right one instead of three and five
spare tiles in the word bank, and the **Hint** button is gone. It earns a
little more XP and moves nothing on the path. Audio exercises keep their
**Show pinyin** button even here: it is the way through when the voice has
been cut off, not a leg up.

## Guidebook

Every unit with content has a guidebook, open whether or not the unit is
unlocked. It shows the textbook reference and page, the lesson topic, the word
list with pinyin and meaning, each grammar point as a pattern, a short tip and
the course sentences that show it, and the characters the unit's writing track
will ask for. Words and characters you have started are drawn in full ink;
the rest are faint. Grammar points that are indexed against the Chinese Grammar
Wiki link to it.

The button at the bottom does whatever tapping the unit on the path would do:
start, continue, or replay on hard.

## Scheduling

FSRS-5 via `ts-fsrs`, one card per item per skill: a word's reading card, a
word's listening card, a sentence's building card, a character's writing card,
a whole word's writing card. Every card is graded from how the exercise went
rather than from how you felt about it.

Writing cards:

| outcome | rating |
| --- | --- |
| no mistakes, no hint, faster than ~1.1 s per stroke | Easy |
| no mistakes, no hint | Good |
| one or two mistakes | Hard |
| three or more, or you asked for a hint, or you gave up | Again |

Lesson cards:

| outcome | rating |
| --- | --- |
| right first time, no hint | Good |
| right first time after a hint, or one slip | Hard |
| a slip after a hint, or two or more slips | Again |

A hint is always cheaper than a guess: tapping **Hint** shows the pinyin of
what is on screen, or takes one wrong tile out of play, and costs a grade. Four
tiles pay out one in four to a blind tap, which is why the hint exists and why
it is priced. On an audio exercise the button reads **Show pinyin** and costs
the same: for a listening question the pinyin is most of the answer, and for a
tone question it shows the syllables with the tone marks off.

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
| Building block | meet it, see what it turns up inside, trace it | a character no word uses on its own, such as 讠, 冂, 耂 |
| Character | meet it, see its parts, recognise it, write it | a character that words are built from |
| Whole word | write two or three characters in sequence | once every character in the word has a card of its own |

A writing session is split into small batches, each drilled until every item
in it has been written cleanly enough to graduate. New characters are taught
before they are quizzed: the first pass animates the character, shows its
components, and asks you to pick it out of four before you write it.

Characters started in the original HSK-band deck keep coming up for review, and
`data/curriculum.json` is still the stroke source for anything the course does
not carry. That deck is ordered by HSK 3.0 band, then component dependency,
then frequency and stroke count, which is also the tie-breaker the course's
writing track uses when two characters could equally well come first.

## Practice

Practice is four lanes over the one scheduler, none of which move the path:

- **Mistakes**: cards you got wrong and have not yet put right. FSRS keeps
  them in relearning until they come back clean.
- **Words and sentences**: whatever is due, played as select and word-bank
  exercises drawn from everything taught so far.
- **Listening**: words whose listening card is due, each played as one of the
  three audio forms in turn. Needs a Chinese voice; says so when there is
  none.
- **Writing**: the handwriting queue: reviews, new characters, whole words.

## Sound

Every sound comes from the phone's own speech synthesis. Nothing is bundled
and nothing is fetched, so it works offline once a Chinese voice is installed,
and it costs nothing. On an iPhone that is Settings › Accessibility › Spoken
Content › Voices › Chinese; pick a mainland (zh-CN) voice and download it.
Settings in the app names the voice it found and has a **Test** button.

Where a voice exists, a new word is spoken as you meet it, every pinyin cue
has a replay button beside it, and the listening and tone exercises come into
play. Every audio exercise has a large replay button and a **Show pinyin**
fallback, because an utterance can be cut short by a notification or the
screen dimming, and the voice list can be empty for a moment when the app
boots. Cantonese (zh-HK) voices are ignored.

The tone exercise never asks about a syllable the voice will say differently
from the way it is written: a third tone before another third tone, or 不 and
一 inside a longer word.

## XP, streak, daily goal

A lesson earns 10 XP, 15 if you got through it clean; a hard replay adds 5 on
top. Practice earns 1 XP per item. The header on the path shows the day's XP
against the goal set in Settings, and the streak, which counts days with any
XP at all. One missed day is forgiven, once.

## Running it

```sh
npm install          # only needed if you want to rebuild the data
npm run serve        # prints a LAN address
npm test             # data integrity, generator, store and offline checks
```

## Getting it onto the phone

There is no App Store build. It installs as a home-screen web app, which on iOS
gets its own window, no browser chrome, and offline storage.

1. Run `npm run serve` and open the printed LAN address in **Safari** on the
   phone, with both devices on the same Wi-Fi. Safari specifically: Chrome on
   iOS cannot install web apps.
2. Share, then Add to Home Screen.
3. Open it once from the home screen. The service worker precaches the shell,
   the course, and the stroke bundle of every unit that has content, so after
   that first open it works in airplane mode.
4. For sound, install a Chinese voice as described under Sound. Without one
   the app is silent and skips the two exercise types that need it.

For something more permanent, push the repo to GitHub Pages or any static host
and install from that URL instead. Everything is relative paths; there is no
build step.

## The spine

`tools/spine/book-N.json` holds what the course takes from the textbook: lesson
order, titles, topics, page numbers, and per lesson the word list, the grammar
points and the practice sentences. One file per book; the builder picks up any
it finds. Book 1 exists with all fifteen lesson titles. Lessons 1 to 3 carry
words, grammar and sentences; Lessons 4 to 15 are titles only and build as
units without content.

Each spine file carries a `verified` flag. The word lists for Lessons 1 to 3
were compiled from HSK 1 vocabulary and have not been checked against the
printed 生词 pages, so the flag is `false`, and the path and every guidebook
say so. Setting it to `true` clears both.

Grammar tips are written here, not copied. Where a grammar point is indexed
against the Chinese Grammar Wiki its `wikiRef` links the guidebook to it.
Sentences are authored in the spine and the build fails if one uses a word its
unit has not taught yet.

## Rebuilding the data

```sh
npm run build:course     # course.json and data/units/*.json from the spine
npm run build            # the writing deck too
```

`build-course.mjs` resolves each spine word against the open datasets cached
in `tools/cache/` for pinyin, HSK bands and frequency; decomposes each new
character with Make Me a Hanzi to order the writing track and find its
building blocks; and copies stroke outlines from `hanzi-writer-data` into one
bundle per unit. `--introCap` and `--reviewLevels` change the batch size and
the number of review levels.

The writing deck behind `data/curriculum.json`:

```sh
node tools/build-curriculum.mjs --levels=6 --lesson=8 --unit=5 --strokeWeight=250
```

| flag | default | meaning |
| --- | --- | --- |
| `--levels` | 4 | include HSK 3.0 bands 1..N (6 gives ~1800 characters) |
| `--lesson` | 8 | characters per lesson |
| `--unit` | 5 | lessons per unit, and the stroke-bundle chunk size |
| `--strokeWeight` | 250 | places of frequency rank one extra stroke is worth |

Source datasets download to `tools/cache/` on first run (gitignored, ~60 MB).

Bump `VERSION` in `sw.js` after rebuilding either, or installed copies will
keep serving the old cache. The worker reads which unit bundles to precache off
the course itself, so adding units needs no other change there.

## Progress and backups

Progress lives in `localStorage` under `hanzi-practice:v1`, holding a `v: 3`
record: the FSRS cards, the lifetime retrieval count per card, the characters
introduced per day, course progress per unit, XP per day, and the streak. A
`v: 1` or `v: 2` record migrates on load, keeping every handwriting card. iOS
can evict storage for sites you have not opened in a while. Home-screen apps
are treated more durably than tabs, but not permanently. Settings, then *Save
a backup file*, writes a JSON you can restore from, and it is worth doing
occasionally.

## Layout

```
index.html  app.css              markup and styling for every screen
app.js                           shell: screens, the path, the guidebook,
                                 the practice hub, the writing drill
js/store.js                      localStorage, FSRS grading, XP and streak
js/course.js                     course data, unit gating, taught-word pools
js/writing.js                    the writing track: what to write next, and
                                 where its stroke data comes from
js/exercises.js                  turns unit data into a lesson of 15 exercises,
                                 a hard replay, or a due queue into a practice set
js/lesson.js                     the lesson runner and its renderers
js/audio.js                      system speech synthesis: voice choice, replay,
                                 and the pinyin tone-mark helpers
sw.js  manifest.webmanifest      offline + home-screen install
vendor/                          hanzi-writer, ts-fsrs (both vendored, no CDN)
data/course.json                 units, words, grammar, sentences, characters
data/units/<unitId>.json         stroke outlines for a unit's writing track
data/curriculum.json             writing-deck cards, in dependency order
data/strokes/unit-NN.json        stroke outlines, one bundle per writing unit
tools/spine/book-N.json          the lesson facts taken from the textbook
tools/build-course.mjs           builds course.json from a spine
tools/build-curriculum.mjs       the writing-deck ordering pipeline
tools/check.mjs                  integrity, coverage, generator, store and
                                 offline checks
tools/exposure-report.mjs        how much retrieval a generated lesson gives
docs/                            research notes behind the teaching design
tools/serve.mjs                  static server for local testing
```

## Data sources and licensing

Worth reading before you publish this anywhere public.

| what | from | terms |
| --- | --- | --- |
| Lesson order, topics, per-lesson word and grammar lists | *HSK Standard Course* 1-3 (Beijing Language and Culture University Press) | the book is copyrighted. Only facts are used: which lesson comes next, what it is about, and which words and grammar points it introduces. No dialogues, exercise text or illustrations. |
| Grammar point index (which point belongs to which lesson) | [AllSet Learning Chinese Grammar Wiki](https://resources.allsetlearning.com/chinese/grammar/), mirrored at [ivankra/asg](https://github.com/ivankra/asg) | **CC BY-NC-SA 3.0**: attribution required on every view where it appears, and non-commercial only. No advertising, no revenue of any kind. The grammar tips in `tools/spine` are written here, not copied. |
| Stroke outlines and medians | [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data), derived from [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) | graphics derive from Arphic fonts under the **Arphic Public License**: copyleft, requires attribution and that derived font data stay under the same terms. `vendor/hanzi-writer.LICENSE` and the upstream `ARPHICPL.TXT` have the text. |
| Decomposition, glosses, etymology hints | Make Me a Hanzi | LGPL for the data files |
| HSK bands, pinyin, meanings, frequency | [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) | check the upstream repo; definitions trace back to CC-CEDICT (CC BY-SA) |
| `hanzi-writer` | chanind | MIT |
| `ts-fsrs` | open-spaced-repetition | MIT |

The code in this repo is yours to do as you like with. The bundled character
data is not uniformly permissive, so keep the attributions if you redistribute.

## Things it deliberately does not do

No pronunciation scoring, no conversation practice, no images, no bundled or
downloaded audio. Sound is whatever voice the phone has; speaking exercises
are not planned, because on-device speech recognition cannot score tones and
needs the network.
