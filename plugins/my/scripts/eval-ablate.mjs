#!/usr/bin/env node
// 지시문 하나의 효과를 보려고, 그 지시를 뺀 플러그인 복사본을 데이터 폴더 아래에 만든다. 원본은 건드리지 않는다.
// 사용: node eval-ablate.mjs --line "<지시 문장 일부>" [--in skills|stance|all]   → 그 문장이 든 줄을 뺀 복사본
//       node eval-ablate.mjs --no-stance                                         → 세션 시작 태도 훅을 뺀 복사본
//       [--root 플러그인] [--out 폴더]
// 태도 규칙 네 조합: 원본(둘 다), --in skills(훅만 남김), --in stance(스킬만 남김), --in all(둘 다 없음).
// 출력: 복사본 경로, 뺀 줄(파일:줄), 같은 사례로 원본·복사본을 돌리는 평가 명령. 평가는 실행하지 않는다.
// 종료 코드: 0 완료, 2 오류(맞는 줄 없음 포함)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir } from './issue.mjs';
import { stamp } from './work.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '..');
const slash = (p) => p.replace(/\\/g, '/');
const STANCE = 'hooks/critical-stance.md';
const SKIP = new Set(['.git', 'node_modules']);

function mdFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) mdFiles(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// 복사: .git, node_modules, evals/results는 뺀다(결과 폴더는 크고 평가와 무관하다).
export function copyPlugin(root, dest) {
  if (fs.existsSync(dest)) throw new Error(`복사본 폴더가 이미 있다: ${slash(dest)}`);
  const results = path.join(root, 'evals', 'results');
  fs.cpSync(root, dest, {
    recursive: true,
    filter: (src) => !SKIP.has(path.basename(src)) && path.resolve(src) !== path.resolve(results),
  });
  return dest;
}

// 대상 파일에서 text가 든 줄을 뺀다. 빈 줄로 남기지 않고 줄 자체를 지운다.
export function dropLine(root, text, where = 'all') {
  if (!text?.trim()) throw new Error('뺄 문장이 비었다');
  if (!['skills', 'stance', 'all'].includes(where)) throw new Error(`--in은 skills, stance, all 중 하나: ${where}`);
  const files = [];
  if (where !== 'stance') files.push(...mdFiles(path.join(root, 'skills')));
  if (where !== 'skills') files.push(path.join(root, STANCE));
  const removed = [];
  for (const f of files.filter(fs.existsSync)) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    const keep = [];
    lines.forEach((l, i) => {
      if (l.includes(text.trim())) removed.push({ at: `${slash(path.relative(root, f))}:${i + 1}`, text: l.trim() });
      else keep.push(l);
    });
    if (keep.length !== lines.length) fs.writeFileSync(f, keep.join('\n'));
  }
  if (!removed.length) throw new Error(`맞는 줄이 없다: "${text.trim()}" (--in ${where})`);
  return removed;
}

// 세션 시작 훅에서 태도 규칙 주입만 뺀다. 키워드 훅은 남긴다.
export function dropStance(root) {
  const file = path.join(root, 'hooks', 'hooks.json');
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const before = JSON.stringify(cfg.hooks?.SessionStart ?? []);
  const groups = (cfg.hooks?.SessionStart ?? [])
    .map((g) => ({ ...g, hooks: g.hooks.filter((h) => !/keyword\.mjs"?\s+stance/.test(h.command ?? '')) }))
    .filter((g) => g.hooks.length);
  if (JSON.stringify(groups) === before) throw new Error('태도 훅을 찾지 못했다 (hooks/hooks.json SessionStart)');
  if (groups.length) cfg.hooks.SessionStart = groups;
  else delete cfg.hooks.SessionStart;
  fs.writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
  return [{ at: 'hooks/hooks.json:SessionStart', text: 'keyword.mjs stance' }];
}

export function ablate({ root = PLUGIN, line, where = 'all', noStance = false, out, now = new Date(), env = process.env } = {}) {
  if (!line && !noStance) throw new Error('--line 또는 --no-stance가 필요하다');
  const base = out ?? path.join(dataDir(env).dir, 'eval-ablate', stamp(now));
  const dest = path.join(base, path.basename(path.resolve(root)));
  copyPlugin(path.resolve(root), dest);
  try {
    const removed = [...(line ? dropLine(dest, line, where) : []), ...(noStance ? dropStance(dest) : [])];
    return { copy: slash(dest), removed };
  } catch (e) {
    fs.rmSync(base, { recursive: true, force: true });
    throw e;
  }
}

function opt(rest, name, def) {
  const i = rest.indexOf(name);
  return i >= 0 ? rest.splice(i, 2)[1] : def;
}

function cli(argv) {
  const rest = [...argv];
  const noStance = rest.includes('--no-stance');
  const root = path.resolve(opt(rest, '--root', PLUGIN));
  const r = ablate({ root, line: opt(rest, '--line'), where: opt(rest, '--in', 'all'), noStance, out: opt(rest, '--out') });
  const run = (p) => `claude plugin eval "${p}" --ablation none --no-publish --threshold 0 --runs 3 --model <모델> --max-cost-usd <예상 비용>`;
  console.log(
    [
      `복사본: ${r.copy}`,
      '',
      '뺀 줄:',
      ...r.removed.map((x) => `- ${x.at}: ${x.text}`),
      '',
      '같은 사례·모델·횟수로 두 번 돌려 비교한다:',
      `- 원본: ${run(slash(root))}`,
      `- 복사본: ${run(r.copy)}`,
    ].join('\n'),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`복사본 오류: ${e.message}\n`);
    process.exit(2);
  }
}
