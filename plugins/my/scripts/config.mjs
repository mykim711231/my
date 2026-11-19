#!/usr/bin/env node
// my 설정 읽기. 순서: env → projects[git 루트] → 전역 → auto → 기본값.
// 사용: node config.mjs [키]   → JSON 출력 { values: {키: {value, source}}, root, file, warnings }
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = resolveConfig();
  const key = process.argv[2];
  if (key && !(key in DEFAULTS)) {
    console.error(`모르는 키: ${key}`);
    process.exit(2);
  }
  console.log(JSON.stringify(key ? { [key]: r.values[key], warnings: r.warnings } : r, null, 2));
}
