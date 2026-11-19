#!/usr/bin/env node
// 프로젝트(C): 템플릿 뼈대, 명세 만들기, 추적표 생성, 문서 점검.
// 사용: node project.mjs stacks                                   → 쓸 수 있는 스택 목록
//       node project.mjs scaffold <스택[:역할]>... [--name N] [--gemini] [--var k=v]... [--plan] [--skip-existing]
//                                                               → 공통·스택 파일을 만든다(--plan이면 계획만)
//       node project.mjs new-spec <이름> --title <제목>          → docs/specs/NN-<이름>.md
//       node project.mjs trace [--check]                        → docs/trace.md 생성(--check면 차이만 검사)
//       node project.mjs check                                  → 명세·요구사항·문서 점검
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodingProblems, headingProblems, headingsOf, linkProblems, mdFiles } from './md.mjs';
import { frontmatter } from './status.mjs';
import { projectRoot } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATES = path.resolve(HERE, '..', 'templates', 'project');

const pad = (n) => String(n).padStart(2, '0');
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const slash = (p) => p.replace(/\\/g, '/');
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const SECTIONS = ['목표', '범위 밖', '요구사항', '수용 기준', '기술 계획', '작업', '검증 결과'];
export const SPEC_STATUS = ['draft', 'approved', 'done'];
export const REQ_STATUS = ['초안', '승인', '취소'];
const REQ = /^REQ-\d{2,}$/;
// 뼈대를 만들 때 바꾸지 않고 남기는 자리표시(new-spec이 채운다).
const LATER = new Set(['title']);
export const TRACE_HEAD = '<!-- 생성됨 — 직접 수정 금지 -->';

export function stacks(dir = TEMPLATES) {
  const d = path.join(dir, 'stacks');
  if (!fs.existsSync(d)) return [];
  return fs
    .readdirSync(d, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const part = path.join(d, e.name, 'stack.part.md');
      const head = fs.existsSync(part) ? fs.readFileSync(part, 'utf8').split('\n')[0].replace(/^#+\s*/, '') : '';
      return { name: e.name, title: head.replace(/\s*\(`\{\{root\}\}`\)$/, '') };
    });
}

// 파일 이름의 dot- 앞머리를 .으로 바꾼다.
const outName = (rel) => rel.split('/').map((s) => (s.startsWith('dot-') ? '.' + s.slice(4) : s)).join('/');

export function render(text, vars, where) {
  return text.replace(/\{\{([A-Za-z]+)\}\}/g, (m, k) => {
    if (k in vars) return vars[k];
    if (LATER.has(k)) return m;
    throw new Error(`모르는 자리표시 {{${k}}}: ${where}`);
  });
}

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else out.push(slash(path.relative(base, p)));
  }
  return out.sort();
}

// 스택 지정 "fastapi" 또는 "fastapi:api". 둘 이상이면 모두 역할을 붙이고 apps/<역할>/에 둔다.
export function parseStacks(specs, dir = TEMPLATES) {
  if (!specs.length) throw new Error('스택을 하나 이상 준다. `stacks`로 목록을 본다');
  const known = stacks(dir).map((s) => s.name);
  const list = specs.map((s) => {
    const [stack, role = ''] = s.split(':');
    if (!known.includes(stack)) throw new Error(`없는 스택: ${stack} (있는 것: ${known.join(', ')})`);
    if (role && !KEBAB.test(role)) throw new Error(`역할 이름은 영문 kebab-case: ${role}`);
    return { stack, role };
  });
  if (list.length > 1) {
    const missing = list.filter((s) => !s.role).map((s) => s.stack);
    if (missing.length) throw new Error(`스택이 둘 이상이면 역할을 붙인다(예: fastapi:api pwa:web): ${missing.join(', ')}`);
    const roles = list.map((s) => s.role);
    const dup = roles.filter((r, i) => roles.indexOf(r) !== i);
    if (dup.length) throw new Error(`역할이 겹친다: ${[...new Set(dup)].join(', ')}`);
  }
  return list.map((s) => ({ ...s, root: list.length > 1 ? `apps/${s.role}` : '.' }));
}

// 만들 파일 목록 [{path, content}]. 파일은 쓰지 않는다.
export function plan(root, specs, { name, gemini = false, vars = {}, date = today(), dir = TEMPLATES } = {}) {
  const list = parseStacks(specs, dir);
  const base = { name: name || path.basename(root), date, ...vars };
  if (list.some((s) => s.stack === 'spring')) {
    if (!base.package) throw new Error('spring 스택은 --var package=<패키지>(예: com.example.app)가 필요하다');
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(base.package)) throw new Error(`패키지 이름이 올바르지 않다: ${base.package}`);
  }
  if (base.package) base.packagePath = base.package.replace(/\./g, '/');
  const files = [];
  const add = (rel, src, v) => {
    const target = render(outName(rel), v, src);
    files.push({ path: target, content: render(fs.readFileSync(src, 'utf8'), v, src) });
  };
  const common = path.join(dir, 'common');
  const cv = { ...base, root: '.', contracts: 'contracts' };
  for (const rel of walk(common)) {
    if (rel === 'GEMINI.md' && !gemini) continue;
    add(rel, path.join(common, rel), cv);
  }
  const stackMd = files.find((f) => f.path === 'docs/stack.md');
  for (const s of list) {
    const sdir = path.join(dir, 'stacks', s.stack);
    const v = { ...base, root: s.root, contracts: s.root === '.' ? 'contracts' : slash(path.relative(s.root, 'contracts')) };
    for (const sub of ['files', 'sample'])
      for (const rel of walk(path.join(sdir, sub))) {
        const out = s.root === '.' ? rel : `${s.root}/${rel}`;
        add(out, path.join(sdir, sub, rel), v);
      }
    const part = path.join(sdir, 'stack.part.md');
    if (stackMd && fs.existsSync(part)) stackMd.content = stackMd.content.replace(/\n*$/, '\n\n') + render(fs.readFileSync(part, 'utf8'), v, part);
  }
  for (const f of files) f.exists = fs.existsSync(path.join(root, f.path));
  return { stacks: list, files };
}

export function scaffold(root, specs, opts = {}) {
  const p = plan(root, specs, opts);
  const conflicts = p.files.filter((f) => f.exists);
  if (opts.planOnly) return { ...p, written: [], skipped: conflicts.map((f) => f.path) };
  if (conflicts.length && !opts.skipExisting)
    throw new Error(`이미 있는 파일이 있어 아무것도 쓰지 않았다(덮어쓰지 않는다). 나머지만 만들려면 --skip-existing:\n${conflicts.map((f) => `- ${f.path}`).join('\n')}`);
  const written = [];
  for (const f of p.files) {
    if (f.exists) continue;
    const t = path.join(root, f.path);
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, f.content, { flag: 'wx' });
    written.push(f.path);
  }
  return { ...p, written, skipped: conflicts.map((f) => f.path) };
}

export function newSpec(root, name, { title, date = today(), dir = TEMPLATES } = {}) {
  if (!KEBAB.test(name || '')) throw new Error(`명세 이름은 영문 kebab-case: ${name}`);
  if (!title) throw new Error('--title <제목>을 준다');
  const sdir = path.join(root, 'docs', 'specs');
  const own = path.join(sdir, '_template.md');
  const tpl = fs.existsSync(own) ? own : path.join(dir, 'common', 'docs', 'specs', '_template.md');
  fs.mkdirSync(sdir, { recursive: true });
  const nums = fs.readdirSync(sdir).map((f) => /^(\d+)-.+\.md$/.exec(f)).filter(Boolean).map((m) => Number(m[1]));
  if (fs.readdirSync(sdir).some((f) => f.replace(/^\d+-/, '') === `${name}.md`)) throw new Error(`같은 이름의 명세가 있다: ${name}`);
  const file = path.join(sdir, `${pad(Math.max(0, ...nums) + 1)}-${name}.md`);
  const text = fs
    .readFileSync(tpl, 'utf8')
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{date\}\}/g, date)
    .replace(/^updated:.*$/m, `updated: ${date}`)
    .replace(/^status:.*$/m, 'status: draft');
  fs.writeFileSync(file, text, { flag: 'wx' });
  return slash(path.relative(root, file));
}

// requirements.md 표의 요구사항 [{id, text, status}]
export function requirements(root) {
  const f = path.join(root, 'docs', 'requirements.md');
  if (!fs.existsSync(f)) return null;
  const rows = [];
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length >= 2 && /^REQ-/.test(cells[0])) rows.push({ id: cells[0], text: cells[1], status: cells.at(-1) });
  }
  return rows;
}

const parseList = (v) =>
  String(v ?? '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);

const SKIP = new Set(['node_modules', 'build', 'dist', 'target', 'coverage', 'test-results', 'playwright-report', '__pycache__', 'venv']);
const TEXT = /\.(py|ts|tsx|js|jsx|mjs|cjs|java|kt|kts|sql|json|ya?ml|toml|graphql|proto|vue|svelte|html|css)$/i;
const isTest = (rel) => /(^|\/)(tests?|e2e|__tests__)\//.test(rel) || /(\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]+$|_test\.[a-z]+$|Tests?\.(java|kt)$)/.test(rel);

function sourceFiles(dir, base, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, base, out);
    else out.push(slash(path.relative(base, p)));
  }
  return out;
}

// 요구사항 ID가 나오는 곳: 명세 / DB / 계약 / 코드 / 테스트
export function buildTrace(root) {
  const reqs = requirements(root);
  if (!reqs) throw new Error('docs/requirements.md가 없다');
  const cols = { 명세: [], DB: [], 계약: [], 코드: [], 테스트: [] };
  const files = sourceFiles(root, root).sort();
  const kind = (rel) => {
    if (/^docs\/specs\/[^_/][^/]*\.md$/.test(rel)) return '명세';
    if (rel.startsWith('docs/') || rel.endsWith('.md')) return null;
    if (rel.startsWith('db/')) return 'DB';
    if (rel.startsWith('contracts/')) return '계약';
    if (!TEXT.test(rel)) return null;
    return isTest(rel) ? '테스트' : '코드';
  };
  const hits = new Map(reqs.map((r) => [r.id, { 명세: [], DB: [], 계약: [], 코드: [], 테스트: [] }]));
  for (const rel of files) {
    const k = kind(rel);
    if (!k) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    for (const id of new Set(text.match(/\bREQ-\d{2,}\b/g) || [])) hits.get(id)?.[k].push(rel);
  }
  const cell = (list) => (list.length ? list.slice(0, 5).map((f) => `\`${f}\``).join('<br>') + (list.length > 5 ? `<br>외 ${list.length - 5}개` : '') : '—');
  const out = [TRACE_HEAD, '# 추적표', '', '`docs/requirements.md`의 요구사항 ID가 나오는 파일이다. `project.mjs trace`로 다시 만든다.', ''];
  out.push(`| ID | 상태 | ${Object.keys(cols).join(' | ')} |`, `|---|---|${Object.keys(cols).map(() => '---').join('|')}|`);
  for (const r of reqs) out.push(`| ${r.id} | ${r.status} | ${Object.values(hits.get(r.id)).map(cell).join(' | ')} |`);
  return out.join('\n') + '\n';
}

export function writeTrace(root, { check = false } = {}) {
  const f = path.join(root, 'docs', 'trace.md');
  const next = buildTrace(root);
  const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  if (check) return { file: 'docs/trace.md', same: cur === next };
  if (cur !== next) fs.writeFileSync(f, next);
  return { file: 'docs/trace.md', same: cur === next };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function check(root) {
  const problems = [];
  const notes = [];
  const add = (file, kind, detail) => problems.push({ file: slash(path.relative(root, file)), kind, detail });
  const reqs = requirements(root);
  const reqFile = path.join(root, 'docs', 'requirements.md');
  const ids = new Set();
  if (!reqs) notes.push('docs/requirements.md 없음 — 요구사항 점검 건너뜀');
  else {
    if (!DATE.test(frontmatter(reqFile)?.updated || '')) add(reqFile, '앞머리', 'updated: YYYY-MM-DD가 필요하다');
    for (const r of reqs) {
      if (!REQ.test(r.id)) add(reqFile, '요구사항 ID', `${r.id} — REQ-NN 형식으로 쓴다`);
      if (ids.has(r.id)) add(reqFile, '요구사항 ID', `${r.id} 중복`);
      ids.add(r.id);
      if (!REQ_STATUS.includes(r.status)) add(reqFile, '요구사항 상태', `${r.id}: ${r.status} — ${REQ_STATUS.join(' / ')} 중 하나`);
    }
  }
  const stackFile = path.join(root, 'docs', 'stack.md');
  if (fs.existsSync(stackFile) && !DATE.test(frontmatter(stackFile)?.updated || '')) add(stackFile, '앞머리', 'updated: YYYY-MM-DD가 필요하다');
  const sdir = path.join(root, 'docs', 'specs');
  for (const f of fs.existsSync(sdir) ? fs.readdirSync(sdir).filter((n) => n.endsWith('.md') && !n.startsWith('_')).sort() : []) {
    const file = path.join(sdir, f);
    if (!/^\d{2,}-[a-z0-9]+(-[a-z0-9]+)*\.md$/.test(f)) add(file, '명세 이름', 'NN-<영문-kebab>.md로 쓴다');
    const fm = frontmatter(file) || {};
    if (!SPEC_STATUS.includes(fm.status)) add(file, '앞머리', `status: ${fm.status ?? '(없음)'} — ${SPEC_STATUS.join(' / ')} 중 하나`);
    if (!DATE.test(fm.updated || '')) add(file, '앞머리', 'updated: YYYY-MM-DD가 필요하다');
    if (!('reqs' in fm)) add(file, '앞머리', 'reqs: [REQ-NN, …]가 필요하다');
    for (const id of parseList(fm.reqs)) {
      if (!REQ.test(id)) add(file, '요구사항 ID', `${id} — REQ-NN 형식으로 쓴다`);
      else if (reqs && !ids.has(id)) add(file, '요구사항 ID', `${id} — docs/requirements.md에 없다`);
    }
    if (fm.status !== 'draft' && !parseList(fm.reqs).length) add(file, '앞머리', `status: ${fm.status}인데 reqs가 비었다`);
    const h2 = headingsOf(fs.readFileSync(file, 'utf8')).filter((h) => h.level === 2).map((h) => h.text);
    if (h2.join('|') !== SECTIONS.join('|')) add(file, '명세 절', `${h2.join(' / ') || '(없음)'} — ${SECTIONS.join(' / ')} 그대로 쓴다`);
  }
  const traceFile = path.join(root, 'docs', 'trace.md');
  if (fs.existsSync(traceFile)) {
    if (fs.readFileSync(traceFile, 'utf8').split(/\r?\n/)[0] !== TRACE_HEAD) add(traceFile, '생성 표시', `첫 줄은 ${TRACE_HEAD}`);
    if (reqs && !writeTrace(root, { check: true }).same) add(traceFile, '다시 생성 차이', '`project.mjs trace`로 다시 만든다(직접 고치지 않는다)');
  } else if (reqs) notes.push('docs/trace.md 없음 — `project.mjs trace`로 만든다');
  const md = [...fs.readdirSync(root).filter((n) => n.endsWith('.md')).map((n) => path.join(root, n)), ...mdFiles(path.join(root, 'docs'))];
  let mermaid = false;
  for (const f of md) {
    const raw = fs.readFileSync(f);
    const text = raw.toString('utf8');
    if (/^(```|~~~)\s*mermaid/m.test(text)) mermaid = true;
    for (const p of encodingProblems(raw)) add(f, p.kind, p.detail);
    for (const p of headingProblems(text)) add(f, p.kind, p.detail);
    for (const p of linkProblems(f, text)) add(f, p.kind, p.detail);
  }
  if (mermaid) notes.push('Mermaid 미검증');
  return { problems, notes };
}

export function report({ problems, notes }) {
  const out = [];
  if (!problems.length) out.push('문제 없음');
  else {
    out.push(`문제 ${problems.length}개`);
    const by = new Map();
    for (const p of problems) by.set(p.kind, [...(by.get(p.kind) || []), p]);
    for (const [k, list] of by) {
      out.push('', `## ${k}`, '');
      for (const p of list) out.push(`- ${p.file}: ${p.detail}`);
    }
  }
  for (const n of notes) out.push(`참고: ${n}`);
  return out.join('\n') + '\n';
}

function cli(argv) {
  const [cmd, ...rest] = argv;
  const flags = new Set(['--gemini', '--plan', '--skip-existing', '--check']);
  const opts = { vars: {} };
  const pos = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (flags.has(a)) opts[a.slice(2)] = true;
    else if (a === '--var') {
      const [k, ...v] = (rest[++i] ?? '').split('=');
      if (!k || !v.length) throw new Error('--var는 k=v로 준다');
      opts.vars[k] = v.join('=');
    } else if (a === '--name' || a === '--title') opts[a.slice(2)] = rest[++i] ?? '';
    else if (a.startsWith('--')) throw new Error(`모르는 옵션: ${a}`);
    else pos.push(a);
  }
  const { root } = projectRoot();
  const w = (s) => process.stdout.write(s);
  if (cmd === 'stacks') return w(stacks().map((s) => `- ${s.name}: ${s.title}`).join('\n') + '\n');
  if (cmd === 'scaffold') {
    const r = scaffold(root, pos, { name: opts.name, gemini: opts.gemini, vars: opts.vars, planOnly: opts.plan, skipExisting: opts['skip-existing'] });
    const out = [`프로젝트: ${slash(root)}`, `스택: ${r.stacks.map((s) => `${s.stack} → ${s.root}`).join(', ')}`, ''];
    if (opts.plan) out.push(...r.files.map((f) => `- ${f.exists ? '있음(건너뜀)' : '만듦'}: ${f.path}`));
    else out.push(...r.written.map((f) => `- 만듦: ${f}`), ...r.skipped.map((f) => `- 있음(건너뜀): ${f}`));
    return w(out.join('\n') + '\n');
  }
  if (cmd === 'new-spec') return w(`명세: ${newSpec(root, pos[0], { title: opts.title })}\n`);
  if (cmd === 'trace') {
    const r = writeTrace(root, { check: opts.check });
    if (opts.check && !r.same) process.exitCode = 1;
    return w(`${r.file}: ${r.same ? '차이 없음' : opts.check ? '다시 생성하면 달라진다' : '다시 만듦'}\n`);
  }
  if (cmd === 'check') {
    const r = check(root);
    if (r.problems.length) process.exitCode = 1;
    return w(report(r));
  }
  throw new Error('명령: stacks | scaffold <스택[:역할]>... [--name N] [--gemini] [--var k=v] [--plan] [--skip-existing] | new-spec <이름> --title <제목> | trace [--check] | check');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`프로젝트 오류: ${e.message}\n`);
    process.exit(1);
  }
}
