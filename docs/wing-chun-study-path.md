# Wing Chun / Ving Tsun — study-path research

A researched glossary and a proposed study path for adding Ving Tsun (詠春)
kwoon vocabulary to hanzi-practice, tuned to the **Wong Shun Leung (WSL)
lineage** as taught at **Shun Mo Scientific Ving Tsun**.

- **What this is:** ~73 verified terms (characters + both romanizations +
  gloss), sequenced into 10 lessons, plus notes on how to wire it into the
  `tools/spine/` builder.
- **Goal is conversational, not calligraphic.** The point is to recognize a
  term and know what it means and how it's said — not to hand-write the
  characters. This path **turns the writing track off** (see
  [§4](#4-how-it-maps-onto-the-spine-builder)); handwriting and reading drills
  are deliberately skipped.
- **Fastest path to a working deck:** copy the `book-101.json` skeleton in
  [§4](#4-how-it-maps-onto-the-spine-builder) and drop the Lesson 1 word list
  from [§3](#3-proposed-study-path-10-lessons) into it, then
  `npm run build:course`.

---

## 0. Read this first: these terms are Cantonese, not Mandarin

Wing Chun is a **southern Chinese art** (Foshan → Hong Kong). Its whole
vocabulary is **Cantonese**, and that is what you hear on the floor — not the
Mandarin pinyin this app is built around. Three consequences that shape
everything below:

1. **The pinyin the app shows will not be what your Sifu says.** 膀手 is
   *bong2 sau2* ("Bong Sau") in the kwoon but reads *bǎng shǒu* in Mandarin.
   The glossary carries **both** columns so you can map the sound you hear to
   the correct character. The app's schema only has a Mandarin `pinyin` field
   (see [§4](#4-how-it-maps-onto-the-spine-builder) for the gap and two ways to
   handle it).
2. **A few characters read *differently* in the two languages.** e.g. 甩 (as in
   Lat Sau) is Cantonese *lat1* "to let go / come loose" — the intended sense —
   but Mandarin *shuǎi* "to swing/fling off." The gloss follows the Cantonese
   meaning.
3. **Dojo spellings predate Jyutping** and are ad-hoc ("Chum Kiu," "Huen Sau"),
   so they drift from strict Jyutping. Both are given.

**"Ving Tsun" vs "Wing Chun" vs "Wing Tsun":** all romanize the same 詠春.
*Wing Chun* is the generic spelling. *Ving Tsun* is the Hong Kong Ip Man
establishment spelling — the **Ving Tsun Athletic Association (VTAA)**, Ip Chun,
Ip Ching, and the **Wong Shun Leung lineage** — i.e. your school's house
spelling. *Wing Tsun* (WT/EWTO) is Leung Ting's trademark. Technique names are
still commonly written "Wing Chun style" regardless.

**Column legend:** 繁 = Traditional · 简 = Simplified (blank = same as
traditional) · Jyutping = strict Cantonese (numbers = tones) · Dojo = common
English spelling · Pinyin = Mandarin, reference only.

---

## 1. The verified glossary

### A. The system & the forms

| Dojo | 繁 | 简 | Jyutping | Pinyin | Meaning / literal |
|---|---|---|---|---|---|
| Wing Chun / Ving Tsun | 詠春 | 咏春 | wing6 ceon1 | yǒng chūn | "praising spring" — the art itself |
| Siu Nim Tau | 小念頭 | 小念头 | siu2 nim6 tau4 | xiǎo niàn tou | "little idea" — 1st form, structure & centerline |
| Chum Kiu | 尋橋 | 寻桥 | cam4 kiu4 | xún qiáo | "seeking the bridge" — 2nd form, turning & stepping |
| Biu Jee | 標指 | 标指 | biu1 zi2 | biāo zhǐ | "thrusting fingers" — 3rd form, recovery & emergency |
| Muk Yan Jong | 木人樁 | 木人桩 | muk6 jan4 zong1 | mù rén zhuāng | "wooden man post" — the dummy |
| Baat Cham Dao | 八斬刀 | 八斩刀 | baat3 zaam2 dou1 | bā zhǎn dāo | "eight-slashing knives" — butterfly swords |
| Luk Dim Boon Kwun | 六點半棍 | 六点半棍 | luk6 dim2 bun3 gwan3 | liù diǎn bàn gùn | "six-and-a-half point pole" — the long pole |

### B. Hand techniques (手法)

| Dojo | 繁 | 简 | Jyutping | Pinyin | Meaning / literal |
|---|---|---|---|---|---|
| Tan Sau | 攤手 | 摊手 | taan1 sau2 | tān shǒu | "spreading hand" — palm-up receiving arm |
| Bong Sau | 膀手 | | bong2 sau2 | bǎng shǒu | "wing arm" — elbow-up deflection / recovery |
| Fook Sau | 伏手 | | fuk6 sau2 | fú shǒu | "subduing hand" — bridging-on-top control |
| Wu Sau | 護手 | 护手 | wu6 sau2 | hù shǒu | "guarding hand" — rear centerline guard |
| Pak Sau | 拍手 | | paak3 sau2 | pāi shǒu | "slapping hand" — lateral clear |
| Lap Sau | 擸手 | 拉手 | laap3 sau2 | liè shǒu | "grabbing/pulling hand" — jerking pull (char flag §2) |
| Jut Sau | 窒手 | | zat6 sau2 | zhì shǒu | "jerking hand" — short shocking snap |
| Gaan Sau | 耕手 | | gaang1 sau2 | gēng shǒu | "ploughing hand" — diagonal splitting block |
| Huen Sau | 圈手 | | hyun1 sau2 | quān shǒu | "circling hand" — wrist circle to change line |
| Jum Sau | 枕手 | | zam2 sau2 | zhěn shǒu | "sinking hand" — downward forearm pressure |
| Kwan Sau | 綑手 | 捆手 | kwan2 sau2 | kǔn shǒu | "binding hand" — combined bong+tan rotation |
| Gum Sau | 撳手 | 揿手 | gam6 sau2 | qìn shǒu | "pressing hand" — flat downward pin |
| Man Sau | 問手 | 问手 | man6 sau2 | wèn shǒu | "asking hand" — lead seeking hand |
| Laan Sau | 攔手 | 拦手 | laan4 sau2 | lán shǒu | "barring hand" — horizontal forearm bar |
| Yan Sau | 印手 | | jan3 sau2 | yìn shǒu | "stamping hand" — sealing/pinning press |
| Got Sau | 割手 | | got3 sau2 | gē shǒu | "cutting hand" — slicing deflection |

### C. Strikes & kicks

| Dojo | 繁 | 简 | Jyutping | Pinyin | Meaning / literal |
|---|---|---|---|---|---|
| Yat Ji Chung Kuen | 日字衝拳 | 日字冲拳 | jat6 zi6 cung1 kyun4 | rì zì chōng quán | "sun-character thrust punch" — the vertical punch |
| Lin Wan Kuen | 連環拳 | 连环拳 | lin4 waan4 kyun4 | lián huán quán | "linked fists" — chain punching |
| Jeung | 掌 | | zoeng2 | zhǎng | "palm" — generic palm strike |
| Jing Jeung | 正掌 | | jing3 zoeng2 | zhèng zhǎng | "front palm" — forward palm on centerline |
| Wang Jeung | 橫掌 | 横掌 | waang4 zoeng2 | héng zhǎng | "side palm" — lateral palm |
| Dai Jeung | 底掌 | | dai2 zoeng2 | dǐ zhǎng | "bottom palm" — upward heel-of-palm |
| Jik Tek | 直踢 | | zik6 tek3 | zhí tī | "straight kick" — front thrusting kick |
| Wang Tek | 橫踢 | 横踢 | waang4 tek3 | héng tī | "horizontal kick" — side/stamping kick |
| Jarn | 踭 | | zaang1 | zhēng | "elbow" (char flag §2); strikes: 批踭 pai jarn, 跪踭 gwai jarn |

### D. Stances & footwork (馬步)

| Dojo | 繁 | 简 | Jyutping | Pinyin | Meaning / literal |
|---|---|---|---|---|---|
| Yee Jee Kim Yeung Ma | 二字鉗羊馬 | 二字钳羊马 | ji6 zi6 kim4 joeng4 maa5 | èr zì qián yáng mǎ | "char-'2' goat-clamping stance" — the basic stance |
| Ma Bou | 馬步 | 马步 | maa5 bou6 | mǎ bù | "horse stance" — stance, generically |
| Biu Ma | 標馬 | 标马 | biu1 maa5 | biāo mǎ | "thrusting stance" — driving shuffle-step |
| Huen Ma | 圈馬 | 圈马 | hyun1 maa5 | quān mǎ | "circling step" — angle-changing footwork |
| Juen Ma | 轉馬 | 转马 | zyun3 maa5 | zhuǎn mǎ | "turning stance" — the heel pivot (Chum Kiu) |
| Seung Ma | 上馬 | 上马 | soeng5 maa5 | shàng mǎ | "advancing stance" — step in |
| Tui Ma | 退馬 | 退马 | teoi3 maa5 | tuì mǎ | "retreating stance" — step back (char flag §2) |

### E. Concepts & principles

| Dojo | 繁 | 简 | Jyutping | Pinyin | Meaning / literal |
|---|---|---|---|---|---|
| Chi Sau | 黐手 | | ci1 sau2 | chī shǒu | "sticking hands" — the sensitivity drill |
| Lat Sau | 甩手 | | lat1 sau2 | shuǎi shǒu | "freed hand" — contact lost (Canto/Mand differ, §0) |
| Chung Sin | 中線 | 中线 | zung1 sin3 | zhōng xiàn | "centerline" — prime target & defense line |
| Chiu Min Jeui Ying | 朝面追形 | | ciu4 min6 zeoi1 jing4 | cháo miàn zhuī xíng | "face the foe, chase the form" |
| Ji Ng Sin | 子午線 | 子午线 | zi2 ng5 sin3 | zǐ wǔ xiàn | "meridian axis" — the central vertical axis |
| Loi Lau Hui Sung | 來留去送 | 来留去送 | loi4 lau4 heoi3 sung3 | lái liú qù sòng | "what comes, retain; what leaves, send off" |
| Lat Sau Jik Chung | 甩手直衝 | 甩手直冲 | lat1 sau2 zik6 cung1 | shuǎi shǒu zhí chōng | "hand freed → thrust straight in" |
| Chun Ging | 寸勁 | 寸劲 | cyun3 ging6 | cùn jìn | "inch power" — short-range explosive force |
| Je Lik | 借力 | | ze3 lik6 | jiè lì | "borrowing force" — use the opponent's own force |

### F. Kwoon (school) & people

| Dojo | 繁 | 简 | Jyutping | Pinyin | Meaning / literal |
|---|---|---|---|---|---|
| Sifu | 師父 | 师父 | si1 fu6 | shī fù | "teacher-father" — your own teacher (via discipleship) |
| Sifu (generic) | 師傅 | 师傅 | si1 fu6 | shī fu | "master" — any skilled master/tradesman (flag §2) |
| Sigung | 師公 | 师公 | si1 gung1 | shī gōng | "grand-teacher" — your Sifu's Sifu |
| Sihing | 師兄 | 师兄 | si1 hing1 | shī xiōng | "senior kung-fu brother" |
| Sidai | 師弟 | 师弟 | si1 dai6 | shī dì | "junior kung-fu brother" |
| Sije | 師姐 | 师姐 | si1 ze2 | shī jiě | "senior kung-fu sister" |
| Simui | 師妹 | 师妹 | si1 mui6 | shī mèi | "junior kung-fu sister" |
| To Dai | 徒弟 | | tou4 dai6 | tú dì | "disciple / student" |
| Kwoon | 武館 | 武馆 | mou5 gun2 | wǔ guǎn | "martial-arts hall" — the school |
| Bai Si | 拜師 | 拜师 | baai3 si1 | bài shī | "to bow to a master" — the discipleship ceremony |
| Kung Fu | 功夫 | | gung1 fu1 | gōng fu | "skill from effort" — martial arts generally |
| Kuen | 拳 | | kyun4 | quán | "fist / boxing / style" (as in 詠春拳) |
| Tou Lou | 套路 | | tou3 lou6 | tào lù | "form / routine" — a solo set |
| Dui Chaak | 對拆 | 对拆 | deoi3 caak3 | duì chāi | "paired dismantling" — partner application drills |
| Bao Kuen Lai | 抱拳禮 | 抱拳礼 | pou5 kyun4 lai5 | bào quán lǐ | "fist-wrapping salute" — palm over fist |

### G. WSL / free-fighting terms

| Dojo | 繁 | 简 | Jyutping | Pinyin | Meaning / literal |
|---|---|---|---|---|---|
| Gor Sau | 過手 | 过手 | gwo3 sau2 | guò shǒu | "crossing hands" — free rolling beyond fixed chi-sau |
| Luk Sau | 碌手 | 碌手 | luk1 sau2 | lù shǒu | "rolling arms" — the rolling drill (also 盤手 poon sau) |
| Daan Chi Sau | 單黐手 | 单黐手 | daan1 ci1 sau2 | dān chī shǒu | "single sticking hand" |
| Seung Chi Sau | 雙黐手 | 双黐手 | soeng1 ci1 sau2 | shuāng chī shǒu | "double sticking hand" |
| Mai Jarn | 埋踭 | | maai4 zaang1 | mái zhēng | "closing the elbow" — WSL elbow-to-centerline theory |
| Tan Da | 攤打 | 摊打 | taan1 daa2 | tān dǎ | "tan + strike" — simultaneous defend-and-punch |
| Bong Da | 膀打 | | bong2 daa2 | bǎng dǎ | "bong + strike" — simultaneous defend-and-strike |

---

## 2. Character flags — where sources disagree

Confirm these with your Sifu; lineages genuinely differ on the character even
when the technique is identical. For the app, pick one character per term and
be consistent.

1. **Lap Sau — 擸手 vs 拉手.** 擸 (*laap3*, "to grab/gather") matches the sound
   and action and is the technically precise choice; 拉 (*laai1*, "to pull") is
   the everyday character Wikipedia uses. Both are seen. Recommend **擸手**.
2. **Elbow — 踭 vs 睜.** 踭 (*zaang1*, "heel/elbow") is correct; 睜 ("open the
   eyes wide") is a widespread homophone substitute. Use **踭**.
3. **Gum Sau — 撳 / 揿 / 㨟.** 撳 (*gam6*, "to press") is standard; 揿 is its
   simplified form; 㨟 is a rarer variant. Use **撳手 / 揿手**.
4. **Tui Ma — 退馬 vs 推馬.** 退 (*teoi3*, "retreat") is correct for stepping
   back; 推 (*teoi1*, "push") is a different, near-homophone concept — don't
   conflate.
5. **Kwan Sau — 綑手 / 捆手.** Same word; 綑 traditional, 捆 common/simplified.
6. **Chung Kuen — 衝 vs 沖/冲.** 衝 ("thrust/rush") is correct in 日字衝拳; 沖 is
   a common substitute.
7. **Sifu — 師傅 vs 師父.** Both said "Sifu," but not interchangeable: 師傅 =
   generic skilled master; **師父** ("teacher-father") = your own teacher after
   discipleship. A discipled WSL student properly writes 師父.
8. **藕手 ("Ngau Sau")** — could **not** be verified as standard in any
   reference; likely a local colloquialism. The standard rolling-drill terms
   are 碌手 (Luk Sau) / 盤手 (Poon Sau). Omitted from the path — confirm the
   character with your Sifu if your school uses it.

---

## 3. Proposed study path (10 lessons)

Sequenced by **what you hear first and most often**, not by category — people
and etiquette come before rare knife-form vocabulary. Each lesson is ~6–8
terms, matching the app's default lesson size. Multi-character terms count as
one vocab item but feed every character into the writing track.

| # | Lesson | Terms | Why here |
|---|---|---|---|
| 1 | People & the school | 師父, 師兄, 師弟, 師姐, 師妹, 師公, 徒弟, 武館 | The words you use before class even starts |
| 2 | The art & etiquette | 詠春, 功夫, 拳, 套路, 對拆, 拜師, 抱拳禮, 馬步 | Names the thing you're doing and how you bow in |
| 3 | The forms & weapons | 小念頭, 尋橋, 標指, 木人樁, 八斬刀, 六點半棍 | The named curriculum you progress through |
| 4 | Core hands (the roll) | 攤手, 膀手, 伏手, 護手, 拍手, 問手 | Tan/Bong/Fook + Wu/Pak/Man — first drills |
| 5 | More hands | 擸手, 窒手, 圈手, 枕手, 耕手, 攔手, 綑手 | Second wave of 手法 |
| 6 | Pins, cuts & palms | 撳手, 印手, 割手, 踭, 掌, 正掌, 橫掌, 底掌 | Pinning/cutting hands + the elbow + palm strikes |
| 7 | Punches & kicks | 日字衝拳, 連環拳, 直踢, 橫踢, 埋踭, 攤打, 膀打 | Offense, incl. WSL simultaneous defend-and-hit |
| 8 | Stances & footwork | 二字鉗羊馬, 標馬, 圈馬, 轉馬, 上馬, 退馬 | The stance and how you move it |
| 9 | Chi Sau family | 黐手, 單黐手, 雙黐手, 碌手, 過手, 甩手 | Sticking-hands progression up to free rolling |
| 10 | Concepts & maxims | 中線, 子午線, 朝面追形, 來留去送, 甩手直衝, 寸勁, 借力 | The theory that ties it together |

Total: **72 terms**. Lessons 9–10 are the payoff — the concept vocabulary that
makes Sifu's corrections make sense.

---

## 4. How it maps onto the spine builder

A study path in this repo is a `tools/spine/book-N.json` file consumed by
`npm run build:course` (see README → "The spine"). Add this as **`book-101.json`**
and the builder picks it up automatically.

### The schema gap: no Cantonese field

The builder resolves each word's `pinyin` from the HSK/pinyin cache and emits
one `pinyin` string per word entry — **Mandarin only**. There is no field for
Jyutping or the dojo spelling, which is the pronunciation you actually need.
Two options:

- **No-code path (do this first):** put the Cantonese in the **`gloss`**, e.g.
  `"gloss": "Bong Sau (bong2 sau2) — wing arm"`. Supply a Mandarin `pinyin`
  override per word (the cache won't have most of these characters). Works with
  zero builder changes; the deck just shows the Cantonese inside the meaning.
- **Proper path (later):** add an optional `jyutping` (and maybe `dojo`) field
  to the word schema, thread it through `build-course.mjs` into the `words`
  entries in `course.json`, and render it in the card UI. Larger change; worth
  it if this path grows.

### Turn the writing track off — this path is conversational

The goal here is recognition and speaking, not handwriting, so **don't build a
writing track for these units.** How the builder currently behaves and what to
do:

- For each new character with stroke data, `build-course.mjs` adds a writing
  card automatically (there's no per-unit opt-out yet). Characters with **no**
  stroke data are simply skipped with a warning (`no stroke data for X, left out
  of the writing track` — `build-course.mjs:344`), so the build never fails on
  a missing outline. Rare terms like **黐, 踭, 撳** will just drop out on their
  own.
- To suppress writing cleanly for the whole book, add a small guard: a
  `"track": "conversation"` flag on the book (or lesson) and, where the builder
  assembles the `writing` array (`build-course.mjs:375–382`), skip it when the
  flag is set so the unit emits `writing: []`. ~1 small edit. Until then, you
  can leave the auto-built writing cards in place and just not drill them.

### The audio caveat: the app speaks Mandarin

"Conversational" for Wing Chun means **Cantonese**, but the app's audio
(`js/audio.js`, the listen/tone exercises) uses a **Mandarin** TTS voice and
Mandarin tones. So the built-in listening exercise will pronounce these terms in
Mandarin — *not* what you hear in the kwoon. Options, cheapest first:

1. **Treat the deck as read-recognition + gloss only.** Carry the Cantonese in
   the gloss (below) and ignore the Mandarin audio for this path.
2. **Add a Cantonese voice** for these units (a `lang: "yue"` hint on the book
   so `audio.js` picks a Cantonese `SpeechSynthesis` voice when available).
   Bigger change, and browser Cantonese voice support is spotty.

### Pinyin resolution still needs overrides

Almost none of these characters (踭, 黐, 樁, 攤, 膀, 伏, 綑, 窒 …) are in the HSK
cache, so the builder can't look up even a Mandarin reading. **Supply a `pinyin`
override on every word** using the Mandarin column in §1 (the app expects a
`pinyin` string; it's reference-only here, with the spoken Cantonese in the
gloss).

### Traditional vs simplified

Since you're not writing these, character *form* matters only for on-screen
recognition. The app is simplified-based (HSK), so the **简 column** is the safe
default for the `word` field — but Wing Chun is traditionally written in the 繁
forms, so if you'd rather see what appears on kwoon certificates and posters,
use 繁. Pick one and stay consistent. Where 简 is blank in §1, the two are
identical.

### Drop-in skeleton

```json
{
  "book": 2,
  "title": "Ving Tsun Kwoon Vocabulary",
  "publisher": "Shun Mo Scientific Ving Tsun (WSL lineage)",
  "verified": false,
  "verifyNote": "Cantonese terms compiled from public glossaries (CantoDict, Wiktionary, Wikipedia glossary of Wing Chun terms) and cross-checked; NOT confirmed against the school's own materials. Character choices flagged in docs/wing-chun-study-path.md §2 need a Sifu's confirmation. pinyin fields are Mandarin (reference); dojo pronunciation is Cantonese, carried in the gloss.",
  "lessons": [
    {
      "lesson": 1,
      "title": "師父同武館",
      "titlePinyin": "si1 fu6 tung4 mou5 gun2",
      "titleEn": "Teachers and the school",
      "topic": "The people in a kwoon and what you call them",
      "words": [
        { "word": "师父", "pinyin": "shī fù", "gloss": "Sifu (si1 fu6) — your own teacher, 'teacher-father'" },
        { "word": "师兄", "pinyin": "shī xiōng", "gloss": "Sihing (si1 hing1) — senior kung-fu brother" },
        { "word": "师弟", "pinyin": "shī dì", "gloss": "Sidai (si1 dai6) — junior kung-fu brother" },
        { "word": "师姐", "pinyin": "shī jiě", "gloss": "Sije (si1 ze2) — senior kung-fu sister" },
        { "word": "师妹", "pinyin": "shī mèi", "gloss": "Simui (si1 mui6) — junior kung-fu sister" },
        { "word": "师公", "pinyin": "shī gōng", "gloss": "Sigung (si1 gung1) — your Sifu's Sifu" },
        { "word": "徒弟", "pinyin": "tú dì", "gloss": "To Dai (tou4 dai6) — disciple / student" },
        { "word": "武馆", "pinyin": "wǔ guǎn", "gloss": "Kwoon (mou5 gun2) — the martial-arts hall" }
      ],
      "grammar": [],
      "sentences": []
    }
  ]
}
```

Fill lessons 2–10 the same way from the tables in §1 and §3. `grammar` and
`sentences` can stay empty, or you can author concept notes as grammar entries
(e.g. a `g:centerline` tip explaining 中線) the way HSK grammar points work.

---

## 5. Sourcing & confidence

Characters, Jyutping, and pinyin were cross-checked against CantoDict,
Wiktionary, and the Wikipedia *Glossary of Wing Chun terms*; maxims and
form/technique names against Chinese-language sources (zh.wikipedia 詠春拳,
ThinkHK) and WSL-lineage material. Where reputable Wing Chun sites disagreed on
a *character* (not the technique), that term is flagged in §2.

**Solid:** all of §1 groups A–F and the readings. **Confirm with your Sifu:**
the §2 character choices (especially 擸/拉, 踭/睜, 撳/㨟) and anything specific
to Shun Mo's own curriculum names, since house materials weren't available.

Key references:
[Wikipedia — Glossary of Wing Chun terms](https://en.wikipedia.org/wiki/Glossary_of_Wing_Chun_terms) ·
[Wong Shun-leung](https://en.wikipedia.org/wiki/Wong_Shun-leung) ·
[CantoDict](http://www.cantonese.sheik.co.uk/) ·
[zh.wikipedia 詠春拳](https://zh.wikipedia.org/zh-hk/%E5%92%8F%E6%98%A5%E6%8B%B3) ·
[ThinkHK — 來留去送，甩手直衝](https://www.thinkhk.com/article/2017-09/22/23279.html) ·
[Shun Mo Scientific Ving Tsun](https://www.shunmo-vingtsun.com/english/shun-mo-scientific-ving-tsun/)
