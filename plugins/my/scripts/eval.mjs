#!/usr/bin/env node
// `마이 플러그인 평가`(G-7)의 비용 없는 부분: 정적 점검, 사례 목록, 예상 비용, 평가 기록.
// 평가 실행 자체(`claude plugin eval`)는 스킬이 승인을 받은 뒤 한다.
// 사용: node eval.mjs lint [--root 플러그인]
//       node eval.mjs cases [--root 플러그인] [--tag T]
//       node eval.mjs cost --cases N --models haiku,sonnet[,opus] [--runs 3] [--arms 2] [--unit opus=0.2]
//       node eval.mjs history add --model M --score <요약> [--note <메모>]
//       node eval.mjs history last
// 종료 코드: 0 완료, 2 오류
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir } from './issue.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '..');
const slash = (p) => p.replace(/\\/g, '/');

// 사례 한 갈래·1회당 비용(USD). 2026-11-18 시험 실행에서 잰 값. 없는 모델은 첫 실행에서 잰다.
export const UNIT = { haiku: 0.0025, sonnet: 0.024 };

// 0단계 정적 점검: 기계로 찾을 수 있는 항목만. 찾은 것은 지우지 않고 평가 후보로 표시한다.
const RULES = [
  { item: '강조 표현', re: /\b(MUST|NEVER|ALWAYS|IMPORTANT|CRITICAL)\b|절대(?!\s*(경로|값))|반드시|무조건|!!/ },
  { item: '기본값 강요', re: /애매하면|모호하면|확실하지 않으면|불확실하면/ },
  { item: '완료 조건 없는 지시', re: /끝까지/ },
];
const DESC_LONG = 400;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const descOf = (text) => /^---\r?\n[\s\S]*?^description:\s*(.*)$[\s\S]*?^---/m.exec(text)?.[1].trim() ?? null;

export function lint(root = PLUGIN) {
  const files = [...walk(path.join(root, 'skills')), ...walk(path.join(root, 'hooks'))];
  const found = [];
  for (const f of files) {
    const raw = fs.readFileSync(f, 'utf8');
    const rel = slash(path.relative(root, f));
    // 코드 블록과 인라인 코드는 지시문이 아니므로 뺀다. 줄 번호를 지키려고 코드 블록은 빈 줄로 바꾼다.
    const text = raw.replace(/^(```|~~~)[\s\S]*?^\1/gm, (m) => m.replace(/[^\n]/g, ''));
    text.split(/\r?\n/).forEach((line, i) => {
      const plain = line.replace(/`[^`]*`/g, '');
      for (const r of RULES) if (r.re.test(plain)) found.push({ at: `${rel}:${i + 1}`, item: r.item, text: line.trim() });
    });
    const d = descOf(raw);
    if (d && d.length > DESC_LONG) found.push({ at: `${rel}:description`, item: '긴 description', text: `${d.length}자` });
  }
  return { files: files.length, found };
}

// 사례: <evals>/**/prompt.md 또는 case.yaml이 있는 폴더(results 제외)
export function cases(root = PLUGIN, { tag } = {}) {
  const base = path.join(root, 'evals');
  const out = [];
  const visit = (dir) => {
    if (!fs.existsSync(dir)) return;
    const names = fs.readdirSync(dir);
    if (names.includes('prompt.md') || names.includes('case.yaml')) {
      const meta = ['case.yaml', 'prompt.md'].map((n) => path.join(dir, n)).filter(fs.existsSync).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
      const tags = (/^tags:\s*\[([^\]]*)\]/m.exec(meta)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      out.push({ name: slash(path.relative(base, dir)), tags });
      return;
    }
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory() && e.name !== 'results') visit(path.join(dir, e.name));
  };
  visit(base);
  return out.filter((c) => !tag || c.tags.includes(tag)).sort((a, b) => a.name.localeCompare(b.name));
}

// 예상 비용 = 사례 수 × 갈래 수 × 실행 횟수 × 모델별 단가. 단가를 모르는 모델은 "미측정"으로 돌려준다.
export function cost({ cases: n, models, runs = 3, arms = 2, unit = {} }) {
  const prices = { ...UNIT, ...unit };
  const rows = models.map((m) => {
    const u = prices[m];
    return { model: m, unit: u ?? null, usd: u == null ? null : +(n * arms * runs * u).toFixed(4) };
  });
  const known = rows.filter((r) => r.usd != null);
  return { rows, total: +known.reduce((s, r) => s + r.usd, 0).toFixed(4), unknown: rows.filter((r) => r.usd == null).map((r) => r.model) };
}

// 평가 기록: 데이터 폴더의 eval-history.md에 한 줄씩 더한다.
export const historyFile = (env = process.env) => path.join(dataDir(env).dir, 'eval-history.md');

export function addHistory(file, { model, score, note = '', now = new Date() }) {
  if (!model || !score) throw new Error('model과 score가 필요하다');
  const date = now.toISOString().slice(0, 10);
  const one = (s) => String(s).replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, '# 평가 기록\n\n| 날짜 | 모델 | 점수 | 메모 |\n|---|---|---|---|\n');
  fs.appendFileSync(file, `| ${date} | ${one(model)} | ${one(score)} | ${one(note)} |\n`);
  return { date, model };
}

export function lastHistory(file) {
  if (!fs.existsSync(file)) return null;
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l));
  if (!rows.length) return null;
  const [date, model, score] = rows.at(-1).split('|').slice(1).map((s) => s.trim());
  return { date, model, score };
}

function opt(rest, name, def) {
  const i = rest.indexOf(name);
  return i >= 0 ? rest.splice(i, 2)[1] : def;
}

function cli(argv) {
  const [cmd, ...rest] = argv;
  const root = path.resolve(opt(rest, '--root', PLUGIN));
  if (cmd === 'lint') {
    const r = lint(root);
    const lines = [`# 정적 점검 (${r.files}개 파일)`, ''];
    if (!r.found.length) lines.push('- 기계로 찾은 항목 없음');
    else lines.push('| 위치 | 항목 | 내용 |', '|---|---|---|', ...r.found.map((f) => `| ${f.at} | ${f.item} | ${f.text.replace(/\|/g, '/')} |`));
    lines.push('', '직접 확인할 항목: 이유 없는 금지, 모델이 이미 아는 일반 지식 설명, 지시문끼리 충돌, 도구로 판정할 수 있는 규칙(형식·문법)');
    return console.log(lines.join('\n'));
  }
  if (cmd === 'cases') {
    const list = cases(root, { tag: opt(rest, '--tag') });
    console.log(`사례 ${list.length}개`);
    for (const c of list) console.log(`- ${c.name}${c.tags.length ? ` [${c.tags.join(', ')}]` : ''}`);
    return;
  }
  if (cmd === 'cost') {
    const n = Number(opt(rest, '--cases'));
    const models = (opt(rest, '--models') ?? '').split(',').filter(Boolean);
    if (!n || !models.length) throw new Error('사용: cost --cases N --models haiku,sonnet [--runs 3] [--arms 2] [--unit opus=0.2]');
    const unit = Object.fromEntries((opt(rest, '--unit') ?? '').split(',').filter(Boolean).map((kv) => kv.split('=')).map(([k, v]) => [k, Number(v)]));
    const r = cost({ cases: n, models, runs: Number(opt(rest, '--runs', 3)), arms: Number(opt(rest, '--arms', 2)), unit });
    for (const row of r.rows) console.log(`- ${row.model}: ${row.usd == null ? '미측정 — 단가를 첫 실행에서 잰다' : `약 $${row.usd}`}`);
    console.log(`합계(아는 것만): 약 $${r.total}`);
    return;
  }
  if (cmd === 'history') {
    const sub = rest.shift();
    const file = historyFile();
    if (sub === 'add') {
      const r = addHistory(file, { model: opt(rest, '--model'), score: opt(rest, '--score'), note: opt(rest, '--note', '') });
      return console.log(`기록함: ${r.date} ${r.model}\n파일: ${slash(file)}`);
    }
    if (sub === 'last') {
      const r = lastHistory(file);
      return console.log(r ? `마지막 평가: ${r.date}, ${r.model}, ${r.score}` : '마지막 평가: 기록 없음');
    }
    throw new Error('사용: history add --model M --score S [--note N] | history last');
  }
  throw new Error('명령: lint | cases | cost | history');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`평가 오류: ${e.message}\n`);
    process.exit(2);
  }
}
