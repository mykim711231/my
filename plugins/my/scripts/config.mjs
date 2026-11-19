#!/usr/bin/env node
// my 설정 읽기. 순서: env → projects[git 루트] → 전역 → auto → 기본값.
// 사용: node config.mjs [키]   → JSON 출력 { values: {키: {value, source}}, root, file, warnings }
//       node config.mjs table  → 설정 현황표(마크다운)
//       node config.mjs set <키> <값> [--project] | remove-project <경로> | move-project <경로> <새 경로>
//         → 기본은 diff 미리보기만. 저장은 --write --expect <미리보기 해시>.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const DEFAULTS = {
  plugin_src: null,
  learn_target: 'project',
  project_learn_dir: 'docs/learn',
  learn_root: null,
  work_end_question: true,
  usage_log: true,
  mermaid_check: 'hook',
};
const PATH_KEYS = new Set(['plugin_src', 'learn_root']);
const PROJECT_KEYS = new Set(['learn_target', 'project_learn_dir', 'mermaid_check']);
const ENV_KEYS = { learn_root: 'MY_LEARN_ROOT', plugin_src: 'MY_PLUGIN_SRC' };

const isAbs = (v) => typeof v === 'string' && v.trim() !== '' && path.isAbsolute(v);
const VALID = {
  plugin_src: isAbs,
  learn_root: isAbs,
  learn_target: (v) => v === 'project' || v === 'central',
  project_learn_dir: (v) =>
    typeof v === 'string' && v.trim() !== '' && !path.isAbsolute(v) && !v.split(/[\\/]/).includes('..'),
  work_end_question: (v) => typeof v === 'boolean',
  usage_log: (v) => typeof v === 'boolean',
  mermaid_check: (v) => ['hook', 'finish', 'off'].includes(v),
};

// 구분자 `/`, 끝 `/` 없음.
export function normalizePath(p) {
  let s = path.resolve(p).replace(/\\/g, '/');
  if (s.length > 1 && s.endsWith('/') && !/^[A-Za-z]:\/$/.test(s)) s = s.slice(0, -1);
  return s;
}

// 비교용 키. Windows에서는 대소문자를 무시한다.
export function pathKey(p, platform = process.platform) {
  const s = normalizePath(p);
  return platform === 'win32' ? s.toLowerCase() : s;
}

export function gitRoot(cwd) {
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    return out ? normalizePath(out) : null;
  } catch {
    return null;
  }
}

function readJson(file, warnings) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    warnings.push(`${file}: JSON을 읽지 못해 무시함 (${e.message})`);
    return null;
  }
}

function accept(key, value, where, warnings) {
  if (!(key in DEFAULTS)) {
    warnings.push(`${where}: 모르는 키 "${key}" 무시`);
    return undefined;
  }
  if (!VALID[key](value)) {
    warnings.push(`${where}: "${key}" 값 ${JSON.stringify(value)}이 허용되지 않아 무시`);
    return undefined;
  }
  return PATH_KEYS.has(key) ? normalizePath(value) : value;
}

// my 마켓플레이스가 로컬 폴더로 등록돼 있으면 그 경로가 원본이다.
export function autoPluginSrc(home) {
  const data = readJson(path.join(home, '.claude', 'plugins', 'known_marketplaces.json'), []);
  const entry = data && data.my;
  if (!entry || !entry.source || entry.source.source !== 'directory') return null;
  const p = entry.source.path || entry.installLocation;
  return isAbs(p) ? normalizePath(p) : null;
}

export function resolveConfig({
  cwd = process.cwd(),
  env = process.env,
  home = os.homedir(),
  root,
  platform = process.platform,
} = {}) {
  const warnings = [];
  const file = path.join(home, '.my', 'config.json').replace(/\\/g, '/');
  const projectRoot = root === undefined ? gitRoot(cwd) : root;
  const raw = readJson(file, warnings) ?? {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push(`${file}: 객체가 아니라 무시`);
  }

  const global = {};
  let projectEntry = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (k === 'projects') continue;
      const ok = accept(k, v, 'config', warnings);
      if (ok !== undefined) global[k] = ok;
    }
    const projects = raw.projects;
    if (projects !== undefined && (typeof projects !== 'object' || Array.isArray(projects))) {
      warnings.push('config: "projects"가 객체가 아니라 무시');
    } else if (projects && projectRoot) {
      const want = pathKey(projectRoot, platform);
      for (const [p, vals] of Object.entries(projects)) {
        if (!isAbs(p) || pathKey(p, platform) !== want) continue;
        for (const [k, v] of Object.entries(vals || {})) {
          if (!PROJECT_KEYS.has(k)) {
            warnings.push(`projects["${p}"]: "${k}"는 프로젝트별로 둘 수 없어 무시`);
            continue;
          }
          const ok = accept(k, v, `projects["${p}"]`, warnings);
          if (ok !== undefined) projectEntry[k] = ok;
        }
      }
    }
  }

  const auto = { plugin_src: autoPluginSrc(home) };
  const values = {};
  for (const key of Object.keys(DEFAULTS)) {
    const envName = ENV_KEYS[key];
    if (envName && env[envName]) {
      const ok = accept(key, env[envName], `env ${envName}`, warnings);
      if (ok !== undefined) {
        values[key] = { value: ok, source: 'env' };
        continue;
      }
    }
    if (key in projectEntry) values[key] = { value: projectEntry[key], source: 'project' };
    else if (key in global) values[key] = { value: global[key], source: 'global' };
    else if (auto[key] != null) values[key] = { value: auto[key], source: 'auto' };
    else values[key] = { value: DEFAULTS[key], source: 'default' };
  }
  return { values, root: projectRoot, file, warnings };
}

// ---- 설정 화면(G-8): 현황표, 변경 계획, 저장 ----

// 중앙 학습 폴더 제안값(F-3): D: 드라이브가 있으면 D:/_MyStudyNotes, 없으면 ~/MyStudyNotes.
export function suggestLearnRoot({ home = os.homedir(), platform = process.platform, exists = fs.existsSync } = {}) {
  if (platform === 'win32' && exists('D:\\')) return 'D:/_MyStudyNotes';
  return normalizePath(path.join(home, 'MyStudyNotes'));
}

export function pathState(p) {
  if (!p) return '—';
  if (!fs.existsSync(p)) return '없음(처음 쓸 때 만든다)';
  const parts = ['있음'];
  try {
    fs.accessSync(p, fs.constants.W_OK);
    parts.push('쓰기 가능');
  } catch {
    parts.push('쓰기 불가');
  }
  parts.push(gitRoot(p) ? 'git 저장소' : 'git 아님');
  return parts.join(', ');
}

const SHOW = {
  learn_target: (v) => (v === 'project' ? '`project` (프로젝트 학습 폴더에 쓴다)' : '`central` (중앙 학습 폴더에 쓴다)'),
  work_end_question: (v) => (v ? '켬' : '끔'),
  usage_log: (v) => (v ? '켬' : '끔'),
  mermaid_check: (v) => `\`${v}\` (${{ hook: '저장 훅 + 완료 전 검사', finish: '완료 전 검사만', off: '자동 검사 안 함' }[v]})`,
};

// 파일에 그 키 값이 있는지(env가 가리고 있는지 보려고).
function fileValue(raw, key, root, platform) {
  if (!raw || typeof raw !== 'object') return undefined;
  if (root && raw.projects && typeof raw.projects === 'object') {
    for (const [p, vals] of Object.entries(raw.projects)) {
      if (isAbs(p) && pathKey(p, platform) === pathKey(root, platform) && vals && key in vals) return vals[key];
    }
  }
  return raw[key];
}

export function buildTable(opts = {}) {
  const r = resolveConfig(opts);
  const platform = opts.platform ?? process.platform;
  const raw = readJson(path.join(opts.home ?? os.homedir(), '.my', 'config.json'), []);
  const v = r.values;
  const out = ['| 항목 | 현재 값 | 출처 | 상태 |', '|---|---|---|---|'];
  for (const key of Object.keys(DEFAULTS)) {
    const { value, source } = v[key];
    let shown = SHOW[key] ? SHOW[key](value) : value == null ? '없음' : `\`${value}\``;
    let state = '—';
    if (key === 'project_learn_dir') {
      if (r.root) {
        const abs = normalizePath(path.join(r.root, value));
        shown += ` → \`${abs}\``;
        state = pathState(abs);
      } else state = '프로젝트 밖';
    } else if (PATH_KEYS.has(key)) {
      state = value ? pathState(value) : key === 'learn_root' ? `제안값 \`${suggestLearnRoot(opts)}\`` : '—';
    }
    if (source === 'env' && fileValue(raw, key, r.root, platform) !== undefined) {
      state += `; env가 우선 적용 중 (파일 값 ${JSON.stringify(fileValue(raw, key, r.root, platform))})`;
    }
    out.push(`| \`${key}\` | ${shown} | \`${source}\` | ${state} |`);
  }
  const lines = ['### 설정 현황', '', `- 설정 파일: \`${r.file}\`${fs.existsSync(r.file) ? '' : ' (없음: 기본값으로 동작, 처음 저장할 때 만든다)'}`];
  lines.push(`- 현재 프로젝트: ${r.root ? `\`${r.root}\`` : '없음(git 루트 밖)'}`, '', ...out);
  const orphans = orphanProjects(raw);
  if (orphans.length) lines.push('', '#### 폴더가 없는 프로젝트 항목', '', ...orphans.map((p) => `- \`${p}\``));
  if (r.warnings.length) lines.push('', '#### 경고', '', ...r.warnings.map((w) => `- ${w}`));
  return lines.join('\n');
}

export function orphanProjects(raw) {
  if (!raw || typeof raw.projects !== 'object' || raw.projects === null || Array.isArray(raw.projects)) return [];
  return Object.keys(raw.projects).filter((p) => !isAbs(p) || !fs.existsSync(p));
}

const show = (v) => (v === undefined ? "(없음)" : JSON.stringify(v));
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);

function parseValue(key, text) {
  if (typeof DEFAULTS[key] === 'boolean') {
    if (['true', '켬', 'on'].includes(text)) return true;
    if (['false', '끔', 'off'].includes(text)) return false;
    return text;
  }
  return text;
}

// 변경 계획을 만든다. 파일은 건드리지 않는다. 결과: { before, after, beforeText, afterText, expect, changes }
export function planChange(op, { home = os.homedir(), cwd = process.cwd(), root, platform = process.platform } = {}) {
  const file = path.join(home, '.my', 'config.json');
  const beforeText = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  let before = {};
  if (beforeText.trim()) {
    try {
      before = JSON.parse(beforeText);
    } catch (e) {
      throw new Error(`설정 파일 JSON이 깨져 있어 저장하지 않는다. 먼저 파일을 고쳐라 (${e.message})`);
    }
    if (!before || typeof before !== 'object' || Array.isArray(before)) throw new Error('설정 파일이 객체가 아니라 저장하지 않는다');
  }
  const after = structuredClone(before);
  const changes = [];
  const projects = () => {
    if (after.projects === undefined) after.projects = {};
    if (typeof after.projects !== 'object' || after.projects === null || Array.isArray(after.projects)) {
      throw new Error('"projects"가 객체가 아니라 저장하지 않는다');
    }
    return after.projects;
  };
  // 이미 있는 projects 키를 대소문자·구분자 무시로 찾는다(Windows).
  const findKey = (p) => Object.keys(after.projects || {}).find((k) => isAbs(k) && pathKey(k, platform) === pathKey(p, platform));

  if (op.type === 'set') {
    const { key } = op;
    if (!(key in DEFAULTS)) throw new Error(`모르는 키: ${key}`);
    let value = parseValue(key, op.value);
    if (!VALID[key](value)) throw new Error(`"${key}"에 ${JSON.stringify(op.value)}는 허용되지 않는다`);
    if (PATH_KEYS.has(key)) value = normalizePath(value);
    if (op.project) {
      if (!PROJECT_KEYS.has(key)) throw new Error(`"${key}"는 프로젝트별로 둘 수 없다(모든 프로젝트 기본값으로만 저장)`);
      const r = root === undefined ? gitRoot(cwd) : root;
      if (!r) throw new Error('git 루트 밖이라 "이 프로젝트에만"으로 저장할 수 없다');
      const ps = projects();
      const k = findKey(r) ?? normalizePath(r);
      ps[k] = { ...(ps[k] || {}), [key]: value };
      changes.push(`projects["${k}"].${key}: ${show(before.projects?.[k]?.[key])} → ${JSON.stringify(value)}`);
    } else {
      after[key] = value;
      changes.push(`${key}: ${show(before[key])} → ${JSON.stringify(value)}`);
    }
  } else if (op.type === 'remove-project') {
    const k = findKey(op.path);
    if (!k) throw new Error(`projects에 없는 경로: ${op.path}`);
    delete projects()[k];
    changes.push(`projects["${k}"] 삭제`);
  } else if (op.type === 'move-project') {
    const k = findKey(op.path);
    if (!k) throw new Error(`projects에 없는 경로: ${op.path}`);
    if (!isAbs(op.to)) throw new Error(`새 경로는 절대 경로여야 한다: ${op.to}`);
    const to = normalizePath(op.to);
    const ps = projects();
    const existing = findKey(to);
    if (existing && existing !== k) throw new Error(`새 경로에 이미 항목이 있다: ${existing}`);
    const vals = ps[k];
    delete ps[k];
    ps[to] = vals;
    changes.push(`projects["${k}"] → projects["${to}"]`);
  } else {
    throw new Error(`모르는 작업: ${op.type}`);
  }
  const afterText = JSON.stringify(after, null, 2) + '\n';
  return { file: file.replace(/\\/g, '/'), before, after, beforeText, afterText, expect: hash(beforeText), changes, unchanged: afterText === beforeText };
}

// 승인한 계획을 저장한다. 승인 뒤 파일이 바뀌었으면(해시 불일치) 쓰지 않는다. 임시 파일에 쓰고 이름을 바꾼다.
export function applyChange(op, expect, opts = {}) {
  const plan = planChange(op, opts);
  if (plan.expect !== expect) throw new Error('승인 뒤 설정 파일이 바뀌었다. 새 diff를 다시 확인하라');
  if (plan.unchanged) return plan;
  fs.mkdirSync(path.dirname(plan.file), { recursive: true });
  const tmp = `${plan.file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, plan.afterText);
  fs.renameSync(tmp, plan.file);
  return plan;
}

function lineDiff(a, b) {
  const A = a ? a.replace(/\n$/, '').split('\n') : [];
  const B = b.replace(/\n$/, '').split('\n');
  // 작은 파일이라 LCS로 충분하다.
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) out.push('  ' + A[i++]), j++;
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) out.push('+ ' + B[j++]);
    else out.push('- ' + A[i++]);
  }
  return out.join('\n');
}

function parseCli(argv) {
  const flags = { project: false, write: false, expect: null };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') flags.project = true;
    else if (argv[i] === '--write') flags.write = true;
    else if (argv[i] === '--expect') flags.expect = argv[++i];
    else pos.push(argv[i]);
  }
  return { pos, flags };
}

function cli(argv) {
  const { pos, flags } = parseCli(argv);
  const [cmd, a, b] = pos;
  if (!cmd || cmd in DEFAULTS) {
    const r = resolveConfig();
    console.log(JSON.stringify(cmd ? { [cmd]: r.values[cmd], warnings: r.warnings } : r, null, 2));
    return 0;
  }
  if (cmd === 'table') {
    console.log(buildTable());
    return 0;
  }
  const op =
    cmd === 'set' ? { type: 'set', key: a, value: b, project: flags.project }
    : cmd === 'remove-project' ? { type: 'remove-project', path: a }
    : cmd === 'move-project' ? { type: 'move-project', path: a, to: b }
    : null;
  if (!op || (cmd === 'set' && b === undefined) || !a || (cmd === 'move-project' && !b)) {
    console.error('사용: config.mjs [키] | table | set <키> <값> [--project] | remove-project <경로> | move-project <경로> <새 경로>  [--write --expect <해시>]');
    return 2;
  }
  if (!flags.write) {
    const p = planChange(op);
    console.log(`파일: ${p.file}\n변경: ${p.changes.join('; ')}\n${p.unchanged ? '(바뀌는 내용 없음)' : '```diff\n' + lineDiff(p.beforeText, p.afterText) + '\n```'}\n저장하려면 같은 명령에 --write --expect ${p.expect}`);
    return 0;
  }
  if (!flags.expect) {
    console.error('--write에는 미리보기에서 받은 --expect <해시>가 필요하다');
    return 2;
  }
  const p = applyChange(op, flags.expect);
  console.log(`저장함: ${p.file}\n변경: ${p.changes.join('; ')}\n\n${buildTable()}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exit(cli(process.argv.slice(2)));
  } catch (e) {
    console.error(`설정 오류: ${e.message}`);
    process.exit(1);
  }
}
