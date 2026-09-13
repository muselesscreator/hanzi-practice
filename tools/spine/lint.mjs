#!/usr/bin/env node
/**
 * Validates the textbook spine (tools/spine/book-N.json) before it is built.
 *
 * build-course.mjs and check.mjs enforce the same invariants, but only after a
 * full build, and they point at generated unit/sentence ids. This points at the
 * spine itself — book, lesson, and the offending word/grammar/sentence — so a
 * book being authored fails fast with a per-item error rather than after all of
 * its sentences are written.
 *
 * The rules mirror the build: a word needs a gloss and a syllable-broken pinyin
 * override; a sentence's tokens must rebuild its hanzi and may only use words
 * taught by its own lesson or an earlier one (cumulatively across books, in
 * book order); a grammar point needs a pattern and a tip; ids do not repeat.
 *
 * Read-only. It never writes the spine — marking a book `verified` is the
 * author's deliberate act, not a side effect of a clean lint.
 *
 * Usage:
 *   node tools/spine/lint.mjs            # lint every book
 *   node tools/spine/lint.mjs 2          # report only book 2's problems
 *   node tools/spine/lint.mjs 2 3        # report only books 2 and 3
 * Exits non-zero if any reported book has a problem.
 *
 * The w()/g()/s() builders below are the ones the authoring scripts use, so a
 * generator can `import { w, g, s } from '../spine/lint.mjs'` instead of
 * redefining them and drifting from this schema.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SPINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const CJK = /[一-鿿]/;
// The same punctuation build-course.mjs strips before checking that tokens
// rebuild a sentence; keep the two in step or a sentence that lints clean here
// can still warn at build time.
const PUNCT = /[，。！？、：；“”‘’]/g;

// word:    { word, gloss, pinyin?, star? }
// grammar: { id, title, pattern, tip, source, ... }
// sentence: s(zh, tokens, pinyin, en, enTokens, grammar?)
export const w = (word, gloss, extra = {}) => ({ word, gloss, ...extra });
export const g = (id, title, pattern, tip, extra = {}) => ({ id, title, pattern, tip, source: 'authored', ...extra });
export const s = (zh, tokens, pinyin, en, enTokens, grammar) => {
  const o = { zh, tokens, pinyin, en, enTokens };
  if (grammar) o.grammar = grammar;
  return o;
};

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const syllables = (word) => [...word].filter((c) => CJK.test(c)).length;

// Every book on disk, in the order build-course reads them, so the cumulative
// taught set a later book leans on is the same one the build would see.
export function loadBooks() {
  return fs
    .readdirSync(SPINE)
    .filter((f) => /^book-\d+\.json$/.test(f))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(SPINE, f), 'utf8')));
}

/**
 * Walks every book in order, accumulating taught words and grammar ids, and
 * collects problems keyed by book number. `report` limits which books' problems
 * come back; the walk always covers every book so cross-book coverage is real.
 */
export function lintBooks(books, report = null) {
  const wanted = report ? new Set(report.map(Number)) : null;
  const problems = [];
  const taughtWords = new Set(); // word string -> taught by now
  const grammarIds = new Map(); // grammar id -> "book N lesson L" that defined it
  const wordSeen = new Map(); // word string -> where first introduced

  for (const book of books) {
    const on = wanted === null || wanted.has(Number(book.book));
    const at = (lesson, tail) => `book ${book.book} lesson ${lesson}${tail ? ` ${tail}` : ''}`;
    const fail = (msg) => on && problems.push(msg);

    if (typeof book.book !== 'number') fail(`book "${book.title ?? '?'}" has no numeric "book" field`);
    if (!nonEmpty(book.title)) fail(`book ${book.book} has no title`);
    if (!Array.isArray(book.lessons) || book.lessons.length === 0) {
      fail(`book ${book.book} has no lessons`);
      continue;
    }

    book.lessons.forEach((lesson, i) => {
      if (lesson.lesson !== i + 1) {
        fail(at(lesson.lesson ?? '?', `is out of order (expected lesson ${i + 1})`));
      }
      for (const arr of ['words', 'grammar', 'sentences']) {
        if (!Array.isArray(lesson[arr])) fail(at(lesson.lesson, `has no ${arr} array`));
      }

      for (const spec of lesson.words ?? []) {
        if (!nonEmpty(spec.word)) fail(at(lesson.lesson, `has a word with no hanzi`));
        if (!nonEmpty(spec.gloss)) fail(at(lesson.lesson, `word "${spec.word}" has no gloss`));
        if (spec.pinyin && syllables(spec.word) > 1 && !/[\s'·]/.test(spec.pinyin.trim())) {
          fail(at(lesson.lesson, `word "${spec.word}" pinyin "${spec.pinyin}" has no syllable break — tones will be wrong`));
        }
        if (wordSeen.has(spec.word)) {
          fail(at(lesson.lesson, `word "${spec.word}" is introduced again (already in ${wordSeen.get(spec.word)})`));
        } else {
          wordSeen.set(spec.word, at(lesson.lesson));
        }
        // Taught from this lesson on, so a sentence in the same lesson may use it.
        taughtWords.add(spec.word);
      }

      for (const point of lesson.grammar ?? []) {
        if (!nonEmpty(point.id)) fail(at(lesson.lesson, `has a grammar point with no id`));
        if (!nonEmpty(point.title)) fail(at(lesson.lesson, `grammar "${point.id}" has no title`));
        if (!nonEmpty(point.pattern)) fail(at(lesson.lesson, `grammar "${point.id}" has no pattern`));
        if (!nonEmpty(point.tip)) fail(at(lesson.lesson, `grammar "${point.id}" has no tip`));
        if (grammarIds.has(point.id)) {
          fail(at(lesson.lesson, `grammar "${point.id}" is a duplicate id (already in ${grammarIds.get(point.id)})`));
        } else if (nonEmpty(point.id)) {
          grammarIds.set(point.id, at(lesson.lesson));
        }
      }

      (lesson.sentences ?? []).forEach((sent, si) => {
        const where = at(lesson.lesson, `sentence ${si + 1} "${sent.zh ?? '?'}"`);
        if (!nonEmpty(sent.zh)) fail(`${where} has no zh`);
        if (!Array.isArray(sent.tokens) || sent.tokens.length === 0) {
          fail(`${where} has no tokens`);
          return;
        }
        if (!nonEmpty(sent.pinyin)) fail(`${where} has no pinyin`);
        if (!nonEmpty(sent.en)) fail(`${where} has no English`);

        const joined = sent.tokens.join('');
        const bare = (sent.zh ?? '').replace(PUNCT, '');
        if (joined !== bare) fail(`${where} tokens "${joined}" do not rebuild "${bare}"`);

        const untaught = sent.tokens.filter((t) => !taughtWords.has(t));
        if (untaught.length) fail(`${where} uses words not yet taught: ${untaught.join(' ')}`);

        for (const gid of sent.grammar ?? []) {
          if (!grammarIds.has(gid)) fail(`${where} tags unknown grammar point "${gid}"`);
        }
      });
    });
  }

  return problems;
}

// Run as a script: lint, print per-item problems, exit non-zero if any.
if (import.meta.url === `file://${process.argv[1]}`) {
  const report = process.argv.slice(2).length ? process.argv.slice(2) : null;
  const books = loadBooks();
  if (!books.length) {
    console.error(`no book-N.json files in ${SPINE}`);
    process.exit(1);
  }
  const problems = lintBooks(books, report);
  const scope = report ? `book(s) ${report.join(', ')}` : `${books.length} book(s)`;
  if (problems.length) {
    console.error(`${problems.length} problem(s) in ${scope}:\n` + problems.map((p) => `  - ${p}`).join('\n'));
    process.exit(1);
  }
  console.log(`spine lint clean: ${scope}`);
}
