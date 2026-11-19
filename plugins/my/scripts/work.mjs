#!/usr/bin/env node
// 세션 흐름(A): 현재 프로젝트 상황, 인계 문서 찾기·만들기. 파일을 쓰는 것은 new-handoff뿐이다.
// 사용: node work.mjs context            → 프로젝트 상황(마크다운)
//       node work.mjs status             → 할 일·진행·완료(마크다운)
//       node work.mjs latest             → 가장 최근 인계 문서 경로와 내용
//       node work.mjs new-handoff [--branch B] [--spec S]  → 양식으로 새 인계 문서를 만들고 경로 출력
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitRoot, normalizePath, resolveConfig } from './config.mjs';
import { frontmatter } from './status.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.resolve(HERE, '..', 'templates', 'handoff.md');

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trimEnd();
  } catch {
    return null;
  }
}

// 프로젝트 루트: git 루트, 없으면 현재 폴더(inGit=false).
export function projectRoot(cwd = process.cwd()) {
  const r = gitRoot(cwd);
  return { root: r ?? normalizePath(cwd), inGit: !!r };
}

const handoffDir = (root) => path.join(root, 'docs', 'handoff');

// 이름(YYYYMMDD-HHMM[-n]) 순으로 마지막 것.
export function latestHandoff(root) {
  const dir = handoffDir(root);
  if (!fs.existsSync(dir)) return null;
  const names = fs
    .readdirSync(dir)
    .filter((f) => /^\d{8}-\d{4}(-\d+)?\.md$/.test(f))
    .map((f) => f.slice(0, -3))
    .sort((a, b) => {
      const [x, y] = [a, b].map((s) => s.split('-'));
      return x[0].localeCompare(y[0]) || x[1].localeCompare(y[1]) || Number(x[2] ?? 0) - Number(y[2] ?? 0);
    });
  return names.length ? path.join(dir, names.at(-1) + '.md').replace(/\\/g, '/') : null;
}

const pad = (n) => String(n).padStart(2, '0');
export const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;

export function newHandoff(root, { branch = '', spec = '', now = new Date(), template = TEMPLATE } = {}) {
  const dir = handoffDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const base = stamp(now);
  let file = path.join(dir, `${base}.md`);
  for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, `${base}-${n}.md`);
  const text = fs
    .readFileSync(template, 'utf8')
    .replace('{{branch}}', JSON.stringify(branch))
    .replace('{{spec}}', JSON.stringify(spec))
    .replace('{{date}}', `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  fs.writeFileSync(file, text, { flag: 'wx' });
  return file.replace(/\\/g, '/');
}

// 명세의 "## 작업" 절 체크박스 수.
export function specTasks(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = /^## 작업[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text);
  const body = m ? m[1] : '';
  const open = [...body.matchAll(/^\s*[-*] \[ \] (.+)$/gm)].map((x) => x[1].trim());
  const done = (body.match(/^\s*[-*] \[[xX]\] /gm) || []).length;
  return { open, done, total: open.length + done };
}

export function specs(root) {
  const dir = path.join(root, 'docs', 'specs');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
    .map((f) => {
      const p = path.join(dir, f);
      return { file: `docs/specs/${f}`, status: frontmatter(p)?.status || '(없음)', ...specTasks(p) };
    });
}

// 인계 문서의 "## 다음 할 일" 항목.
export function nextItems(file) {
  if (!file) return [];
  const m = /^## 다음 할 일[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(fs.readFileSync(file, 'utf8'));
  return m ? [...m[1].matchAll(/^\s*(?:[-*]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.+)$/gm)].map((x) => x[1].trim()) : [];
}

const rel = (root, f) => (f ? path.relative(root, f).replace(/\\/g, '/') : '(없음)');

export function buildContext(cwd = process.cwd()) {
  const { root, inGit } = projectRoot(cwd);
  const out = [`## 프로젝트: ${root}`, ''];
  if (!inGit) out.push('- git 루트 없음 — 현재 폴더 기준', '');
  else {
    const branch = git(root, ['branch', '--show-current']) || '(분리된 HEAD)';
    const changed = (git(root, ['status', '--porcelain']) || '').split('\n').filter(Boolean);
    const log = git(root, ['log', '-5', '--format=%h %ad %s', '--date=short']) || '(커밋 없음)';
    out.push(`- 브랜치: ${branch}`, `- 커밋 안 된 변경: ${changed.length}개`);
    for (const l of changed.slice(0, 20)) out.push(`  - \`${l}\``);
    if (changed.length > 20) out.push(`  - … 외 ${changed.length - 20}개`);
    out.push('', '### 최근 커밋', '', ...log.split('\n').map((l) => `- ${l}`), '');
  }
  const docs = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'README.md', 'docs/stack.md', 'docs/requirements.md', 'docs/trace.md']
    .filter((f) => fs.existsSync(path.join(root, f)))
    .map((f) => `- ${f}`);
  const sp = specs(root);
  docs.push(...sp.map((s) => `- ${s.file} — ${s.status}, 작업 ${s.done}/${s.total}`));
  out.push('### 문서', '', ...(docs.length ? docs : ['- 없음']));
  const h = latestHandoff(root);
  out.push('', `### 최근 인계 문서: ${rel(root, h)}`);
  const cfg = resolveConfig({ cwd: root });
  out.push('', `- 작업 종료 질문(work_end_question): ${cfg.values.work_end_question.value ? '켬' : '끔'}`);
  return out.join('\n') + '\n';
}

export function buildStatus(cwd = process.cwd()) {
  const { root } = projectRoot(cwd);
  const sp = specs(root);
  const h = latestHandoff(root);
  const out = [`## 작업 현황: ${root}`, ''];
  const group = (title, list) => {
    out.push(`### ${title}`, '');
    out.push(...(list.length ? list : ['- 없음']), '');
  };
  const known = ['approved', 'done'];
  const todo = sp.filter((s) => !known.includes(s.status));
  const doing = sp.filter((s) => s.status === 'approved');
  const done = sp.filter((s) => s.status === 'done');
  const line = (s) =>
    `- ${s.file} — 작업 ${s.done}/${s.total}${known.includes(s.status) || s.status === 'draft' ? '' : ` (status: ${s.status})`}`;
  group('할 일', [
    ...todo.map(line),
    ...nextItems(h).map((t) => `- ${t} (인계 문서)`),
  ]);
  group('진행', doing.flatMap((s) => [line(s), ...s.open.map((t) => `  - [ ] ${t}`)]));
  group('완료', done.map(line));
  out.push(`- 기준: 명세 \`status\`(draft=할 일, approved=진행, done=완료)와 최근 인계 문서(${rel(root, h)})`);
  if (!sp.length && !h) out.push('- 명세와 인계 문서가 없다');
  return out.join('\n') + '\n';
}

function cli(argv) {
  const [cmd, ...rest] = argv;
  const opt = (k) => {
    const i = rest.indexOf(k);
    return i >= 0 ? rest[i + 1] ?? '' : '';
  };
  const { root } = projectRoot();
  if (cmd === 'context') return process.stdout.write(buildContext());
  if (cmd === 'status') return process.stdout.write(buildStatus());
  if (cmd === 'latest') {
    const h = latestHandoff(root);
    if (!h) throw new Error(`인계 문서가 없다: ${root}/docs/handoff/`);
    return process.stdout.write(`경로: ${h}\n\n${fs.readFileSync(h, 'utf8')}`);
  }
  if (cmd === 'new-handoff') {
    return process.stdout.write(newHandoff(root, { branch: opt('--branch'), spec: opt('--spec') }) + '\n');
  }
  throw new Error('명령: context | status | latest | new-handoff [--branch B] [--spec S]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`작업 오류: ${e.message}\n`);
    process.exit(1);
  }
}
