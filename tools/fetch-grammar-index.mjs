#!/usr/bin/env node
/**
 * Rebuilds tools/cache/asg-hsksc-citations.json: which grammar points the
 * AllSet Learning Chinese Grammar Wiki cites against which page of which
 * HSK Standard Course book. build-course.mjs reads it to stamp a `page` and
 * a `wikiUrl` onto grammar points that name a `wikiRef`.
 *
 * Source: ivankra/asg, a crawl of the wiki's article source. Each article
 * ends with {{Source|HSK Standard Course N|page}} lines; that is the whole
 * mapping we take. Wiki content is CC BY-NC-SA 3.0 (AllSet Learning) — see
 * the licensing table in the README.
 *
 * Usage: node tools/fetch-grammar-index.mjs [--dir=<a local asg checkout>]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools', 'cache', 'asg-hsksc-citations.json');
const REPO = 'https://github.com/ivankra/asg.git';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

let dir = args.dir;
let temp = null;
if (!dir) {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'asg-'));
  dir = path.join(temp, 'asg');
  process.stdout.write(`cloning ${REPO}\n`);
  execFileSync('git', ['clone', '--depth', '1', '--quiet', REPO, dir], {
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

const wiki = path.join(dir, 'wiki');
if (!fs.existsSync(wiki)) throw new Error(`no wiki/ directory under ${dir}`);

const CITE = /\{\{Source\|HSK Standard Course ([123])[上下]?\s*\|\s*([0-9\-, ]+)\}\}/g;
const out = [];
for (const file of fs.readdirSync(wiki)) {
  if (!file.endsWith('.txt')) continue;
  const text = fs.readFileSync(path.join(wiki, file), 'utf8');
  const title = (text.match(/^<!--\s*(.*?)\s*-->/) ?? [])[1] ?? null;
  for (const m of text.matchAll(CITE)) {
    out.push({
      book: Number(m[1]),
      page: parseInt(m[2], 10),
      title,
      id: file.replace(/\.txt$/, ''),
    });
  }
}
out.sort((a, b) => a.book - b.book || a.page - b.page || a.id.localeCompare(b.id));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
if (temp) fs.rmSync(temp, { recursive: true, force: true });

const byBook = {};
for (const c of out) byBook[c.book] = (byBook[c.book] ?? 0) + 1;
process.stdout.write(
  `${out.length} citations -> tools/cache/asg-hsksc-citations.json\n` +
    Object.entries(byBook).map(([b, n]) => `  Book ${b}: ${n}\n`).join('')
);
