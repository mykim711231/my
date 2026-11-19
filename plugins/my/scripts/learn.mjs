#!/usr/bin/env node
// 학습 노트(B-3, F-3, H): 학습 루트 정하기, 노트 만들기, 목차·이동 링크 다시 쓰기, 점검, 통합 변경안 준비·적용.
// 사용: node learn.mjs root [--central]          → 학습 루트와 상태. 중앙 폴더가 필요한데 없으면 종료 코드 3
//       node learn.mjs topics [--central]        → 주제 목록(이름, 노트 수, 소주제, 버전, 최근 학습일)
//       node learn.mjs new-note <주제> <이름> [--subtopic S] [--version N] [--versions 이름=버전 …]
//                               [--title T] [--source X …] [--tag X …] [--central]
//                                                → 양식으로 노트를 만들고, 앞뒤 링크·index.md·INDEX.md를 갱신. 만든 경로 출력
//       node learn.mjs import <노트.md> [--topic T] [--name N] [--subtopic S] [--central]
//                                                → 채팅 모드에서 받은 노트를 번호를 매겨 들이고 링크를 갱신(원본은 그대로)
//       node learn.mjs log <주제> [--subtopic S] [--source X …] [--history T] [--central]
//                                                → index.md의 "자료"·"학습 이력"에 줄을 더한다
//       node learn.mjs relink <주제> [--central] → 그 주제의 이동 링크와 노트 목록, INDEX.md를 다시 쓴다
//       node learn.mjs check [--central]         → 점검(H-7, F-3). 문제가 있으면 종료 코드 1
//       node learn.mjs stage <변경안.json> [--central]
//                                                → 통합 변경안을 임시 복사본에 적용해 검사하고, 통과하면 적용 기록을 만든다
//         변경안: { "changes": [ {"move": "rag/01-a.md", "to": "rag/01-sub/01-a.md"} | {"path": "rag/01-a.md", "content": "…"}
//                   | {"path": "rag/02-b.md", "delete": true} ] }  (경로는 학습 루트 기준)
//       node learn.mjs apply <기록 폴더>          → 기록대로 적용하고 점검이 통과해야 완료로 표시한다
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitRoot, normalizePath, resolveConfig, suggestLearnRoot } from './config.mjs';
import { frontmatter } from './status.mjs';
import * as change from './change-apply.mjs';
import { LINK, encodingProblems, external, headingProblems, linkProblems, mdFiles } from './md.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NOTE_TEMPLATE = path.resolve(HERE, '..', 'templates', 'learn-note.md');
const TOPIC_TEMPLATE = path.resolve(HERE, '..', 'templates', 'learn-topic.md');
const NUM = /^(\d{2})-(.+)$/;
const VER = /^v(\d+)$/;
const NAV = /^\[목록\]\((?:\.\.\/)?index\.md\)/;
const MAX_NOTES = 15;

const pad = (n) => String(n).padStart(2, '0');
const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const slash = (p) => p.replace(/\\/g, '/');
const readText = (f) => fs.readFileSync(f, 'utf8');
// 템플릿은 CRLF로 받아졌어도(Windows git autocrlf) LF로 읽는다. 노트는 LF로 쓴다.
const readTemplate = (f) => readText(f).replace(/\r\n/g, '\n');
const eolOf = (t) => (t.includes('\r\n') ? '\r\n' : '\n');

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

const entries = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []);
const notesIn = (dir) => entries(dir).filter((e) => e.isFile() && NUM.test(e.name) && e.name.endsWith('.md')).map((e) => e.name).sort();
const subsIn = (dir) => entries(dir).filter((e) => e.isDirectory() && NUM.test(e.name)).map((e) => e.name).sort();
const versIn = (dir) =>
  entries(dir)
    .filter((e) => e.isDirectory() && VER.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
const topicsIn = (root) => entries(root).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort();

const titleOf = (file) => {
  const m = /^# (.+)$/m.exec(readText(file));
  return m ? m[1].trim() : path.basename(file, '.md').replace(NUM, '$2');
};

// 노트를 담는 폴더(주제, 또는 소주제): 소주제가 있으면 소주제들, 없으면 주제 자신
const noteFolders = (topicDir) => (subsIn(topicDir).length ? subsIn(topicDir).map((s) => path.join(topicDir, s)) : [topicDir]);

// 주제 폴더 안 모든 노트(소주제·버전 폴더 포함): 주제 기준 상대 경로 목록
function allNotes(topicDir) {
  const out = [];
  const add = (dir) => {
    const rel = slash(path.relative(topicDir, dir));
    const pre = rel ? `${rel}/` : '';
    out.push(...notesIn(dir).map((n) => pre + n));
    for (const v of versIn(dir)) out.push(...notesIn(path.join(dir, v)).map((n) => `${pre}${v}/${n}`));
  };
  add(topicDir);
  for (const s of subsIn(topicDir)) add(path.join(topicDir, s));
  return out;
}

export function topics(root) {
  return topicsIn(root).map((t) => {
    const dir = path.join(root, t);
    const notes = allNotes(dir);
    const dates = notes.map((n) => String(frontmatter(path.join(dir, n))?.updated ?? '')).filter(Boolean).sort();
    const versions = [...new Set([dir, ...subsIn(dir).map((s) => path.join(dir, s))].flatMap(versIn))];
    return { topic: t, notes: notes.length, subtopics: subsIn(dir).length, versions, updated: dates.at(-1) ?? '' };
  });
}

const navLine = (list, i, up = '') =>
  [`[목록](${up}index.md)`, i > 0 ? `[← 이전](${list[i - 1]})` : null, i < list.length - 1 ? `[다음 →](${list[i + 1]})` : null]
    .filter(Boolean)
    .join(' | ');

// 노트 첫·끝 이동 링크를 목록 순서대로 다시 쓴다(write=false면 바뀔 파일만 돌려준다).
function relinkFolder(dir, up = '', write = true) {
  const list = notesIn(dir);
  const changed = [];
  list.forEach((name, i) => {
    const file = path.join(dir, name);
    const text = readText(file);
    const lines = text.split(/\r?\n/);
    const nav = navLine(list, i, up);
    const idx = lines.map((l, k) => (NAV.test(l) ? k : -1)).filter((k) => k >= 0);
    if (!idx.length) return;
    for (const k of [idx[0], idx.at(-1)]) lines[k] = nav;
    const next = lines.join(eolOf(text));
    if (next !== text) {
      if (write) fs.writeFileSync(file, next);
      changed.push(slash(file));
    }
  });
  return changed;
}

// index.md의 "## 노트" 절을 폴더 내용(소주제, 노트, 버전 폴더)으로 다시 만든 글
function indexListText(dir) {
  const file = path.join(dir, 'index.md');
  if (!fs.existsSync(file)) return null;
  const text = readText(file);
  const eol = eolOf(text);
  const items = [
    ...subsIn(dir).map((s) => `- [${s.replace(NUM, '$2')}](${s}/index.md)`),
    ...notesIn(dir).map((n) => `- [${titleOf(path.join(dir, n))}](${n})`),
  ];
  const vers = versIn(dir);
  vers.forEach((v, i) => {
    items.push('', `### ${v}${i < vers.length - 1 ? ' (이전 버전)' : ''}`, '');
    const ns = notesIn(path.join(dir, v));
    items.push(...(ns.length ? ns.map((n) => `- [${titleOf(path.join(dir, v, n))}](${v}/${n})`) : ['- 없음']));
  });
  if (!items.length) items.push('- 없음');
  if (items[0] === '') items.shift();
  const body = items.join(eol);
  const re = /(^## 노트[ \t]*\r?\n)([\s\S]*?)(?=^## |(?![\s\S]))/m;
  return re.test(text) ? text.replace(re, `$1${eol}${body}${eol}${eol}`) : `${text.trimEnd()}${eol}${eol}## 노트${eol}${eol}${body}${eol}`;
}

function rewriteIndexList(dir) {
  const next = indexListText(dir);
  const file = path.join(dir, 'index.md');
  if (next == null || next === readText(file)) return null;
  fs.writeFileSync(file, next);
  return slash(file);
}

export function indexText(root) {
  const lines = ['<!-- 생성됨 — 직접 수정 금지 -->', '# 학습 목록', '', '## 주제', ''];
  const ts = topics(root);
  for (const t of ts) {
    const extra = [`노트 ${t.notes}개`, t.subtopics ? `소주제 ${t.subtopics}개` : '', t.versions.length ? `버전 ${t.versions.join(', ')}` : '', t.updated ? `최근 ${t.updated}` : ''];
    lines.push(`- [${t.topic}](${t.topic}/index.md) — ${extra.filter(Boolean).join(', ')}`);
  }
  if (!ts.length) lines.push('- 없음');
  return lines.join('\n') + '\n';
}

export function writeIndex(root) {
  const file = path.join(root, 'INDEX.md');
  const text = indexText(root);
  if (fs.existsSync(file) && readText(file) === text) return null;
  fs.writeFileSync(file, text);
  return slash(file);
}

export function relink(root, topic) {
  const dir = path.join(root, topic);
  if (!fs.existsSync(dir)) throw new Error(`주제 폴더가 없다: ${slash(dir)}`);
  const changed = [];
  const folder = (d) => {
    changed.push(...relinkFolder(d));
    for (const v of versIn(d)) changed.push(...relinkFolder(path.join(d, v), '../'));
  };
  folder(dir);
  for (const s of subsIn(dir)) {
    folder(path.join(dir, s));
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

function ensureIndex(dir, title, date, topic = title) {
  const file = path.join(dir, 'index.md');
  if (fs.existsSync(file)) return null;
  fs.mkdirSync(dir, { recursive: true });
  const t = readTemplate(TOPIC_TEMPLATE).replaceAll("{{topic}}", JSON.stringify(topic)).replaceAll("{{title}}", title).replaceAll('{{date}}', date);
  fs.writeFileSync(file, t, { flag: 'wx' });
  return slash(file);
}

export function newNote(root, { topic, name, subtopic = '', version = '', versions = [], title = '', sources = [], tags = [], now = new Date() }) {
  topic = safeName(topic, '주제');
  name = safeName(name, '노트');
  const date = today(now);
  const topicDir = path.join(root, topic);
  if (subtopic && notesIn(topicDir).length)
    throw new Error(`주제 폴더에 노트가 있어 소주제 폴더를 섞을 수 없다: ${slash(topicDir)}. \`마이 학습 통합 ${topic}\`으로 먼저 나눈다`);
  if (!subtopic && subsIn(topicDir).length)
    throw new Error(`소주제 폴더로 나눈 주제다: ${slash(topicDir)}. --subtopic으로 소주제를 준다(있는 소주제: ${subsIn(topicDir).map((s) => s.replace(NUM, '$2')).join(', ')})`);
  const created = [];
  const c1 = ensureIndex(topicDir, topic, date);
  if (c1) created.push(c1);
  let dir = topicDir;
  if (subtopic) {
    subtopic = safeName(subtopic, '소주제');
    const subs = subsIn(topicDir);
    const hit = subs.find((s) => s.replace(NUM, '$2') === subtopic || s === subtopic);
    const folder = hit ?? `${pad(subs.length ? Number(subs.at(-1).slice(0, 2)) + 1 : 1)}-${subtopic}`;
    if (!hit && subs.length >= 99) throw new Error(`소주제 번호가 99를 넘는다: ${slash(topicDir)}. 주제를 나눈다`);
    dir = path.join(topicDir, folder);
    const c2 = ensureIndex(dir, subtopic.replace(NUM, "$2"), date, topic);
    if (c2) created.push(c2);
  }
  if (version) {
    const v = String(version).replace(/^v/i, '');
    if (!/^\d+$/.test(v)) throw new Error(`버전은 주버전 숫자로 준다: "${version}"`);
    dir = path.join(dir, `v${Number(v)}`);
    fs.mkdirSync(dir, { recursive: true });
  }
  const notes = notesIn(dir);
  const n = notes.length ? Number(notes.at(-1).slice(0, 2)) + 1 : 1;
  if (n > 99) throw new Error(`노트 번호가 99를 넘는다: ${slash(dir)}. 소주제로 나눈다`);
  const file = path.join(dir, `${pad(n)}-${name}.md`);
  const yamlList = (a) => `[${a.map((x) => JSON.stringify(x)).join(', ')}]`;
  const vmap = versions.map((x) => {
    const [k, ...rest] = String(x).split('=');
    if (!k || !rest.length) throw new Error(`--versions는 이름=버전으로 준다: "${x}"`);
    return `${JSON.stringify(k.trim())}: ${JSON.stringify(rest.join('=').trim())}`;
  });
  const text = readTemplate(NOTE_TEMPLATE)
    .replace('{{topic}}', JSON.stringify(topic))
    .replace(/^subtopic: \{\{subtopic\}\}\r?\n/m, subtopic ? `subtopic: ${JSON.stringify(subtopic.replace(NUM, '$2'))}\n` : '')
    .replace('{{tags}}', yamlList(tags))
    .replace('{{sources}}', yamlList(sources))
    .replace(/^updated: /m, vmap.length ? `versions: {${vmap.join(', ')}}\nupdated: ` : 'updated: ')
    .replace('{{date}}', date)
    .replace('{{title}}', title || name);
  fs.writeFileSync(file, text, { flag: 'wx' });
  created.push(slash(file));
  const updated = relink(root, topic).filter((f) => !created.includes(f));
  return { file: slash(file), created, updated };
}

// 채팅 모드에서 받은 노트 md(`미정-<이름>.md`)를 번호를 매겨 들인다. 원본 파일은 그대로 둔다.
export function importNote(root, src, { topic = '', name = '', subtopic = '', now = new Date() } = {}) {
  const raw = readTemplate(src).replace(/^﻿/, '');
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  const meta = {};
  for (const line of (fm ? fm[1] : '').split('\n')) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  const blank = (v) => !v || /^["']?<.*>["']?$/.test(v); // 양식의 자리표시(<주제>)는 빈 값
  const scalar = (v) => {
    if (blank(v)) return '';
    try {
      return v.startsWith('"') ? JSON.parse(v) : v.replace(/^'|'$/g, '');
    } catch {
      return v.replace(/^["']|["']$/g, '');
    }
  };
  const list = (v) => {
    if (blank(v)) return [];
    try {
      const a = JSON.parse(v);
      return Array.isArray(a) ? a.map(String).filter((x) => !blank(x)) : [];
    } catch {
      return v.replace(/^\[|\]$/g, '').split(',').map((x) => scalar(x.trim())).filter(Boolean);
    }
  };
  topic = topic || scalar(meta.topic);
  if (!topic) throw new Error(`주제가 없다: ${slash(src)}. 앞머리 topic을 채우거나 --topic을 준다`);
  subtopic = subtopic || scalar(meta.subtopic);
  const base = path.basename(src).replace(/\.md$/i, '');
  name = name || base.replace(/^미정-/, '').replace(NUM, '$2');
  let title = '';
  let fence = false;
  const body = [];
  for (const l of (fm ? raw.slice(fm[0].length) : raw).split('\n')) {
    if (/^\s*(`{3,}|~{3,})/.test(l)) fence = !fence;
    if (!fence && !title && /^# /.test(l)) {
      title = l.slice(2).trim();
      continue;
    }
    if (!fence && NAV.test(l)) continue;
    body.push(l);
  }
  const r = newNote(root, { topic, name, subtopic, title, sources: list(meta.sources), tags: list(meta.tags), now });
  const lines = readText(r.file).split('\n');
  const idx = lines.map((l, k) => (NAV.test(l) ? k : -1)).filter((k) => k >= 0);
  const content = body.join('\n').trim();
  const next = [...lines.slice(0, idx[0] + 1), '', ...(content ? [content, ''] : []), ...lines.slice(idx.at(-1))].join('\n');
  fs.writeFileSync(r.file, next);
  return r;
}

// "## 제목" 절 끝에 줄을 더한다(이미 있는 줄과 "- 없음"은 건너뛴다/지운다).
function appendSection(text, heading, lines) {
  const eol = eolOf(text);
  const re = new RegExp(`(^## ${heading}[ \\t]*\\r?\\n)([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  const m = re.exec(text);
  const old = m ? m[2].split(/\r?\n/).filter((l) => l.trim() && l.trim() !== '- 없음') : [];
  const add = lines.filter((l) => !old.includes(l));
  if (!add.length) return text;
  const body = [...old, ...add].join(eol);
  return m ? text.replace(re, `$1${eol}${body}${eol}${eol}`) : `${text.trimEnd()}${eol}${eol}## ${heading}${eol}${eol}${body}${eol}`;
}

export function log(root, topic, { subtopic = '', sources = [], history = '', now = new Date() } = {}) {
  topic = safeName(topic, '주제');
  const topicDir = path.join(root, topic);
  let dir = topicDir;
  if (subsIn(topicDir).length) {
    const hit = subsIn(topicDir).find((s) => s.replace(NUM, '$2') === subtopic || s === subtopic);
    if (!hit) throw new Error(`소주제로 나눈 주제다. 있는 소주제를 --subtopic으로 준다: ${subsIn(topicDir).map((s) => s.replace(NUM, '$2')).join(', ')}`);
    dir = path.join(topicDir, hit);
  }
  const file = path.join(dir, 'index.md');
  if (!fs.existsSync(file)) throw new Error(`index.md가 없다: ${slash(file)}`);
  let text = readText(file);
  const before = text;
  if (sources.length) text = appendSection(text, '자료', sources.map((s) => `- ${s}`));
  if (history) text = appendSection(text, '학습 이력', [`- ${today(now)} ${history}`]);
  if (text === before) return null;
  fs.writeFileSync(file, text);
  return slash(file);
}

// ── 점검 ──────────────────────────────────────────────

export function check(root) {
  const problems = [];
  const info = [];
  const rel = (f) => slash(path.relative(root, f));
  const add = (f, kind, detail = '') => problems.push({ file: rel(f), kind, detail });
  if (!fs.existsSync(root)) return { root: slash(root), problems, info, skipped: [] };

  // 파일 단위: BOM, 앞머리, 제목, 링크
  for (const f of mdFiles(root)) {
    const raw = fs.readFileSync(f);
    const text = raw.toString('utf8');
    const r = rel(f);
    for (const p of encodingProblems(raw)) add(f, p.kind, p.detail);
    const parts = r.split('/');
    const isNote = NUM.test(path.basename(f)) && parts.length >= 2;
    if (isNote) {
      const fm = /^---\r?\n/.test(text) ? frontmatter(f) : null;
      if (!fm) add(f, '앞머리 없음', '');
      else {
        const inSub = parts.length >= 3 && NUM.test(parts[1]);
        const need = ['topic', 'tags', 'sources', 'updated', ...(inSub ? ['subtopic'] : [])];
        const miss = need.filter((k) => !(k in fm));
        if (miss.length) add(f, '앞머리 필드 없음', miss.join(', '));
        if (fm.topic && fm.topic !== parts[0]) add(f, '앞머리 topic 불일치', `${fm.topic} ≠ 폴더 ${parts[0]}`);
        if (inSub && fm.subtopic && fm.subtopic !== parts[1].replace(NUM, '$2')) add(f, '앞머리 subtopic 불일치', `${fm.subtopic} ≠ 폴더 ${parts[1]}`);
      }
    }
    if (path.basename(f) !== 'INDEX.md') for (const p of headingProblems(text)) add(f, p.kind, p.detail);
    for (const p of linkProblems(f, text)) add(f, p.kind, p.detail);
  }

  // 폴더 단위: 구조, 번호, 목록, 이동 링크
  const checkNoteFolder = (dir, up = '') => {
    const ns = notesIn(dir);
    const nums = ns.map((n) => Number(n.slice(0, 2)));
    const dup = nums.filter((x, i) => nums.indexOf(x) !== i);
    if (dup.length) add(dir, '번호 중복', [...new Set(dup)].map(pad).join(', '));
    const missing = nums.length ? Array.from({ length: Math.max(...nums) }, (_, i) => i + 1).filter((x) => !nums.includes(x)) : [];
    if (missing.length) add(dir, '번호 누락', missing.map(pad).join(', '));
    if (ns.length > MAX_NOTES) add(dir, `노트 ${MAX_NOTES}개 초과`, `${ns.length}개 — \`마이 학습 통합\`으로 소주제 폴더로 나눈다`);
    for (const e of entries(dir)) if (e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md' && !NUM.test(e.name)) add(path.join(dir, e.name), '번호 없는 노트', '');
    if (relinkFolder(dir, up, false).length) for (const f of relinkFolder(dir, up, false)) add(f, '이동 링크 불일치', '`learn.mjs relink`로 다시 쓴다');
  };
  const checkListed = (dir) => {
    const next = indexListText(dir);
    if (next == null) return add(dir, 'index.md 없음', '');
    if (next !== readText(path.join(dir, 'index.md'))) add(path.join(dir, 'index.md'), '노트 목록이 폴더와 다름', '목록에 없는 파일이나 사라진 파일 — `learn.mjs relink`로 다시 쓴다');
  };
  const checkVersions = (dir) => {
    const vers = versIn(dir);
    for (const v of vers) checkNoteFolder(path.join(dir, v), '../');
    for (const v of vers.slice(0, -1)) info.push(`${rel(path.join(dir, v))} — 이전 버전(최신 ${vers.at(-1)}). 내용이 여전히 맞는지 확인한다(지우지 않는다)`);
  };
  for (const t of topicsIn(root)) {
    const dir = path.join(root, t);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t)) add(dir, '폴더 이름', '영문 kebab-case로 쓴다');
    const subs = subsIn(dir);
    checkListed(dir);
    if (subs.length && notesIn(dir).length) add(dir, '노트와 소주제 폴더가 섞임', '`마이 학습 통합`으로 노트를 소주제 폴더로 옮긴다');
    if (subs.length > 99) add(dir, '소주제 99개 초과', '주제를 나눈다');
    checkNoteFolder(dir);
    checkVersions(dir);
    for (const s of subs) {
      const sd = path.join(dir, s);
      checkListed(sd);
      if (subsIn(sd).length) add(sd, '소주제 안 소주제', '깊이는 <주제>/<소주제>/v<주버전>/까지다');
      checkNoteFolder(sd);
      checkVersions(sd);
    }
  }
  const ix = path.join(root, 'INDEX.md');
  if (!fs.existsSync(ix)) add(ix, 'INDEX.md 없음', '`learn.mjs relink <주제>`로 만든다');
  else if (readText(ix) !== indexText(root)) add(ix, 'INDEX.md가 오래됨', '`learn.mjs relink <주제>`로 다시 쓴다');
  return { root: slash(root), problems, info, skipped: ['Mermaid 검사(H-8)는 아직 하지 않는다'] };
}

// ── 통합 변경안 ───────────────────────────────────────

const key = (p) => `${p.kind}|${p.file}|${p.detail}`;

function allFiles(dir, base = dir, out = new Map()) {
  for (const e of entries(dir)) {
    if (e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allFiles(p, base, out);
    else if (e.isFile()) out.set(slash(path.relative(base, p)), p);
  }
  return out;
}

// 옮긴 파일을 가리키는 상대 링크를 새 위치 기준으로 고친다.
function fixLinks(work, moves) {
  const back = new Map([...moves].map(([a, b]) => [b, a]));
  for (const [r, abs] of allFiles(work)) {
    if (!r.endsWith('.md')) continue;
    const orig = back.get(r) ?? r;
    const text = readText(abs);
    const next = text.replace(LINK, (whole, t) => {
      if (t.startsWith('#') || external(t) || /^[A-Za-z]:[\\/]|^[\\/]/.test(t)) return whole;
      const [p, anchor] = t.split('#');
      const oldTarget = slash(path.posix.normalize(path.posix.join(path.posix.dirname(orig), p)));
      const newTarget = moves.get(oldTarget) ?? oldTarget;
      let np = slash(path.posix.relative(path.posix.dirname(r), newTarget));
      if (np === p) return whole;
      return whole.replace(`(${t}`, `(${np}${anchor != null ? `#${anchor}` : ''}`);
    });
    if (next !== text) fs.writeFileSync(abs, next);
  }
}

// 옮긴 노트의 topic·subtopic 앞머리를 새 위치에 맞춘다.
function fixFrontmatter(work, to) {
  const f = path.join(work, to);
  if (!to.endsWith('.md') || !fs.existsSync(f)) return;
  const parts = to.split('/');
  const text = readText(f);
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return;
  const eol = eolOf(text);
  let fm = m[1].split(/\r?\n/).filter((l) => !/^subtopic:/.test(l));
  fm = fm.map((l) => (/^topic:/.test(l) ? `topic: ${JSON.stringify(parts[0])}` : l));
  if (parts.length >= 3 && NUM.test(parts[1])) {
    const i = fm.findIndex((l) => /^topic:/.test(l));
    fm.splice(i + 1, 0, `subtopic: ${JSON.stringify(parts[1].replace(NUM, '$2'))}`);
  }
  fs.writeFileSync(f, text.replace(m[0], `---${eol}${fm.join(eol)}${eol}---`));
}

export function stage(root, plan) {
  if (!Array.isArray(plan?.changes)) throw new Error('변경안에 changes 배열이 있어야 한다');
  if (!fs.existsSync(root)) throw new Error(`학습 루트가 없다: ${slash(root)}`);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'my-learn-stage-'));
  try {
    fs.cpSync(root, work, { recursive: true, filter: (src) => path.basename(src) !== '.git' });
    const inside = (p) => {
      const r = slash(path.posix.normalize(String(p ?? '').replace(/\\/g, '/')));
      if (!r || r.startsWith('..') || path.isAbsolute(r) || r === '.') throw new Error(`학습 루트 밖 경로: ${p}`);
      return r;
    };
    const moves = new Map();
    for (const c of plan.changes) {
      if (c.move) {
        const [a, b] = [inside(c.move), inside(c.to)];
        if (!fs.existsSync(path.join(work, a))) throw new Error(`옮길 파일이 없다: ${a}`);
        if (fs.existsSync(path.join(work, b))) throw new Error(`옮길 자리에 파일이 있다: ${b}`);
        fs.mkdirSync(path.dirname(path.join(work, b)), { recursive: true });
        fs.renameSync(path.join(work, a), path.join(work, b));
        moves.set(a, b);
      } else if (c.delete) fs.rmSync(path.join(work, inside(c.path)), { force: true });
      else if (c.content != null) {
        const p = path.join(work, inside(c.path));
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, c.content);
      } else throw new Error(`변경을 알 수 없다: ${JSON.stringify(c)}`);
    }
    for (const b of moves.values()) fixFrontmatter(work, b);
    fixLinks(work, moves);
    for (const t of topicsIn(work)) relink(work, t);
    writeIndex(work);
    const baseline = check(root).problems.map(key);
    const fresh = check(work).problems.filter((p) => !baseline.includes(key(p)));
    if (fresh.length) {
      const e = new change.Conflict('변경안을 적용한 결과에 새 문제가 있어 적용 기록을 만들지 않았다', fresh.map((p) => `${p.file} — ${p.kind}${p.detail ? `: ${p.detail}` : ''}`));
      throw e;
    }
    const [now, next] = [allFiles(root), allFiles(work)];
    const changes = [];
    for (const [r, abs] of next) if (!now.has(r) || !fs.readFileSync(now.get(r)).equals(fs.readFileSync(abs))) changes.push({ path: r, content: fs.readFileSync(abs) });
    for (const r of now.keys()) if (!next.has(r)) changes.push({ path: r, content: null });
    const dir = change.prepare(root, changes, { meta: { kind: 'learn', baseline } });
    return { dir, changes: changes.length };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// 적용 뒤 새 점검 문제가 있으면 완료로 표시하지 않는다.
export function applyStaged(dir, opts = {}) {
  const s = change.summary(dir);
  const baseline = s.meta?.baseline ?? [];
  return change.apply(dir, {
    ...opts,
    verify: () =>
      check(s.root)
        .problems.filter((p) => !baseline.includes(key(p)))
        .map((p) => `${p.file} — ${p.kind}${p.detail ? `: ${p.detail}` : ''}`),
  });
}

function cli(argv) {
  const [cmd, ...rest] = argv;
  const flags = new Set(['--central']);
  const multi = (k) => rest.flatMap((x, i) => (x === k && rest[i + 1] != null ? [rest[i + 1]] : []));
  const opt = (k) => multi(k)[0] ?? '';
  const pos = rest.filter((x, i) => !x.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && !flags.has(rest[i - 1])));
  if (cmd === 'apply') {
    if (!pos[0]) throw new Error('기록 폴더를 준다');
    const r = applyStaged(pos[0]);
    console.log(`적용 완료(점검 통과): ${r.written.length}개 씀`);
    for (const f of r.written) console.log(`- ${f}`);
    return;
  }
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
      const has = fs.existsSync(ga) && /^\*\.md\s+text\s+eol=lf/m.test(readText(ga));
      console.log(`.gitattributes의 *.md eol=lf: ${has ? '있음' : '없음'}`);
    }
    return;
  }
  if (!lr.root) throw new Error(`중앙 학습 폴더가 없다(${lr.reason}). \`마이 플러그인 설정\`에서 learn_root를 정한다. 제안값: ${lr.need}`);
  if (cmd === 'topics') {
    const ts = topics(lr.root);
    console.log(`학습 루트: ${lr.root}`);
    if (!ts.length) return console.log('- 주제 없음');
    for (const t of ts) {
      const extra = [`노트 ${t.notes}개`, t.subtopics ? `소주제 ${t.subtopics}개` : '', t.versions.length ? `버전 ${t.versions.join(', ')}` : '', t.updated ? `최근 ${t.updated}` : ''];
      console.log(`- ${t.topic} — ${extra.filter(Boolean).join(', ')}`);
    }
    return;
  }
  if (cmd === 'new-note') {
    if (pos.length < 2) throw new Error('주제와 노트 이름을 준다');
    const r = newNote(lr.root, {
      topic: pos[0],
      name: pos[1],
      subtopic: opt('--subtopic'),
      version: opt('--version'),
      versions: multi('--versions'),
      title: opt('--title'),
      sources: multi('--source'),
      tags: multi('--tag'),
    });
    console.log(`노트: ${r.file}`);
    for (const f of r.created.filter((f) => f !== r.file)) console.log(`만듦: ${f}`);
    for (const f of r.updated) console.log(`갱신: ${f}`);
    return;
  }
  if (cmd === 'import') {
    if (!pos[0]) throw new Error('가져올 노트 md를 준다');
    const r = importNote(lr.root, pos[0], { topic: opt('--topic'), name: opt('--name'), subtopic: opt('--subtopic') });
    console.log(`노트: ${r.file}`);
    for (const f of r.created.filter((f) => f !== r.file)) console.log(`만듦: ${f}`);
    for (const f of r.updated) console.log(`갱신: ${f}`);
    console.log(`원본은 그대로 둠: ${slash(path.resolve(pos[0]))}`);
    return;
  }
  if (cmd === 'log') {
    if (!pos[0]) throw new Error('주제를 준다');
    const f = log(lr.root, pos[0], { subtopic: opt('--subtopic'), sources: multi('--source'), history: opt('--history') });
    console.log(f ? `갱신: ${f}` : '바뀐 파일 없음');
    return;
  }
  if (cmd === 'relink') {
    if (!pos[0]) throw new Error('주제를 준다');
    const ch = relink(lr.root, pos[0]);
    console.log(ch.length ? ch.map((f) => `갱신: ${f}`).join('\n') : '바뀐 파일 없음');
    return;
  }
  if (cmd === 'check') {
    const r = check(lr.root);
    console.log(`학습 루트: ${r.root}`);
    if (!fs.existsSync(lr.root)) return console.log('- 학습 폴더 없음(점검할 것 없음)');
    if (!r.problems.length) console.log('문제 없음');
    else {
      console.log(`문제: ${r.problems.length}개`);
      for (const p of r.problems) console.log(`- ${p.file || '.'} — ${p.kind}${p.detail ? `: ${p.detail}` : ''}`);
      process.exitCode = 1;
    }
    for (const s of r.info) console.log(`- 참고: ${s}`);
    for (const s of r.skipped) console.log(`- 건너뜀: ${s}`);
    return;
  }
  if (cmd === 'stage') {
    if (!pos[0]) throw new Error('변경안 파일을 준다');
    const r = stage(lr.root, JSON.parse(readText(pos[0])));
    console.log(`기록: ${r.dir}`);
    const s = change.summary(r.dir);
    console.log(`변경: ${s.entries.length}개`);
    for (const e of s.entries) console.log(`- ${e.path} — ${e.kind}`);
    return;
  }
  throw new Error('명령: root | topics | new-note | import <노트.md> | log | relink | check | stage <변경안.json> | apply <기록 폴더>  (apply 말고는 --central 가능)');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    if (e instanceof change.Conflict) {
      process.stderr.write(`학습 중단: ${e.message}\n${e.files.map((f) => `- ${f}`).join('\n')}\n`);
      process.exit(1);
    }
    process.stderr.write(`학습 오류: ${e.message}\n`);
    process.exit(2);
  }
}
