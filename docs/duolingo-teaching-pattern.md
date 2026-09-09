# The Duolingo teaching pattern, and where our "teach" lesson falls short

Research note, then the design it produced. Written because playing Book 1
Lesson 1 at level 1 felt like guessing: a word was met once, drilled about
twice, and never came back inside the same sitting.

§1 to §4 are the diagnosis and the sources. §5 is the design that now ships;
§7 is what is still open. Read this before changing `js/exercises.js`'s lesson
scheduler or `js/lesson.js`'s runner. `PLAN.md` §2 lists *what* we copy from Duolingo at the level of
features; this note is about the *density and ordering* of exposures inside one
lesson, which is the part we got wrong.

Every claim below is tagged:

- **[doc]** — stated by Duolingo in a blog post, whitepaper, or paper.
- **[obs]** — community documentation or first-hand observation of the app.
- **[lit]** — published learning-science result, not Duolingo-specific.
- **[ours]** — measured in this repo, or a design decision proposed here.

---

## 1. The measured problem

`tools/exposure-report.mjs` builds a real lesson 500 times and counts, per
word, how often the learner has to *actively retrieve* it. Active means the
word is the thing under test: a `selectHanzi` / `selectMeaning` target, a
`match` pair, a `cloze` answer, or a token the learner must place in a
`bankZh`. It excludes a word merely appearing among the tokens of a `bankEn`
prompt, which is reading, not retrieval.

Run it:

```sh
node tools/exposure-report.mjs            # b1l1, all four levels
node tools/exposure-report.mjs b1l2       # another unit
```

Unit `b1l1` (8 new words), level 1, fresh state, **as it was before §5**
— rerunning the tool today gives the numbers in §5.3 instead — **[ours]**:

| measure | value |
| --- | --- |
| exercises in the lesson | 15 |
| of those, `meet` cards with no task | 8 |
| active retrievals per new word, mean | **1.8** (per word: 1.7–2.4) |
| words getting **zero** active retrieval | 7–11% of runs, per word |
| words getting **one or fewer** | 19–42% of runs, per word |
| gap from a word's `meet` card to its first retrieval, mean | **6.9 exercises** |
| first retrieval immediately after the `meet` card | 2% of the time |

Two failures, and the second is the worse one.

**Density.** 1.8 retrievals is far below any published estimate of what a
form-meaning link needs (§3.4). Level 1 spends more than half its slots on
cards that ask nothing.

**Ordering.** Because `buildLesson` front-loads every unmet word before the
recipe runs, level 1 is eight introductions in a row and then seven drills.
The learner absorbs eight new form-meaning-sound triples with no retrieval
between them, then gets tested on a subset ~7 exercises later, by which point
nothing is in working memory. That is not spacing; it is a block of study
followed by an exam. Guessing is the rational strategy, and the 4-option tiles
reward it 25% of the time.

Later levels look healthier (2.3–5.3 per word, ~3.3 mean) only because
the `meet` cards are gone and the whole lesson is drills. Across all four
levels a word accumulates ~11.6 retrievals, which is in the right range — but
they are all available in one sitting, and the level where the learner most
needs support is the one with the least.

Two smaller code-level findings, same file — **[ours]**:

- `match` grades four words off one miss counter (`js/lesson.js:finish`), so one
  mis-tapped pair marks all four `Again`. A `match` is also brute-forceable:
  with four pairs, tapping blind eventually clears the board.
- A `meet` card calls `start()` rather than `grade()` (`js/lesson.js:renderMeet`),
  which is correct — meeting is not evidence — but it means 8 of 15 slots emit
  no learning signal at all.

---

## 2. What Duolingo actually does

### 2.1 Shape of a session

- A lesson is roughly 15 exercises, and a unit is several lessons. **[obs]**
- Lessons are assembled programmatically by a **session generator** from the
  unit's data; there are no hand-authored lessons. **[doc]**
- The session generator enforces **per-exercise-type caps**: "no lesson should
  ever contain more than a certain number of the same kind of exercise." This
  cap was added *because* courses teaching a new writing system — Chinese
  specifically — were generating lessons stuffed with repetitive "Tap the
  pairs" exercises. The caps are not published. **[doc]**

The Chinese post is the single most relevant primary source we have, and it
cuts both ways: Duolingo's own fix was to *reduce* the repetition of one
exercise type, not to reduce repetition of a word. Type variety and item
repetition are different axes. Our lesson has healthy type variety (`meet`
8, then 2/2/2/1 across four types) and starved item repetition.

### 2.2 How a new item is introduced

- New meanings are conveyed with words the learner already has: "Exercises use
  English words and phrases that learners already know to communicate the
  meanings of new vocabulary." **[doc]**
- Sentences carrying a new word are built deliberately out of old material:
  "When we introduce learners to a new word or phrase, we make sure to build
  sentences that rely heavily on words and grammar that learners have
  previously seen." **[doc]** We already enforce this — `tools/check.mjs` fails
  the build if a sentence uses an untaught word.
- The amount of new material is explicitly rationed against cognitive load:
  course creators use "digital tools and human checks to ensure that we limit
  the amount of new material in a given sentence and skill," citing research on
  processing load. **[doc]**
- A word's several meanings are **spiralled**, not front-loaded: "you might see
  different meanings for a single word taught gradually throughout the course,
  instead of all at once." **[doc]**
- In character courses, the matching exercise ("Tap the pairs") is the vehicle
  for introducing individual characters — the introduction *is* an exercise,
  with the answer visible on screen, rather than a separate no-task card. **[doc]**
- Newer monolingual exercise types each carry exactly one job: "to introduce a
  meaning, show a grammatical contrast, or provide reading comprehension
  practice." **[doc]** One exercise, one teaching purpose.

The pattern to take from this: **the first encounter with a word is a
low-stakes exercise, not a slide.** Duolingo has no equivalent of our `meet`
card in most of its flow. It puts the answer where the learner can see it and
asks them to do something with it.

### 2.3 How guessing is suppressed

- **Hints instead of guesses.** Words with a dotted underline can be tapped to
  reveal a translation mid-exercise. Hints are removed only in Legendary
  levels, where the learner has opted into difficulty. **[obs]** The learner
  who does not know is given a way to find out that is cheaper than a blind
  tap.
- **Scaffolding withdrawn over time.** "We *scaffold*, or carefully structure,
  how we teach writing so that you start with words, short phrases, and
  exercises with word banks until you're ready for longer writing on your own,"
  with a keyboard toggle to opt out of the word bank early. **[doc]** Support
  is a ramp, not a constant.
- **Missed exercises re-queue inside the lesson**, and the lesson ends only when
  every item has been answered correctly once. **[obs]** We already do this
  (`js/lesson.js:resolve`).

### 2.4 How long-term review works

- **Half-Life Regression** (Settles & Meeder, ACL 2016) assigns each *lexeme
  tag* — root lexeme plus part of speech and morphology — a half-life, the time
  until recall probability falls to 0.5. Features include total exposures,
  total correct, proportion correct, and time since last practice. HLR roughly
  halved prediction error against a Leitner baseline over 13M learning traces.
  **[doc]**
- **Birdbrain** infers a per-learner ability estimate and adjusts exercise
  difficulty, and schedules review lessons to maintain earlier material. **[doc]**
- The **Practice Hub** is a separate surface with lanes for Mistakes,
  personalised word practice, and listening. **[doc]**

We use FSRS for this and have the three practice lanes. Note the granularity
difference: Duolingo schedules at *lexeme* level and drives *which exercises
appear*; we schedule at card level and use it only to pick what to review. HLR
counting `total exposures` as a feature is a reminder that exposure count is a
first-class quantity — something our generator does not track at all.

### 2.5 Scale, for calibration

CEFR-aligned courses introduce roughly 800 words per level for A1 and A2. **[doc]**
Book 1 of the HSK Standard Course spine is ~150 words across 15 units, ~8–10
per unit. Duolingo spreads a comparable word count over many more lessons than
we do, which is the other half of why our level 1 is dense: we are trying to
introduce a whole unit's vocabulary in one 15-slot lesson.

---

## 3. The learning science underneath

Duolingo cites cognitive load and repetition research without giving numbers,
so the numbers have to come from the literature. What follows is what actually
constrains a lesson recipe.

### 3.1 Retrieval beats restudy — but not immediately

Roediger & Karpicke (2006): learners who took recall tests retained
substantially more after a week than learners who reread the same material the
same number of times (61% vs 40% in the headline comparison). Crucially, on a
test given **5 minutes** later, rereading won. **[lit]**

Consequence for us: a `meet` card is restudy. It is not worthless, but its
benefit is short-lived, and eight of them in a row is the worst possible use of
15 slots.

### 3.2 Where to put the repetitions inside a session

Pimsleur's graduated interval recall (1967) is the classic within-session
schedule: 5 seconds, 25 seconds, 2 minutes, 10 minutes, 1 hour, 5 hours, 1 day,
5 days, 25 days, 4 months, 2 years. The first four intervals all fall inside a
single sitting. **[lit]**

Karpicke & Roediger (2007) complicate the expanding story: expanding retrieval
beat equal-interval retrieval on a test 10 minutes later, but equal-interval
won 2 days later, and the mechanism they identify is **delaying the first
retrieval far enough to make it effortful**. Kang, Lindsey, Mozer & Pashler
(2014) found expanding and equal schedules equivalent at 8 weeks, with
expanding giving higher average recallability *during* training. **[lit]**

Consequence: inside a lesson, want an expanding-ish ladder — early, medium,
late — but do not make the first retrieval trivially adjacent to the
introduction with the answer still on screen. One or two exercises of lag is
the sweet spot: long enough to require retrieval, short enough to succeed.

Our current mean gap of ~7 exercises with 8 new words competing for the same
working memory is past effortful into hopeless.

### 3.3 Recognition before production

Receptive knowledge (see the form, activate a meaning) and productive knowledge
(produce the form from a meaning) are distinct constructs, productive being the
later and harder one. The standard progression of item types runs
multiple-choice recognition → gap-fill → translation → free production. **[lit]**

Our recipe already has the right ladder available — `selectMeaning` and
`selectHanzi` are recognition, `cloze` is gap-fill, `bankZh` is constrained
production — but it fires them at a word in whatever order the recipe cursor
lands, so a word's *first* test can be a `bankZh`, and many words never reach
production at all.

Note also that 4-option recognition has a 25% floor from guessing, and
production has almost none. If a learner reports feeling like they are
guessing, that report is about recognition items specifically.

### 3.4 How many encounters a word needs

Nation & Wang (1999) put the threshold at around 10 encounters before a word is
likely learned, though without guarantee; Webb (2007) found 10 encounters
produced significantly better outcomes than 7 across several measures of word
knowledge; Pellicer-Sánchez & Schmitt (2010) agree on 10+. Across the wider
literature estimates range from **6 to 20** depending on context quality and
which facet of word knowledge is measured. **[lit]**

These studies are about incidental learning from reading, so they are an upper
bound for our case: deliberate paired retrieval with immediate feedback is more
efficient per encounter than meeting a word in a text. But the order of
magnitude is the point. **1.8 is not in the range. 3 to 5 per lesson, several
lessons, is.**

---

## 4. Gap table: the pattern vs what we ship

The `was` column is what the code did when §1 was measured. The `now` column is
what it does after §5.

| the pattern | source | was | now |
| --- | --- | --- | --- |
| Lesson ≈ 15 exercises, assembled by a generator | [obs][doc] | `LESSON_SIZE = 15`, `buildLesson` | unchanged |
| Per-type cap so no type dominates | [doc] | `TYPE_CAP = 4` | unchanged |
| New sentences reuse only taught words | [doc] | enforced at build time | also per level and per slot (§5.3) |
| Missed items re-queue; lesson ends when all are clean | [obs] | `js/lesson.js:resolve` | unchanged |
| Limit new material per lesson against cognitive load | [doc] | 8 introductions in one 15-slot lesson | 3, from `unit.intro` (§5.2) |
| Introduction is itself a low-stakes exercise | [doc] | `meet` is a no-task slide, 8 of 15 slots | 3 slots, each ending in a two-way check (§5.4) |
| First retrieval close after introduction, then expanding lag | [lit] | mean gap 6.9, adjacent 2% | mean 2.5, adjacent 0%, one at lag ≥5 (§5.3) |
| ~10 encounters per word, several per lesson | [lit] | 1.8 in level 1 | 5 in level 1, ~15 across the unit (§5.5) |
| Recognition → gap-fill → production, in that order per word | [lit] | type-driven, not word-driven | a ladder per word, asserted (§5.3) |
| Tap for a hint rather than guess | [obs] | no hint in the reading track | one Hint button, priced (§5.6) |
| Scheduler tracks exposure count | [doc] | FSRS reps only; generator tracks nothing | `store.exposure`, orders review (§5.5) |

Two smaller things fell out of it. The writing track already got the hint
question right — asking for a hint grades the card `Again` (see README,
*Scheduling*) — and the reading track now matches it. And a `meet` card used to
be graded `Good` at the end of a lesson for having been looked at, which it no
longer is (§5.4).

---

## 5. Spec: a teaching lesson

This section is the design the code now implements. It closes all seven rows of
§4. Where a number is arbitrary it is named as a constant so it can be moved.

### 5.1 Constants

| constant | value | where | why |
| --- | --- | --- | --- |
| `LESSON_SIZE` | 15 | `js/exercises.js` | unchanged; matches Duolingo **[obs]** |
| `TYPE_CAP` | 4 | `js/exercises.js` | unchanged; Duolingo's own fix **[doc]** |
| `INTRO_CAP` | 3 | `tools/build-course.mjs` | new words per teaching lesson (§3, cognitive load) |
| `REVIEW_LEVELS` | 2 | `tools/build-course.mjs` | review levels appended after the teaching levels |
| `MIN_RETRIEVALS` | 3 | `js/exercises.js` | active retrievals per new word, in its own lesson |
| `NEAR_MIN` | 2 | `js/exercises.js` | never the very next slot — the answer is still on screen |
| `NEAR_MAX` | 4 | `js/exercises.js` | but the first retrieval lands inside this window |
| `FAR` | 5 | `js/exercises.js` | at least one retrieval at this lag or more |
| `LIFETIME_TARGET` | 10 | `js/store.js` | below this many lifetime retrievals a word goes first in review |

### 5.2 The introduction schedule (gap 1)

`buildLesson` used to pick new words with
`unitWords.filter((w) => !seen(w.id, 'r'))` — store state, not level. With a
batch cap that breaks immediately: replay level 1 and you would get zero
introductions.

Which words a level introduces is now **data, not inferred state**.
`tools/build-course.mjs` chunks each unit's word list by `INTRO_CAP` and writes
the chunks to the unit as `intro`:

```json
{ "id": "b1l1",
  "words": ["w:你","w:好","w:你好","w:吗","w:我","w:很","w:你们","w:不"],
  "intro": [["w:你","w:好","w:你好"], ["w:吗","w:我","w:很"], ["w:你们","w:不"]],
  "levels": 5 }
```

- `unit.intro[level - 1]` is the batch a level teaches, or `[]` for a review level.
- `unit.levels === unit.intro.length + REVIEW_LEVELS`.
- `tools/check.mjs` asserts `intro` flattens back to `words`, in order, so the
  two can never disagree.

Level counts stop being uniform, which is why this is a build change and not a
UI one: `u.levels` is already read from data in `app.js:137`, `js/course.js:18`
and `js/course.js:36`, and the path's level dots are generated from it.

| unit | words | teaching levels | total levels (was 4) |
| --- | --- | --- | --- |
| `b1l1` | 8 | 3 (3+3+2) | 5 |
| `b1l2` | 5 | 2 (3+2) | 4 |
| `b1l3` | 11 | 4 (3+3+3+2) | 6 |

Replaying a teaching level re-introduces its batch. That is deliberate — it is
the lesson that teaches those words, and `start()` is idempotent — and it is
what Duolingo does when you replay a lesson. **[obs]**

A runtime fallback chunks `unit.words` by three if `intro` is absent, so a
stale cached `course.json` degrades rather than crashing.

### 5.3 The slot scheduler (gaps 3, 5)

The old generator walked a *type* cursor and gave each exercise whatever word
came next, so per-word lag and per-word ordering were accidents. It is now
inverted: **word-centric scheduling first, type filling second.**

For a teaching level:

1. **Place the introductions.** Slots 0, 1, 3, 5 … — the first two adjacent,
   the rest every other slot. Interleaving rather than blocking them is the fix
   for the 6.9-exercise gap measured in §1. The first two are adjacent because
   after meeting a single word there is nothing to drill it against: no
   distractor, no pair, no readable sentence.
2. **Reserve each new word's retrieval slots.** For each word, from its intro
   slot, claim `MIN_RETRIEVALS` empty slots:
   - the first in `[intro + NEAR_MIN, intro + NEAR_MAX]` — far enough that the
     answer is no longer on screen, near enough to succeed (§3.2),
   - at least one at `>= intro + FAR`,
   - the rest anywhere after the intro, spread so the same word is never
     drilled in two consecutive slots.
3. **Assign a type per retrieval by ladder position** (§3.3, gap 5), never out
   of order:

   | ladder step | exercise | what it asks |
   | --- | --- | --- |
   | 1 | `selectMeaning` | hanzi → meaning (recognition) |
   | 2 | `selectHanzi` | pinyin + meaning → hanzi (recognition, other direction) |
   | 3+ | `cloze`, else `bankZh` | produce it inside a sentence |

   Production needs a sentence the learner can already read that contains the
   word. Where none exists yet the ladder stops at a third recognition rather
   than putting an untaught word on the tiles.
4. **Fill what is left** with `match` over the batch plus known words, and with
   review items chosen by §5.5, under `TYPE_CAP`.

Everything an exercise puts on screen is **position-aware**: at slot *i* the
only words available — as the thing under test, as a distractor tile, as a
spare word-bank tile, or inside a sentence — are those taught before this
lesson plus those this lesson has introduced by slot *i*. A word met in slot 3
has no business on the tiles in slot 1, and the old generator drew distractors
from the whole unit, which is its own reason an early level felt like guessing
among unknowns. Where that leaves too few words for four tiles, the exercise
gets three, or two.

For a review level (`level > unit.intro.length`) there are no introductions and
all 15 slots are review. The first review level leans recognition plus
production inside the unit; the last also draws on earlier units, which is what
the old `level >= 4` branch did.

Worked teaching level — `b1l1` level 1, as the scheduler actually emits it.
`meet` names the word introduced; every other line names the words retrieved
and each one's lag from its own introduction:

```
 0  meet           你
 1  meet           好
 2  selectMeaning  你          你+2
 3  meet           你好
 4  selectMeaning  好          好+3
 5  selectMeaning  你好         你好+2
 6  selectHanzi    你          你+6
 7  match          你好 你 好     你好+4  你+7  好+6
 8  bankEn
 9  selectMeaning  你好         你好+6
10  selectHanzi    你          你+10
11  selectHanzi    好          好+10
12  bankZh         你好         你好+9
13  match          你 你好 好     你+13  你好+10  好+12
14  selectHanzi    好          好+13
```

Every word: five active retrievals, the first at lag 2 or 3, the last at lag 10
or more, recognition before production, never twice in consecutive slots.
Measured over 300 generated lessons: 5.0 retrievals per word (minimum 5), first
retrieval at a mean lag of 2.5, immediately-next 0% of the time — against §1's
1.8 retrievals and 6.9-slot gap.

Two things this level shows that the arithmetic alone does not. 你 and 好 never
reach production, because the only sentence readable at this point is the word
你好 itself; their ladder stops at a third recognition. And the very first card
of the course has no two-way check, because with nothing else known yet there is
no second meaning to offer.

### 5.4 The introduction is an exercise (gap 2)

`meet` stops being a slide. The card keeps its word, pinyin, meaning and
component breakdown, and then asks for one tap: the same word's meaning among
**two** options. It cannot meaningfully be failed, which is the point — Duolingo
introduces characters through matching, with the answer on screen, rather than
through a card that asks nothing. **[doc]**

- The card still calls `start()`, not `grade()`: a 2-option tap is not evidence.
  An introduction now grades **nothing** at the end of the lesson either. It
  used to: a `meet` card carried the word's card key, so `finish` graded it
  `Good` for having been looked at, which is part of why a word met and never
  drilled came out of a lesson looking learned.
- It does **not** count toward `MIN_RETRIEVALS`, and `tools/exposure-report.mjs`
  does not count it as a retrieval. Whether it is worth more than that is §7.1.
- A wrong tap shows the right answer and re-queues the card like any other.
- The wrong meaning comes from this lesson's own words. The very first card of
  the course has no second meaning available, so it keeps the plain *Got it*.

### 5.5 Exposure counting and the lifetime budget (gaps 4, 7)

§3.4 wants roughly ten retrievals per word. `MIN_RETRIEVALS` gets three inside
the teaching lesson; the rest have to accumulate across review levels and the
Practice hub, and until now nothing tracked whether they did. FSRS exposes
stability and a `reps` count but does not take exposure as an input the way
Duolingo's HLR does. **[doc]**

So the store gains a counter, and `VERSION` goes to 3:

```js
store.exposure = {}          // '<id>:<kind>' -> active retrievals, lifetime
countExposure(id, kind, n)   // called from lesson.js:finish
exposureOf(id, kind)
```

- Counted once per *answered attempt* of an active retrieval, so a re-queued
  item counts twice. Introductions and read-only appearances count zero.
- `v: 1` and `v: 2` records migrate by adding `exposure: {}`. Existing FSRS
  cards keep working; a word learned before the bump simply starts from zero,
  which biases review toward it — acceptable, and self-correcting.
- The FSRS card object is left alone. The counter is a sibling map, not a field
  on the card, so `ts-fsrs` never sees it.

The generator uses it in one place: **review items are ordered by lifetime
exposure, lowest first**, among those otherwise eligible. That turns "about ten
encounters" from a hope into a bias, without pretending to be a second
scheduler.

One pass through all five levels of `b1l1` now yields 7 to 21 active retrievals
per word, median around 15, before the Practice hub adds any. The words in the
last batch trail — they get three levels of exposure rather than five — which
is the honest cost of batching and what the exposure ordering exists to soften.

### 5.6 A hint, priced (gap 6)

The writing track already grades a hinted card `Again`. The reading track had
no hint at all, so its only move when unsure was a blind tap into four tiles
with a 25% payout. One `Hint` button in the lesson footer, per-type behaviour:

| exercise | hint | why not more |
| --- | --- | --- |
| `selectMeaning` (hanzi → meaning) | reveals the pinyin | the meaning *is* the answer |
| `selectHanzi` (pinyin + meaning → hanzi) | removes one wrong tile | the prompt already shows everything but the answer |
| `cloze` | removes one wrong tile | same |
| `bankZh` | reveals the target's pinyin | tiles are already visible |

Grading, in `ratingFor`:

| outcome | rating |
| --- | --- |
| clean, no hint | `Good` |
| clean, hinted | `Hard` |
| one miss | `Hard` |
| hinted and missed, or two or more misses | `Again` |

This mirrors the writing track and makes the FSRS signal honest, which today it
is not: a lucky one-in-four tap currently reads as `Good`.

### 5.7 `match` grades per word (bug found in §1)

`match` covers four words but grades them off one miss counter, so a single
mis-tapped pair marks all four `Again`. The maker now carries
`ex.wrongBy` — a per-word miss count — and a wrong tap is attributed to the
left-hand word the learner had selected, which is the word they did not know.
`js/lesson.js:finish` prefers `wrongBy` over the exercise-level count when it
is present. Re-queue behaviour is unchanged: any wrong pair still means the
exercise comes round again.

### 5.8 Invariants the test suite asserts

`tools/check.mjs` already asserts a generated lesson is *playable*. It now also
asserts it is *teachable*, over seeded runs of every ready unit at every level:

1. `unit.intro` flattens to `unit.words`, in order, and
   `unit.levels === unit.intro.length + REVIEW_LEVELS`.
2. A teaching level introduces exactly its batch; a review level introduces
   nothing.
3. Every introduced word gets at least `MIN_RETRIEVALS` active retrievals.
4. Its first retrieval lands within `NEAR` slots of its introduction.
5. At least one retrieval lands `FAR` or more slots after it.
6. No word reaches production before a recognition retrieval.
7. No exercise type exceeds `TYPE_CAP`.
8. No course word appears on screen — as prompt, tile, distractor or sentence
   token — before the level that teaches it, or before its own introduction
   inside that lesson.
9. A hint costs a grade: clean is `Good`, hinted is `Hard`, hinted and missed
   is `Again`.

`tools/exposure-report.mjs` reports the same quantities as numbers rather than
assertions, and is the thing to rerun after any recipe change.

---

## 6. What we deliberately do not copy

- Duolingo's Chinese course teaches no handwriting and no stroke order; our
  writing track has no counterpart there, and none of the above applies to it.
  The writing track's exposure story is separate and, because it grades from
  stroke performance rather than a 4-option tap, does not have the guessing
  problem.
- Hearts, gems, leagues. See `PLAN.md` §2.
- Duolingo's exact type caps and its session generator's ranking are not
  published; anything specific about them in this repo is our own invention and
  should be labelled as such.

## 7. Open questions

1. **Is the two-option check after an introduction worth the tap?** It converts
   a slide into an exercise, but a 2-option meaning tap is nearly free and the
   invariants deliberately do not count it. The alternative is to introduce
   through a three-pair matching exercise, the way Duolingo's character courses
   do, and drop the separate card. Worth measuring against retention rather
   than arguing about.
2. **Should exposure feed FSRS rather than only the generator?** HLR uses total
   exposures as a model feature; FSRS takes no such input, so the count
   currently only reorders review candidates. Feeding it in would mean
   post-processing FSRS intervals, which is a bigger claim than this app should
   make without evidence.
3. **The last batch of a unit trails.** Words introduced in a unit's final
   teaching level see three levels rather than five, and land near 7 to 9
   lifetime retrievals against a `LIFETIME_TARGET` of 10. Options: an extra
   review level, or letting the next unit's review slots reach back a unit.
   Neither is obviously right; the Practice hub may already cover it.
4. **`REVIEW_LEVELS = 2` is a guess.** It is what keeps `b1l2` at four levels
   and pushes `b1l3` to six. Whether a long unit wants proportionally more
   review than a short one is untested.
5. **Books 2 and 3 will have longer units.** `b1l3`'s 11 words already need six
   levels. A 25-word lesson would need ten, which is a lot of dots on the path
   screen. Either `INTRO_CAP` rises with unit length or a unit splits into two
   path nodes.

---

## Sources

Duolingo, primary:

- Improving how Duolingo teaches Chinese and other languages (session
  generator, per-type caps, the "Tap the pairs" problem):
  https://blog.duolingo.com/improving-how-duolingo-teaches-chinese-and-other-languages
- The nuts and bolts of course creation at Duolingo (new words built on old,
  cognitive load, spiralling meanings):
  https://blog.duolingo.com/the-nuts-and-bolts-of-course-creation-at-duolingo/
- Duolingo's new method for teaching English (monolingual exercise types, each
  with one focus): https://blog.duolingo.com/how-duolingo-teaches-english/
- Duolingo's approach to writing skills (scaffolding, word banks, keyboard
  toggle): https://blog.duolingo.com/covering-all-the-bases-duolingos-approach-to-writing-skills/
- The Duolingo Method whitepaper (2023), five pillars incl. "learn by doing
  through interactive lessons and careful repetition":
  https://duolingo-papers.s3.amazonaws.com/reports/Duolingo_whitepaper_duolingo_method_2023.pdf
  (image-only PDF; not machine-extractable — quotes above come from secondary
  summaries, treat as weaker than the blog posts)
- Duolingo Research index: https://research.duolingo.com/
- Settles & Meeder, *A Trainable Spaced Repetition Model for Language Learning*,
  ACL 2016 (Half-Life Regression):
  https://research.duolingo.com/papers/settles.acl16.pdf — code at
  https://github.com/duolingo/halflife-regression
- Guide to the Duolingo Practice Hub:
  https://blog.duolingo.com/guide-to-duolingo-practice-hub/
- How are Duolingo courses evolving (CEFR alignment, ~800 words per level):
  https://blog.duolingo.com/how-are-duolingo-courses-evolving

Duolingo, community documentation:

- Duolingo Wiki, *Exercise* (exercise-type catalogue, ~15 exercises per lesson):
  https://duolingo.fandom.com/wiki/Exercise
- Duolingo Wiki, *Words*: https://duolingo.fandom.com/wiki/Words
- Duolingo/Structure: https://en.namu.wiki/w/%EB%93%80%EC%98%A4%EB%A7%81%EA%B3%A0/%EA%B5%AC%EC%A1%B0
- Unofficial course data (tree sizes, words per unit): https://duolingodata.com/
  and the Chinese tree: https://duolingodata.com/dat/zhfen130.html
- Dotted-underline hints, and their absence in Legendary:
  https://lingoly.io/make-duolingo-harder/
- Duolingo Chinese review, the standing criticisms:
  https://www.alllanguageresources.com/duolingo-chinese-review/

Learning science:

- Roediger & Karpicke (2006), *Test-enhanced learning: Taking memory tests
  improves long-term retention*, Psychological Science 17(3), 249–255:
  https://pubmed.ncbi.nlm.nih.gov/16507066/
- Roediger & Karpicke (2006), *The Power of Testing Memory*, Perspectives on
  Psychological Science 1(3), 181–210.
- Karpicke & Roediger (2007), *Expanding Retrieval Practice Promotes Short-Term
  Retention, but Equally Spaced Retrieval Enhances Long-Term Retention*,
  JEP:LMC: https://learninglab.psych.purdue.edu/downloads/2007/2007_Karpicke_Roediger_JEPLMC.pdf
- Kang, Lindsey, Mozer & Pashler (2014), *Retrieval practice over the long term:
  should spacing be expanding or equal-interval?*, Psychon Bull Rev:
  https://laplab.ucsd.edu/articles/In%20press%20version/Kang_etal_PBR2014.pdf
- Pimsleur (1967), *A Memory Schedule*, Modern Language Journal 51(2)
  (graduated interval recall; 5s / 25s / 2min / 10min / 1hr / 5hr / 1d / 5d /
  25d / 4mo / 2yr): https://files.eric.ed.gov/fulltext/ED012150.pdf
- Webb (2007), *The effects of repetition on vocabulary knowledge* / *The
  effects of context on incidental vocabulary learning*, Reading in a Foreign
  Language: https://files.eric.ed.gov/fulltext/EJ815123.pdf
- Uchihara, Webb & Yanagisawa (2019), *The effects of repetition on incidental
  vocabulary learning: a meta-analysis*, Language Teaching:
  https://www.cambridge.org/core/journals/language-teaching/article/how-effective-is-second-language-incidental-vocabulary-learning-a-metaanalysis/E38E3468FD2090B1FA3051051DE8E70C
- Stewart, Gyllstad, Nicklin & McLean (2024), meaning recall vs meaning
  recognition as distinct constructs, Language Testing:
  https://journals.sagepub.com/doi/full/10.1177/02655322231162853
- Sevigny, Mack, Stilp & Berger (2024), moving high-frequency vocabulary from
  recognition to recall (the MC → gap-fill → translation → writing ladder):
  https://journals.sagepub.com/doi/10.1177/21582440241242604

Measured in this repo:

- `tools/exposure-report.mjs` — per-word active-retrieval counts and
  introduction-to-retrieval lag for any unit and level.
