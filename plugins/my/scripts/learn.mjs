#!/usr/bin/env node
// 학습 노트(B-3, F-3): 학습 루트 정하기, 노트 만들기, 목차·이동 링크 다시 쓰기.
// 사용: node learn.mjs root [--central]          → 학습 루트와 상태. 중앙 폴더가 필요한데 없으면 종료 코드 3
//       node learn.mjs topics [--central]        → 주제 목록(이름, 노트 수, 최근 학습일)
//       node learn.mjs new-note <주제> <이름> [--subtopic S] [--title T] [--source X …] [--tag X …] [--central]
//                                                → 양식으로 노트를 만들고, 앞뒤 링크·index.md·INDEX.md를 갱신. 만든 경로 출력
//       node learn.mjs relink <주제> [--central] → 그 주제의 이동 링크와 노트 목록, INDEX.md를 다시 쓴다
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitRoot, normalizePath, resolveConfig, suggestLearnRoot } from './config.mjs';
import { frontmatter } from './status.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NOTE_TEMPLATE = path.resolve(HERE, '..', 'templates', 'learn-note.md');
const TOPIC_TEMPLATE = path.resolve(HERE, '..', 'templates', 'learn-topic.md');
const NUM = /^(\d{2})-(.+)$/;
const NAV = /^\[목록\]\(index\.md\)/;

const pad = (n) => String(n).padStart(2, '0');
const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const slash = (p) => p.replace(/\\/g, '/');

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// 학습 루트(F-3 표). { root, kind: 'project'|'central', reason, need?: 제안값 }
export function learnRoot({ cwd = process.cwd(), central = false, env, home } = {}) {
  const proj = gitRoot(cwd);
  const cfg = resolveConfig({ cwd, env, home, root: proj });
  const v = (k) => cfg.values[k].value;
  let reason;
  if (central) reason = '중앙 지정';
  else if (!proj) reason = '프로젝트 밖(git 루트 없음)';
  else if (v('learn_target') === 'central') reason = `learn_target=central (${cfg.values.learn_target.source})`;
  else return { root: normalizePath(path.join(proj, v('project_learn_dir'))), kind: 'project', project: proj, reason: '프로젝트 학습 폴더' };
  const lr = v('learn_root');
  if (!lr) return { root: null, kind: 'central', reason, need: suggestLearnRoot({ home }) };
  return { root: normalizePath(lr), kind: 'central', reason };
}

const notesIn = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && NUM.test(e.name) && e.name.endsWith('.md')).map((e) => e.name).sort()
    : [];
const subsIn = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && NUM.test(e.name)).map((e) => e.name).sort()
    : [];
const topicsIn = (root) =>
  fs.existsSync(root)
    ? fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort()
    : [];

const titleOf = (file) => {
  const m = /^# (.+)$/m.exec(fs.readFileSync(file, 'utf8'));
  return m ? m[1].trim() : path.basename(file, '.md').replace(NUM, '$2');
};

// 주제 폴더 안 모든 노트(소주제 포함): 상대 경로 목록
function allNotes(topicDir) {
  const out = notesIn(topicDir);
  for (const s of subsIn(topicDir)) out.push(...notesIn(path.join(topicDir, s)).map((n) => `${s}/${n}`));
  return out;
}

export function topics(root) {
  return topicsIn(root).map((t) => {
    const dir = path.join(root, t);
    const notes = allNotes(dir);
    const dates = notes.map((n) => String(frontmatter(path.join(dir, n))?.updated ?? '')).filter(Boolean).sort();
    return { topic: t, notes: notes.length, subtopics: subsIn(dir).length, updated: dates.at(-1) ?? '' };
  });
}

const navLine = (list, i) =>
  ['[목록](index.md)', i > 0 ? `[← 이전](${list[i - 1]})` : null, i < list.length - 1 ? `[다음 →](${list[i + 1]})` : null]
    .filter(Boolean)
    .join(' | ');

// 노트 첫·끝 이동 링크를 목록 순서대로 다시 쓴다. 바뀐 파일 목록을 돌려준다.
function relinkFolder(dir) {
  const list = notesIn(dir);
  const changed = [];
  list.forEach((name, i) => {
    const file = path.join(dir, name);
    const text = fs.readFileSync(file, 'utf8');
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(/\r?\n/);
    const nav = navLine(list, i);
    const idx = lines.map((l, k) => (NAV.test(l) ? k : -1)).filter((k) => k >= 0);
    if (!idx.length) return;
    for (const k of [idx[0], idx.at(-1)]) lines[k] = nav;
    const next = lines.join(eol);
    if (next !== text) {
      fs.writeFileSync(file, next);
      changed.push(slash(file));
    }
  });
  return changed;
}

// index.md의 "## 노트" 절을 폴더 내용(소주제 또는 노트)으로 다시 쓴다.
function rewriteIndexList(dir) {
  const file = path.join(dir, 'index.md');
  if (!fs.existsSync(file)) return null;
  const items = [
    ...subsIn(dir).map((s) => `- [${s.replace(NUM, '$2')}](${s}/index.md)`),
    ...notesIn(dir).map((n) => `- [${titleOf(path.join(dir, n))}](${n})`),
  ];
  const text = fs.readFileSync(file, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const body = (items.length ? items : ['- 없음']).join(eol);
  const re = /(^## 노트[ \t]*\r?\n)([\s\S]*?)(?=^## |(?![\s\S]))/m;
  const next = re.test(text) ? text.replace(re, `$1${eol}${body}${eol}${eol}`) : `${text.trimEnd()}${eol}${eol}## 노트${eol}${eol}${body}${eol}`;
  if (next === text) return null;
  fs.writeFileSync(file, next);
  return slash(file);
}

export function writeIndex(root) {
  const file = path.join(root, 'INDEX.md');
  const lines = ['# 학습 목록', '', '<!-- my가 주제 폴더를 보고 다시 쓴다. 직접 고치면 덮어쓴다 -->', '', '## 주제', ''];
  const ts = topics(root);
  for (const t of ts) {
    const sub = t.subtopics ? `, 소주제 ${t.subtopics}개` : '';
    lines.push(`- [${t.topic}](${t.topic}/index.md) — 노트 ${t.notes}개${sub}${t.updated ? `, 최근 ${t.updated}` : ''}`);
  }
  if (!ts.length) lines.push('- 없음');
  const text = lines.join('\n') + '\n';
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return null;
  fs.writeFileSync(file, text);
  return slash(file);
}

export function relink(root, topic) {
  const dir = path.join(root, topic);
  if (!fs.existsSync(dir)) throw new Error(`주제 폴더가 없다: ${slash(dir)}`);
  const changed = [...relinkFolder(dir)];
  for (const s of subsIn(dir)) {
    changed.push(...relinkFolder(path.join(dir, s)));
    const r = rewriteIndexList(path.join(dir, s));
    if (r) changed.push(r);
  }
  const r = rewriteIndexList(dir);
  if (r) changed.push(r);
  const ix = writeIndex(root);
  if (ix) changed.push(ix);
  return changed;
}

const safeName = (s, what) => {
  const v = String(s ?? '').trim();
  if (!v || /[\\/:*?"<>|]/.test(v) || v === '.' || v === '..') throw new Error(`${what} 이름이 올바르지 않다: "${s}"`);
  return v;
};

function ensureIndex(dir, title, date) {
  const file = path.join(dir, 'index.md');
  if (fs.existsSync(file)) return null;
  fs.mkdirSync(dir, { recursive: true });
  const t = fs.readFileSync(TOPIC_TEMPLATE, 'utf8').replaceAll('{{title}}', title).replaceAll('{{date}}', date);
  fs.writeFileSync(file, t, { flag: 'wx' });
  return slash(file);
}

export function newNote(root, { topic, name, subtopic = '', title = '', sources = [], tags = [], now = new Date() }) {
  topic = safeName(topic, '주제');
  name = safeName(name, '노트');
  const date = today(now);
  const created = [];
  const topicDir = path.join(root, topic);
  const c1 = ensureIndex(topicDir, topic, date);
  if (c1) created.push(c1);
  let dir = topicDir;
  if (subtopic) {
    subtopic = safeName(subtopic, '소주제');
    const subs = subsIn(topicDir);
    const hit = subs.find((s) => s.replace(NUM, '$2') === subtopic || s === subtopic);
    const folder = hit ?? `${pad(subs.length ? Number(subs.at(-1).slice(0, 2)) + 1 : 1)}-${subtopic}`;
    dir = path.join(topicDir, folder);
    const c2 = ensureIndex(dir, subtopic.replace(NUM, '$2'), date);
    if (c2) created.push(c2);
  }
  const notes = notesIn(dir);
  const n = notes.length ? Number(notes.at(-1).slice(0, 2)) + 1 : 1;
  if (n > 99) throw new Error(`노트 번호가 99를 넘는다: ${slash(dir)}. 소주제로 나눈다`);
  const file = path.join(dir, `${pad(n)}-${name}.md`);
  const yamlList = (a) => `[${a.map((x) => JSON.stringify(x)).join(', ')}]`;
  const text = fs
    .readFileSync(NOTE_TEMPLATE, 'utf8')
    .replace('{{topic}}', JSON.stringify(topic))
    .replace(/^subtopic: \{\{subtopic\}\}\r?\n/m, subtopic ? `subtopic: ${JSON.stringify(subtopic.replace(NUM, '$2'))}\n` : '')
    .replace('{{tags}}', yamlList(tags))
    .replace('{{sources}}', yamlList(sources))
    .replace('{{date}}', date)
    .replace('{{title}}', title || name);
  fs.writeFileSync(file, text, { flag: 'wx' });
  created.push(slash(file));
  const updated = relink(root, topic).filter((f) => !created.includes(f));
  return { file: slash(file), created, updated };
}

function cli(argv) {
  const [cmd, ...rest] = argv;
  const flags = new Set(['--central']);
  const multi = (k) => rest.flatMap((x, i) => (x === k && rest[i + 1] != null ? [rest[i + 1]] : []));
  const opt = (k) => multi(k)[0] ?? '';
  const pos = rest.filter((x, i) => !x.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && !flags.has(rest[i - 1])));
  const lr = learnRoot({ central: rest.includes('--central') });
  if (cmd === 'root') {
    if (!lr.root) {
      console.log(`학습 루트: 없음 (중앙 학습 폴더 필요: ${lr.reason})\n제안값: ${lr.need}`);
      process.exitCode = 3;
      return;
    }
    const exists = fs.existsSync(lr.root);
    console.log(`학습 루트: ${lr.root}\n종류: ${lr.kind === 'project' ? '프로젝트 학습 폴더' : '중앙 학습 폴더'} (${lr.reason})`);
    console.log(`폴더: ${exists ? '있음' : '없음(처음 쓸 때 만든다)'}`);
    const base = lr.kind === 'project' ? lr.project : lr.root;
    if (lr.kind === 'project' && !exists) {
      const remote = git(base, ['remote', 'get-url', 'origin']);
      console.log(`원격: ${remote ? '있음 (공개 여부 미확인)' : '없음'}`);
    }
    if (!exists || lr.kind === 'central') {
      const ga = path.join(base, '.gitattributes');
      const has = fs.existsSync(ga) && /^\*\.md\s+text\s+eol=lf/m.test(fs.readFileSync(ga, 'utf8'));
      console.log(`.gitattributes의 *.md eol=lf: ${has ? '있음' : '없음'}`);
    }
    return;
  }
  if (!lr.root) throw new Error(`중앙 학습 폴더가 없다(${lr.reason}). \`마이 플러그인 설정\`에서 learn_root를 정한다. 제안값: ${lr.need}`);
  if (cmd === 'topics') {
    const ts = topics(lr.root);
    console.log(`학습 루트: ${lr.root}`);
    if (!ts.length) return console.log('- 주제 없음');
    for (const t of ts) console.log(`- ${t.topic} — 노트 ${t.notes}개${t.subtopics ? `, 소주제 ${t.subtopics}개` : ''}${t.updated ? `, 최근 ${t.updated}` : ''}`);
    return;
  }
  if (cmd === 'new-note') {
    if (pos.length < 2) throw new Error('주제와 노트 이름을 준다');
    const r = newNote(lr.root, { topic: pos[0], name: pos[1], subtopic: opt('--subtopic'), title: opt('--title'), sources: multi('--source'), tags: multi('--tag') });
    console.log(`노트: ${r.file}`);
    for (const f of r.created.filter((f) => f !== r.file)) console.log(`만듦: ${f}`);
    for (const f of r.updated) console.log(`갱신: ${f}`);
    return;
  }
  if (cmd === 'relink') {
    if (!pos[0]) throw new Error('주제를 준다');
    const ch = relink(lr.root, pos[0]);
    console.log(ch.length ? ch.map((f) => `갱신: ${f}`).join('\n') : '바뀐 파일 없음');
    return;
  }
  throw new Error('명령: root | topics | new-note <주제> <이름> [옵션] | relink <주제>  (모두 --central 가능)');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`학습 오류: ${e.message}\n`);
    process.exit(1);
  }
}
