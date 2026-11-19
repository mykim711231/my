#!/usr/bin/env node
// 설정 동기화(E): 프로젝트의 규칙 파일 참조와 스킬을 한 도구에서 다른 도구로 맞춘다.
// 사용: node sync.mjs plan <원본> <대상> [--root R]  → 변경 기록을 만들고 계획·보류를 출력(파일은 쓰지 않는다)
//       node sync.mjs apply <기록 폴더>              → 원본이 계획 당시와 같은지 확인한 뒤 적용
// 도구: claude, codex, gemini. 공통 규칙은 AGENTS.md가 소유하고, 어댑터에는 참조만 만든다.
// 종료 코드: 0 완료, 1 충돌로 중단, 2 오류
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Conflict, apply as applyChange, prepare, summary } from './change-apply.mjs';
import { LINK, external, stripCode } from './md.mjs';
import { projectRoot } from './work.mjs';

export const TOOLS = {
  claude: { rules: 'CLAUDE.md', ref: '@AGENTS.md', skills: '.claude/skills', title: 'Claude Code 규칙', who: 'Claude Code' },
  codex: { rules: 'AGENTS.md', ref: null, skills: '.agents/skills', title: null, who: 'Codex' },
  gemini: { rules: 'GEMINI.md', ref: '@./AGENTS.md', skills: '.gemini/skills', title: 'Gemini 규칙', who: 'Gemini CLI·Antigravity CLI' },
};

const slash = (p) => p.replace(/\\/g, '/');
const hash = (buf) => (buf == null ? null : crypto.createHash('sha256').update(buf).digest('hex'));
const readBuf = (f) => (fs.existsSync(f) && fs.statSync(f).isFile() ? fs.readFileSync(f) : null);
const readText = (f) => readBuf(f)?.toString('utf8') ?? null;

function tool(name) {
  const t = TOOLS[name];
  if (!t) throw new Error(`모르는 도구: ${name} — ${Object.keys(TOOLS).join(', ')} 중 하나`);
  return t;
}

// @가져오기: 줄 머리의 `@경로`(코드 블록 밖)
export const importsOf = (text) => [...stripCode(text).matchAll(/^@(\S+)\s*$/gm)].map((m) => m[1]);
const refersAgents = (text) => importsOf(text).some((p) => p.replace(/^\.\//, '') === 'AGENTS.md');

// 가져오기 그래프에서 자기 참조·순환을 찾는다. files: { 상대경로: 내용 }
export function importCycles(root, files) {
  const textOf = (rel) => (rel in files ? files[rel] : readText(path.join(root, rel)));
  const cycles = [];
  const visit = (rel, stack) => {
    const text = textOf(rel);
    if (text == null) return;
    for (const imp of importsOf(text)) {
      const next = slash(path.relative(root, path.resolve(root, path.dirname(rel), imp)));
      const at = stack.indexOf(next);
      if (at >= 0) {
        cycles.push([...stack.slice(at), next].join(' → '));
        continue;
      }
      if (!next.startsWith('..')) visit(next, [...stack, next]);
    }
  };
  for (const rel of Object.keys(files)) visit(rel, [rel]);
  return [...new Set(cycles)];
}

// 규칙 파일: 대상 어댑터의 AGENTS.md 참조만 만들거나 더한다. 도구 전용 본문은 그대로 둔다.
export function planRules(root, from, to) {
  const src = tool(from);
  const dst = tool(to);
  const agents = readText(path.join(root, 'AGENTS.md'));
  const out = { changes: [], notes: [], hold: [] };
  if (agents == null) {
    const body = readText(path.join(root, src.rules));
    out.hold.push(`AGENTS.md가 없다 — 공통 규칙을 먼저 승격한다${body ? ` (후보: ${src.rules})` : ''}`);
    return out;
  }
  if (src.ref) {
    const s = readText(path.join(root, src.rules));
    if (s != null && !refersAgents(s)) out.notes.push(`${src.rules}가 AGENTS.md를 참조하지 않는다 — 공통 규칙이 섞여 있으면 승격을 검토한다`);
  }
  if (!dst.ref) {
    out.notes.push(`${dst.who}는 AGENTS.md를 직접 읽는다 — 규칙 파일은 바꿀 것이 없다`);
    return out;
  }
  const cur = readText(path.join(root, dst.rules));
  let next;
  if (cur == null) next = `${dst.ref}\n\n# ${dst.title}\n\n- 공통 규칙은 \`AGENTS.md\`가 원본이다. 여기에는 ${dst.who}에만 필요한 규칙을 적는다.\n`;
  else if (refersAgents(cur)) {
    out.notes.push(`${dst.rules}는 이미 AGENTS.md를 참조한다`);
    return out;
  } else next = `${dst.ref}\n\n${cur}`;
  const cycles = importCycles(root, { [dst.rules]: next, 'AGENTS.md': agents });
  if (cycles.length) {
    out.hold.push(`가져오기 순환: ${cycles.join('; ')}`);
    return out;
  }
  out.changes.push({ path: dst.rules, content: next });
  return out;
}

function listFiles(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, base, out);
    else if (e.isFile()) out.push(slash(path.relative(base, p)));
  }
  return out.sort();
}

// 스킬 폴더의 md가 상대 경로로 참조하는 대상. 폴더 밖이거나 없으면 문제로 돌려준다.
export function refProblems(skillDir) {
  const out = [];
  for (const rel of listFiles(skillDir).filter((f) => f.endsWith('.md'))) {
    const file = path.join(skillDir, rel);
    const text = stripCode(readText(file));
    const targets = [...text.matchAll(LINK)].map((m) => m[1]);
    for (const m of text.matchAll(/`(\.\.?\/[^`\s]+)`/g)) targets.push(m[1]);
    for (const t of targets) {
      if (t.startsWith('#') || external(t)) continue;
      const p = t.split('#')[0];
      const abs = path.resolve(path.dirname(file), p);
      const inside = slash(path.relative(skillDir, abs));
      if (inside.startsWith('..') || path.isAbsolute(inside)) out.push(`${rel}: 스킬 폴더 밖 참조 ${t}`);
      else if (!fs.existsSync(abs)) out.push(`${rel}: 없는 파일 참조 ${t}`);
    }
  }
  return [...new Set(out)];
}

// 스킬: 이름별로 폴더 전체를 계획한다. 대상에만 있는 파일이나 풀 수 없는 참조가 있으면 그 스킬은 보류한다.
export function planSkills(root, from, to) {
  const srcDir = path.join(root, tool(from).skills);
  const dstDir = path.join(root, tool(to).skills);
  const out = { changes: [], skills: [], hold: [], same: [] };
  if (srcDir === dstDir) return out;
  if (!fs.existsSync(srcDir)) return out;
  for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const name = e.name;
    const s = path.join(srcDir, name);
    const d = path.join(dstDir, name);
    if (!fs.existsSync(path.join(s, 'SKILL.md'))) {
      out.hold.push(`${name}: SKILL.md가 없다`);
      continue;
    }
    const files = listFiles(s);
    const reasons = refProblems(s);
    const extra = listFiles(d).filter((f) => !files.includes(f));
    if (extra.length) reasons.push(`대상에만 있는 파일: ${extra.join(', ')}`);
    if (reasons.length) {
      out.hold.push(`${name}: ${reasons.join('; ')}`);
      continue;
    }
    const changes = files
      .map((f) => ({ path: slash(path.relative(root, path.join(d, f))), content: readBuf(path.join(s, f)) }))
      .filter((c) => hash(readBuf(path.join(root, c.path))) !== hash(c.content));
    if (!changes.length) out.same.push(name);
    else {
      out.skills.push(name);
      out.changes.push(...changes);
    }
  }
  return out;
}

// 원본으로 쓴 파일의 해시. 적용 전에 다시 대조한다.
function sourceHashes(root, from) {
  const t = tool(from);
  const files = ['AGENTS.md', t.rules, ...listFiles(path.join(root, t.skills)).map((f) => slash(path.join(t.skills, f)))];
  return Object.fromEntries([...new Set(files)].map((f) => [f, hash(readBuf(path.join(root, f)))]));
}

export function plan(root, from, to, { dir } = {}) {
  tool(from);
  tool(to);
  if (from === to) throw new Error('원본과 대상이 같다');
  root = path.resolve(root);
  const rules = planRules(root, from, to);
  const skills = planSkills(root, from, to);
  const changes = [...rules.changes, ...skills.changes];
  const record = changes.length ? prepare(root, changes, { dir, meta: { kind: 'sync', from, to, sources: sourceHashes(root, from) } }) : null;
  return { root: slash(root), from, to, record, rules, skills };
}

export function applySync(dir) {
  const s = summary(dir);
  if (s.meta?.kind !== 'sync') throw new Error('동기화 기록이 아니다');
  const changed = Object.entries(s.meta.sources)
    .filter(([f, h]) => hash(readBuf(path.join(s.root, f))) !== h)
    .map(([f]) => `${f} — 원본이 계획 뒤 달라짐`);
  if (changed.length) throw new Conflict('원본이 계획 당시와 달라 쓰기 전에 멈췄다. 다시 계획해 diff를 새로 승인받는다', changed);
  const verify = () => {
    const rules = [...new Set(['AGENTS.md', ...Object.values(TOOLS).map((t) => t.rules)])].filter((f) => fs.existsSync(path.join(s.root, f)));
    return importCycles(s.root, Object.fromEntries(rules.map((f) => [f, readText(path.join(s.root, f))]))).map((c) => `가져오기 순환: ${c}`);
  };
  return applyChange(dir, { verify });
}

function report(p) {
  const lines = [`# 동기화 계획 ${p.from} → ${p.to}`, '', `- 루트: ${p.root}`];
  const sec = (title, items) => items.length && lines.push('', `## ${title}`, '', ...items.map((i) => `- ${i}`));
  sec('규칙 파일 변경', p.rules.changes.map((c) => c.path));
  sec('규칙 파일 알림', p.rules.notes);
  sec('스킬 변경', p.skills.skills);
  sec('바꿀 것 없는 스킬', p.skills.same);
  sec('보류', [...p.rules.hold, ...p.skills.hold]);
  lines.push('', p.record ? `기록: ${p.record}` : '바꿀 파일이 없다');
  if (p.record) lines.push(`diff: node change-apply.mjs show ${p.record}`);
  return lines.join('\n');
}

function cli(argv) {
  const [cmd, ...rest] = argv;
  if (cmd === 'plan') {
    const i = rest.indexOf('--root');
    const root = i >= 0 ? rest.splice(i, 2)[1] : projectRoot().root;
    const [from, to] = rest;
    if (!from || !to) throw new Error('사용: plan <원본> <대상> [--root R]');
    return console.log(report(plan(root, from, to)));
  }
  if (cmd === 'apply') {
    if (!rest[0]) throw new Error('사용: apply <기록 폴더>');
    const r = applySync(rest[0]);
    console.log(`적용 완료: ${r.written.length}개 씀`);
    for (const f of r.written) console.log(`- ${f}`);
    return;
  }
  throw new Error('명령: plan <원본> <대상> [--root R] | apply <기록 폴더>');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    if (e instanceof Conflict) {
      process.stderr.write(`동기화 중단: ${e.message}\n${e.files.map((f) => `- ${f}`).join('\n')}\n`);
      process.exit(1);
    }
    process.stderr.write(`동기화 오류: ${e.message}\n`);
    process.exit(2);
  }
}
