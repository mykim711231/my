#!/usr/bin/env node
// `마이 플러그인 개선`의 정해진 일: 대기 목록, 항목 보기, 버전 올림 + CHANGELOG, 완료 표시, 버전 일치 검사.
// 원본 파일을 고치는 일(수정안 작성)은 스킬이 하고, 이 스크립트는 하지 않는다.
// 사용: node apply.mjs list | show <ID> | check
//       node apply.mjs bump <patch|minor|major> --ids <ID,ID> -- <변경 줄> [<변경 줄> …]
//       node apply.mjs done <ID> [<ID> …] --version <버전>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolveConfig, normalizePath } from './config.mjs';
import { dataDir } from './issue.mjs';
import { frontmatter } from './status.mjs';

// G-4: 네 매니페스트. 있는 것만 검사하고 함께 올린다.
export const MANIFESTS = ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json', 'gemini-extension.json', '.antigravity-plugin/plugin.json'];

// 원본(plugin_src)에서 플러그인 폴더를 찾는다. 마켓플레이스 루트면 plugins/my, 아니면 그 폴더 자체.
export function pluginDir(src) {
  if (!src) throw new Error('원본 경로 `plugin_src`가 없다. `마이 플러그인 설정`에서 정하라');
  for (const d of [path.join(src, 'plugins', 'my'), src]) {
    if (fs.existsSync(path.join(d, '.claude-plugin', 'plugin.json'))) return d;
  }
  throw new Error(`원본에서 my 플러그인을 찾지 못했다: ${normalizePath(src)}`);
}

export function listItems(dir) {
  const d = path.join(dir, 'improvements');
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d)
    .filter((f) => /^IMP-.*\.md$/.test(f))
    .map((f) => ({ file: path.join(d, f), ...frontmatter(path.join(d, f)) }))
    .map((it) => ({ ...it, id: it.id || path.basename(it.file, '.md'), status: it.status || 'open' }))
    .sort((a, b) => String(a.created).localeCompare(String(b.created)));
}

// 전체 ID 또는 앞부분(예: IMP-9c84)으로 찾는다. 여러 개가 맞으면 실패.
export function findItem(dir, id) {
  const hits = listItems(dir).filter((it) => it.id === id || it.id.startsWith(id));
  if (hits.length === 0) throw new Error(`기록이 없다: ${id}`);
  if (hits.length > 1) throw new Error(`여러 기록이 맞는다: ${hits.map((h) => h.id).join(', ')}`);
  return hits[0];
}

export function versions(pdir) {
  return MANIFESTS.filter((m) => fs.existsSync(path.join(pdir, m))).map((m) => ({
    file: m,
    version: JSON.parse(fs.readFileSync(path.join(pdir, m), 'utf8')).version,
  }));
}

export function checkVersions(pdir) {
  const vs = versions(pdir);
  const problems = [];
  const set = new Set(vs.map((v) => v.version));
  if (set.size !== 1) problems.push(`매니페스트 버전이 다르다: ${vs.map((v) => `${v.file}=${v.version}`).join(', ')}`);
  const top = /^## (\S+)/m.exec(readOr(path.join(pdir, 'CHANGELOG.md')))?.[1];
  if (vs[0] && top !== vs[0].version) problems.push(`CHANGELOG 맨 위(${top ?? '없음'})가 버전 ${vs[0].version}과 다르다`);
  return { versions: vs, problems };
}

// 원본 플러그인 폴더의 커밋 안 된 변경 수. git이 없거나 저장소가 아니면 null(미확인).
export function dirtyCount(pdir) {
  try {
    const out = execFileSync('git', ['-C', pdir, 'status', '--porcelain', '--', '.'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').filter(Boolean).length;
  } catch {
    return null;
  }
}

const readOr = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');

export function nextVersion(v, kind) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v || '');
  if (!m) throw new Error(`SemVer가 아니다: ${v}`);
  const [a, b, c] = m.slice(1).map(Number);
  if (kind === 'major') return `${a + 1}.0.0`;
  if (kind === 'minor') return `${a}.${b + 1}.0`;
  if (kind === 'patch') return `${a}.${b}.${c + 1}`;
  throw new Error(`올림 종류는 patch, minor, major 중 하나다: ${kind}`);
}

// 매니페스트를 모두 같은 새 버전으로 올리고 CHANGELOG 맨 위에 항목을 넣는다.
export function bump(pdir, kind, { ids = [], lines = [], date = new Date() } = {}) {
  const { versions: vs, problems } = checkVersions(pdir);
  if (problems.length) throw new Error(`올리기 전 검사 실패: ${problems.join('; ')}`);
  if (!lines.length) throw new Error('CHANGELOG에 쓸 변경 줄이 없다');
  const to = nextVersion(vs[0].version, kind);
  for (const { file } of vs) {
    const f = path.join(pdir, file);
    const text = fs.readFileSync(f, 'utf8');
    const out = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${to}$2`);
    if (out === text) throw new Error(`${file}의 version을 바꾸지 못했다`);
    fs.writeFileSync(f, out);
  }
  const day = date.toISOString().slice(0, 10);
  const entry = [`## ${to} — ${day}`, '', ...lines.map((l) => `- ${l}`), ...(ids.length ? [`- 반영: ${ids.join(', ')}`] : []), '', ''].join('\n');
  const cl = path.join(pdir, 'CHANGELOG.md');
  const old = readOr(cl);
  const at = old.search(/^## /m);
  fs.writeFileSync(cl, at < 0 ? `${old || '# Changelog\n\n'}${entry}` : old.slice(0, at) + entry + old.slice(at));
  return { from: vs[0].version, to, files: vs.map((v) => v.file) };
}

// 기록을 완료로 표시한다. 파일은 지우지 않는다.
export function markDone(dir, id, version, date = new Date()) {
  const it = findItem(dir, id);
  if (it.status !== 'open') throw new Error(`${it.id}는 이미 ${it.status}다`);
  const text = fs.readFileSync(it.file, 'utf8');
  const out = text.replace(/^status: .*$/m, `status: "done"\napplied: ${JSON.stringify(date.toISOString())}\nversion: ${JSON.stringify(version)}`);
  if (out === text) throw new Error(`${it.id}의 status 줄을 찾지 못했다`);
  fs.writeFileSync(it.file, out);
  return it.id;
}

function table(items) {
  const open = items.filter((it) => it.status === 'open');
  if (!open.length) return '- 대기 중인 기록 없음';
  return ['| ID | 작성 | 스킬 | 내용 |', '|---|---|---|---|', ...open.map((it) =>
    `| \`${it.id.slice(0, 12)}\` | ${String(it.created).slice(0, 10)} | ${it.skill || '미확인'} | ${String(it.title).replace(/\|/g, '\\|')} |`)].join('\n');
}

function cli(argv, { env = process.env, home = os.homedir() } = {}) {
  const [cmd, ...rest] = argv;
  const dd = dataDir(env, home);
  const cfg = resolveConfig({ env, home });
  const src = cfg.values.plugin_src;
  if (cmd === 'list') {
    let where;
    let dirty = [];
    try {
      const p = pluginDir(src.value);
      where = `\`${normalizePath(p)}\` (출처: \`${src.source}\`)`;
      const n = dirtyCount(p);
      dirty = [`- 커밋 안 된 변경: ${n === null ? '미확인 (git 저장소 아님)' : `${n}개`}`];
    } catch (e) {
      where = `없음: ${e.message}`;
    }
    console.log(['### 개선 대기', '', `- 데이터 폴더: \`${normalizePath(dd.dir)}\` (${dd.how})`, `- 고칠 원본: ${where}`, ...dirty, '', table(listItems(dd.dir))].join('\n'));
    return 0;
  }
  if (cmd === 'show') {
    const it = findItem(dd.dir, rest[0] || '');
    console.log(`파일: ${normalizePath(it.file)}\n\n${fs.readFileSync(it.file, 'utf8')}`);
    return 0;
  }
  const pdir = pluginDir(src.value);
  if (cmd === 'check') {
    const r = checkVersions(pdir);
    console.log(r.versions.map((v) => `- ${v.file}: ${v.version}`).join('\n'));
    if (r.problems.length) {
      console.error(r.problems.map((p) => `실패: ${p}`).join('\n'));
      return 1;
    }
    console.log('버전 일치');
    return 0;
  }
  if (cmd === 'bump') {
    const sep = rest.indexOf('--');
    const head = sep < 0 ? rest : rest.slice(0, sep);
    const lines = sep < 0 ? [] : rest.slice(sep + 1);
    const i = head.indexOf('--ids');
    const ids = i < 0 ? [] : (head[i + 1] || '').split(',').filter(Boolean).map((id) => findItem(dd.dir, id).id);
    const r = bump(pdir, head[0], { ids, lines });
    console.log(`버전: ${r.from} → ${r.to} (${r.files.join(', ')})\nCHANGELOG에 추가함`);
    return 0;
  }
  if (cmd === 'done') {
    const i = rest.indexOf('--version');
    if (i < 0 || !rest[i + 1]) throw new Error('--version <버전>이 필요하다');
    const ids = rest.filter((_, k) => k !== i && k !== i + 1);
    if (!ids.length) throw new Error('완료로 표시할 ID가 없다');
    for (const id of ids) console.log(`완료 표시: ${markDone(dd.dir, id, rest[i + 1])}`);
    return 0;
  }
  console.error('사용: apply.mjs list | show <ID> | check | bump <patch|minor|major> --ids <ID,…> -- <변경 줄>… | done <ID>… --version <버전>');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(cli(process.argv.slice(2)));
  } catch (e) {
    console.error(`개선 오류: ${e.message}`);
    process.exit(1);
  }
}
