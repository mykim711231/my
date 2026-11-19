#!/usr/bin/env node
// 여러 파일 변경(F-3 통합, E 동기화): 승인할 변경안을 기록하고, 잠금 아래 승인 당시 상태와 대조해 적용·재개·복구한다.
// 사용: node change-apply.mjs prepare <변경안.json>  → 기록 폴더 경로와 변경 목록 출력
//         변경안: { "root": "<루트>", "changes": [ {"path": "a.md", "content": "…"} | {"path": "a.md", "contentFile": "<파일>"}
//                   | {"path": "b.md", "from": "a.md"} | {"path": "a.md", "delete": true} ] }  (path·from은 루트 기준)
//       node change-apply.mjs show <기록 폴더>     → 변경 목록과 diff
//       node change-apply.mjs apply <기록 폴더>    → 적용. 중단된 적용은 같은 명령으로 이어서 한다
//       node change-apply.mjs rollback <기록 폴더> → 적용한 파일을 승인 전 내용으로 되돌린다
// 종료 코드: 0 완료, 1 충돌로 중단(파일을 쓰지 않았거나 충돌 파일은 보존), 2 오류
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hash = (buf) => (buf == null ? null : crypto.createHash('sha256').update(buf).digest('hex'));
const read = (f) => (fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null);
const slash = (p) => p.replace(/\\/g, '/');

export class Conflict extends Error {
  constructor(msg, files) {
    super(msg);
    this.files = files;
  }
}

function relPath(root, p) {
  const abs = path.resolve(root, p);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`루트 밖 경로: ${p}`);
  return slash(rel);
}

// changes: [{ path, content: Buffer|string|null }]  (null = 지움)
export function prepare(root, changes, { dir, meta } = {}) {
  root = path.resolve(root);
  if (!fs.existsSync(root)) throw new Error(`루트가 없다: ${slash(root)}`);
  dir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'my-change-'));
  fs.mkdirSync(path.join(dir, 'before'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'after'), { recursive: true });
  const seen = new Set();
  const entries = [];
  for (const c of changes) {
    const rel = relPath(root, c.path);
    if (seen.has(rel)) throw new Error(`같은 경로가 두 번 나온다: ${rel}`);
    seen.add(rel);
    const before = read(path.join(root, rel));
    const after = c.content == null ? null : Buffer.from(c.content);
    if (hash(before) === hash(after)) continue;
    const id = String(entries.length).padStart(4, '0');
    if (before) fs.writeFileSync(path.join(dir, 'before', id), before);
    if (after) fs.writeFileSync(path.join(dir, 'after', id), after);
    entries.push({ id, path: rel, before: hash(before), after: hash(after), done: false });
  }
  const state = { root: slash(root), status: 'prepared', created: new Date().toISOString(), ...(meta ? { meta } : {}), entries };
  save(dir, state);
  return slash(dir);
}

// 변경안 JSON → prepare 입력
export function fromPlan(plan, base = process.cwd()) {
  if (!plan?.root || !Array.isArray(plan.changes)) throw new Error('변경안에 root와 changes가 있어야 한다');
  const root = path.resolve(base, plan.root);
  const changes = plan.changes.map((c) => {
    if (!c.path) throw new Error('변경마다 path가 있어야 한다');
    if (c.delete) return { path: c.path, content: null };
    if (c.content != null) return { path: c.path, content: c.content };
    if (c.contentFile) return { path: c.path, content: fs.readFileSync(path.resolve(base, c.contentFile)) };
    if (c.from) {
      const buf = read(path.join(root, relPath(root, c.from)));
      if (!buf) throw new Error(`옮길 원본이 없다: ${c.from}`);
      return { path: c.path, content: buf };
    }
    throw new Error(`변경 내용이 없다: ${c.path}`);
  });
  return { root, changes };
}

const load = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
function save(dir, state) {
  const f = path.join(dir, 'state.json');
  fs.writeFileSync(f + '.tmp', JSON.stringify(state, null, 2));
  fs.renameSync(f + '.tmp', f);
}

const kind = (e) => (e.before == null ? '새 파일' : e.after == null ? '지움' : '바뀜');

export function summary(dir) {
  const s = load(dir);
  return { root: s.root, status: s.status, meta: s.meta, entries: s.entries.map((e) => ({ path: e.path, kind: kind(e), done: e.done })) };
}

export function diff(dir) {
  const s = load(dir);
  const out = [];
  const nul = os.devNull;
  for (const e of s.entries) {
    const a = e.before ? path.join(dir, 'before', e.id) : nul;
    const b = e.after ? path.join(dir, 'after', e.id) : nul;
    try {
      execFileSync('git', ['diff', '--no-index', '--', a, b], { encoding: 'utf8' });
    } catch (err) {
      const text = String(err.stdout || '').replace(/^(---|\+\+\+) .*$/gm, (l) => `${l.slice(0, 4)}${e.path}`);
      out.push(`### ${e.path} (${kind(e)})\n\n${text}`);
    }
  }
  return out.join('\n');
}

// 루트 단위 잠금: 임시 폴더에 둔다(루트를 더럽히지 않는다).
function lock(root) {
  const f = path.join(os.tmpdir(), `my-change-${hash(Buffer.from(root.toLowerCase())).slice(0, 16)}.lock`);
  try {
    fs.writeFileSync(f, String(process.pid), { flag: 'wx' });
  } catch {
    throw new Error(`다른 적용이 진행 중이다(잠금 파일: ${slash(f)}). 진행 중인 적용이 없으면 이 파일을 지우고 다시 실행한다`);
  }
  return () => fs.rmSync(f, { force: true });
}

const current = (s, e) => hash(read(path.join(s.root, e.path)));

function writeEntry(dir, s, e, which) {
  const target = path.join(s.root, e.path);
  const h = which === 'after' ? e.after : e.before;
  if (h == null) {
    fs.rmSync(target, { force: true });
    // 비게 된 폴더를 루트까지 지운다
    for (let d = path.dirname(target); path.relative(s.root, d) && fs.existsSync(d) && !fs.readdirSync(d).length; d = path.dirname(d)) fs.rmdirSync(d);
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.my-tmp`;
  fs.copyFileSync(path.join(dir, which, e.id), tmp);
  fs.renameSync(tmp, target);
}

// stopAfter: 시험용. n개를 쓴 뒤 중단한 것처럼 멈춘다.
// verify: 다 쓴 뒤 부르는 검사. 문제 목록을 돌려주면 완료로 표시하지 않는다(verify-failed). 같은 명령으로 다시 검사한다.
export function apply(dir, { stopAfter, verify } = {}) {
  const s = load(dir);
  if (s.status === 'done') return { status: 'done', written: [] };
  if (s.status.startsWith('rolled')) throw new Error(`이미 되돌린 변경이다(${s.status}). 새 변경안으로 다시 준비한다`);
  const unlock = lock(s.root);
  try {
    // 쓰기 전에 전부 대조한다. 하나라도 다르면 아무것도 쓰지 않는다.
    const bad = [];
    for (const e of s.entries) {
      const cur = current(s, e);
      if (cur === e.after) e.done = true; // 이미 적용됨(중단 직전에 썼거나 같은 결과)
      else if (e.done || cur !== e.before) bad.push(`${e.path} — ${e.done ? '적용 뒤 달라짐' : '승인 뒤 달라짐'}`);
    }
    if (bad.length) {
      save(dir, s);
      throw new Conflict('승인 당시와 달라진 파일이 있어 쓰기 전에 멈췄다. 새 변경안을 만들어 diff를 다시 승인받는다', bad);
    }
    s.status = 'applying';
    save(dir, s);
    const written = [];
    for (const e of s.entries) {
      if (e.done) continue;
      if (stopAfter != null && written.length >= stopAfter) return { status: 'applying', written };
      writeEntry(dir, s, e, 'after');
      e.done = true;
      save(dir, s);
      written.push(e.path);
    }
    const wrong = s.entries.filter((e) => current(s, e) !== e.after).map((e) => `${e.path} — 쓴 결과가 변경안과 다름`);
    if (wrong.length) throw new Conflict('적용 결과 확인 실패', wrong);
    const problems = verify ? verify() : [];
    if (problems.length) {
      s.status = 'verify-failed';
      save(dir, s);
      throw new Conflict('적용 뒤 검사 실패. 문제를 고친 뒤 같은 명령으로 다시 검사하거나 되돌린다', problems);
    }
    s.status = 'done';
    save(dir, s);
    return { status: 'done', written };
  } finally {
    unlock();
  }
}

export function rollback(dir) {
  const s = load(dir);
  const unlock = lock(s.root);
  try {
    const restored = [];
    const kept = [];
    for (const e of [...s.entries].reverse()) {
      const cur = current(s, e);
      if (cur === e.before) {
        e.done = false;
        continue;
      }
      if (cur === e.after) {
        writeEntry(dir, s, e, 'before');
        e.done = false;
        restored.push(e.path);
      } else kept.push(`${e.path} — 적용 뒤 다른 곳에서 바뀜, 보존`);
    }
    s.status = kept.length ? 'rolled-back-partial' : 'rolled-back';
    save(dir, s);
    if (kept.length) throw new Conflict(`되돌림 ${restored.length}개, 충돌로 보존한 파일이 있다`, kept);
    return { restored };
  } finally {
    unlock();
  }
}

function cli([cmd, arg]) {
  if (!arg) throw new Error('명령: prepare <변경안.json> | show <기록 폴더> | apply <기록 폴더> | rollback <기록 폴더>');
  const list = (dir) => {
    const s = summary(dir);
    console.log(`루트: ${s.root}\n상태: ${s.status}\n변경: ${s.entries.length}개`);
    for (const e of s.entries) console.log(`- ${e.path} — ${e.kind}${e.done ? ' (적용됨)' : ''}`);
  };
  if (cmd === 'prepare') {
    const plan = JSON.parse(fs.readFileSync(arg, 'utf8'));
    const { root, changes } = fromPlan(plan, path.dirname(path.resolve(arg)));
    const dir = prepare(root, changes);
    console.log(`기록: ${dir}`);
    return list(dir);
  }
  if (cmd === 'show') {
    list(arg);
    const d = diff(arg);
    return d && console.log(`\n${d}`);
  }
  if (cmd === 'apply') {
    const r = apply(arg);
    console.log(`적용 완료: ${r.written.length}개 씀`);
    for (const f of r.written) console.log(`- ${f}`);
    return;
  }
  if (cmd === 'rollback') {
    const r = rollback(arg);
    console.log(`되돌림 완료: ${r.restored.length}개`);
    for (const f of r.restored) console.log(`- ${f}`);
    return;
  }
  throw new Error(`모르는 명령: ${cmd}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    if (e instanceof Conflict) {
      process.stderr.write(`적용 중단: ${e.message}\n${e.files.map((f) => `- ${f}`).join('\n')}\n`);
      process.exit(1);
    }
    process.stderr.write(`적용 오류: ${e.message}\n`);
    process.exit(2);
  }
}
