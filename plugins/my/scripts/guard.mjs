#!/usr/bin/env node
// 편집 금지 확인: 실행 전 파일 상태를 기록하고, 끝난 뒤 달라진 파일을 찾고, 승인되면 기록대로 되돌린다.
// 사용: node guard.mjs snap [파일 …]     → 기록 폴더 경로 출력. git 저장소면 커밋 안 된 파일도 함께 기록한다
//       node guard.mjs check <기록 폴더>  → 달라진 파일과 diff. 달라졌으면 종료 코드 1
//       node guard.mjs restore <기록 폴더> <파일> → 그 파일을 기록 당시 내용으로 되돌린다
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitRoot, normalizePath } from './config.mjs';

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const readOrNull = (f) => (fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null);

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
  } catch {
    return null;
  }
}

// 커밋 안 된 파일(추적·미추적) 목록, 루트 기준 상대 경로.
function dirtyFiles(root) {
  const out = git(root, ['status', '--porcelain', '-z', '--untracked-files=all']);
  if (out == null) return [];
  const parts = out.split('\0').filter(Boolean);
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i].slice(0, 2);
    files.push(parts[i].slice(3));
    if (code.includes('R') || code.includes('C')) i++; // 이름 바뀜: 다음 항목은 옛 이름
  }
  return files;
}

export function snap({ cwd = process.cwd(), files = [], dir } = {}) {
  const root = gitRoot(cwd);
  const base = root ?? normalizePath(cwd);
  dir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'my-guard-'));
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  const rels = new Set(files.map((f) => path.relative(base, path.resolve(cwd, f)).replace(/\\/g, '/')));
  if (root) for (const f of dirtyFiles(root)) rels.add(f);
  const entries = {};
  for (const rel of [...rels].sort()) {
    const buf = readOrNull(path.join(base, rel));
    entries[rel] = buf ? hash(buf) : null;
    if (buf) {
      const copy = path.join(dir, 'files', rel);
      fs.mkdirSync(path.dirname(copy), { recursive: true });
      fs.writeFileSync(copy, buf);
    }
  }
  const head = root ? (git(root, ['rev-parse', 'HEAD']) || '').trim() || null : null;
  const manifest = { root: base, inGit: !!root, head, entries, dirty: root ? dirtyFiles(root) : [] };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dir.replace(/\\/g, '/');
}

const load = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

// 달라진 파일: { file, kind: '바뀜'|'지워짐'|'새 파일', source: 'snap'|'HEAD'|null }
export function check(dir) {
  const m = load(dir);
  const changed = [];
  for (const [rel, h] of Object.entries(m.entries)) {
    const buf = readOrNull(path.join(m.root, rel));
    const now = buf ? hash(buf) : null;
    if (now === h) continue;
    changed.push({ file: rel, kind: h == null ? '새 파일' : now == null ? '지워짐' : '바뀜', source: h == null ? null : 'snap' });
  }
  if (m.inGit) {
    const head = (git(m.root, ['rev-parse', 'HEAD']) || '').trim() || null;
    if (head !== m.head) changed.push({ file: '(HEAD)', kind: `커밋이 바뀜 ${m.head ?? '없음'} → ${head ?? '없음'}`, source: null });
    for (const rel of dirtyFiles(m.root)) {
      if (rel in m.entries) continue;
      const tracked = git(m.root, ['cat-file', '-e', `HEAD:${rel}`]) != null;
      changed.push({ file: rel, kind: tracked ? (readOrNull(path.join(m.root, rel)) ? '바뀜' : '지워짐') : '새 파일', source: tracked ? 'HEAD' : null });
    }
  }
  return { root: m.root, changed };
}

function original(m, dir, c) {
  if (c.source === 'snap') return fs.readFileSync(path.join(dir, 'files', c.file));
  if (c.source === 'HEAD') return execFileSync('git', ['show', `HEAD:${c.file}`], { cwd: m.root });
  return null;
}

export function diffText(dir, c) {
  const m = load(dir);
  const orig = original(m, dir, c);
  if (orig == null) return '';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'my-guard-diff-'));
  const a = path.join(tmp, 'before');
  fs.writeFileSync(a, orig);
  const b = path.join(m.root, c.file);
  try {
    execFileSync('git', ['diff', '--no-index', '--', a, fs.existsSync(b) ? b : os.devNull], { encoding: 'utf8' });
    return '';
  } catch (e) {
    return String(e.stdout || '');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function restore(dir, file) {
  const m = load(dir);
  const c = check(dir).changed.find((x) => x.file === file);
  if (!c) throw new Error(`달라진 파일이 아니다: ${file}`);
  const orig = original(m, dir, c);
  if (orig == null) throw new Error(`되돌릴 원래 내용이 없다(${c.kind}): ${file}. 직접 확인한다`);
  const target = path.join(m.root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, orig);
  return target.replace(/\\/g, '/');
}

function cli([cmd, ...rest]) {
  if (cmd === 'snap') return console.log(snap({ files: rest }));
  if (cmd === 'check') {
    if (!rest[0]) throw new Error('기록 폴더를 준다');
    const { root, changed } = check(rest[0]);
    if (!changed.length) return console.log(`편집 없음: ${root}`);
    console.log(`편집 금지 위반: ${changed.length}개 (${root})`);
    for (const c of changed) console.log(`- ${c.file} — ${c.kind}${c.source ? '' : ' (자동으로 되돌릴 수 없음)'}`);
    for (const c of changed) {
      const d = diffText(rest[0], c);
      if (d) console.log(`\n${d}`);
    }
    process.exitCode = 1;
    return;
  }
  if (cmd === 'restore') {
    if (!rest[0] || !rest[1]) throw new Error('기록 폴더와 파일을 준다');
    return console.log(`되돌림: ${restore(rest[0], rest[1])}`);
  }
  throw new Error('명령: snap [파일 …] | check <기록 폴더> | restore <기록 폴더> <파일>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`확인 오류: ${e.message}\n`);
    process.exit(2);
  }
}
