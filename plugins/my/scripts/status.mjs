#!/usr/bin/env node
// `마이 플러그인 현황`의 내용을 원본 파일에서 만들어 마크다운으로 출력한다. 파일은 수정하지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig, normalizePath } from './config.mjs';
import { dataDir } from './issue.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};

export function frontmatter(file) {
  if (!fs.existsSync(file)) return null;
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(file, 'utf8'));
  if (!m) return {};
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const v = kv[2].trim();
    try {
      out[kv[1]] = v.startsWith('"') ? JSON.parse(v) : v.replace(/^'|'$/g, '');
    } catch {
      out[kv[1]] = v.replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

function install(home, version) {
  const entry = readJson(path.join(home, '.claude', 'plugins', 'known_marketplaces.json'))?.my;
  if (!entry) return `${version} (Claude Code 마켓플레이스 등록 정보 없음: 다른 도구이거나 미등록)`;
  if (entry.source?.source === 'directory') return `${version} (로컬 등록: 원본 = 실행 중)`;
  const latest = readJson(path.join(entry.installLocation || '', 'plugins', 'my', '.claude-plugin', 'plugin.json'))?.version;
  if (!latest) return `${version} (GitHub 설치, 최신 버전 미확인)`;
  return latest === version
    ? `${version} (GitHub 설치, 최신)`
    : `${version} (GitHub 설치, 업데이트 가능: ${latest}, 마켓플레이스 마지막 갱신 기준)`;
}

function changelog(n = 5) {
  const f = path.join(ROOT, 'CHANGELOG.md');
  if (!fs.existsSync(f)) return ['- (CHANGELOG.md 없음)'];
  const heads = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^## /.test(l));
  return heads.slice(0, n).map((l) => '- ' + l.slice(3));
}

function improvements(dir) {
  const d = path.join(dir, 'improvements');
  if (!fs.existsSync(d)) return { count: 0, titles: [] };
  const files = fs.readdirSync(d).filter((f) => /^IMP-.*\.md$/.test(f));
  const titles = files.map((f) => {
    const fm = frontmatter(path.join(d, f)) || {};
    const status = fm.status || 'open';
    return status === 'open' ? fm.title || f : null;
  }).filter(Boolean);
  return { count: titles.length, titles };
}

export function buildStatus({ env = process.env, home = os.homedir(), cwd = process.cwd() } = {}) {
  const version = readJson(path.join(ROOT, '.claude-plugin', 'plugin.json'))?.version ?? '미확인';
  const table = readJson(path.join(HERE, 'keywords.json'));
  const cfg = resolveConfig({ env, home, cwd });
  const v = cfg.values;
  const out = [];

  out.push('## my 플러그인 현황', '', `- 버전: ${install(home, version)}`, '');

  out.push(
    '### 사용법',
    '',
    `- 아래 키워드를 \`${table.prefix} \`로 시작해 그대로 입력한다. \`{ }\`는 직접 채우는 값이다. 예: \`${table.prefix} 플러그인 문제 키워드가 두 번 들어감\``,
    `- 첫 단어까지만 입력하면(예: \`${table.prefix} 학습\`) 그 묶음의 양식만 보여 주고 아무 작업도 하지 않는다.`,
    `- \`${table.prefix}\` 뒤에 등록되지 않은 말이 오면 일반 대화로 처리한다. 영문 \`my\`는 키워드로 인식하지 않는다.`,
    '- "아직 없는 키워드"는 입력해도 동작하지 않는다.',
    '',
  );
  out.push('### 키워드 → 동작', '', '| 키워드 | 스킬 | 동작 |', '|---|---|---|');
  // 구현된 키워드만 표에 넣고, 미구현은 스킬 묶음(작업·학습·프로젝트 …)별 한 줄로 접는다.
  const missing = new Map();
  for (const c of table.commands) {
    const fm = frontmatter(path.join(ROOT, 'skills', c.skill, 'SKILL.md'));
    if (fm === null) {
      const g = c.skill.split('-')[0];
      missing.set(g, [...(missing.get(g) || []), `\`${table.prefix} ${c.form}\``]);
      continue;
    }
    const desc = (fm.description || '').split(/(?<=\.)\s/)[0];
    out.push(`| \`${table.prefix} ${c.form}\` | \`${c.skill}\` | ${desc.replace(/\|/g, '\\|')} |`);
  }
  out.push('');
  if (missing.size) out.push('### 아직 없는 키워드', '', ...[...missing.values()].map((l) => `- ${l.join(' · ')}`), '');

  out.push('### 최근 변경', '', ...changelog(), '');

  let learn;
  if (v.learn_target.value === 'central') {
    learn = v.learn_root.value ? `중앙 학습 폴더 \`${v.learn_root.value}\`` : '중앙 학습 폴더 (`learn_root` 없음: 설정 필요)';
  } else if (cfg.root) {
    learn = `프로젝트 학습 폴더 \`${normalizePath(path.join(cfg.root, v.project_learn_dir.value))}\``;
  } else {
    learn = v.learn_root.value ? `프로젝트 밖이라 중앙 학습 폴더 \`${v.learn_root.value}\`` : '프로젝트 밖, `learn_root` 없음';
  }
  out.push(
    '### 설정 요약',
    '',
    `- 학습 노트 위치: ${learn} (저장 대상 출처: \`${v.learn_target.source}\`)`,
    `- 원본 경로 \`plugin_src\`: ${v.plugin_src.value ? `\`${v.plugin_src.value}\`` : '없음'} (출처: \`${v.plugin_src.source}\`)`,
    ...cfg.warnings.map((w) => `- 경고: ${w}`),
    '- 전체 항목과 변경: `마이 플러그인 설정`',
    '',
  );

  const dd = dataDir(env, home);
  const imp = improvements(dd.dir);
  out.push('### 개선 대기', '', `- ${imp.count}건 (데이터 폴더: ${dd.how})`, ...imp.titles.map((t) => `  - ${t}`));
  if (imp.count > 0 && dd.how === 'CLAUDE_PLUGIN_DATA') {
    out.push('- 주의: 플러그인을 제거하면 이 기록도 지워진다. 남기려면 `claude plugin uninstall my@my --keep-data`.');
  }
  if (imp.count > 0) out.push('- 기록은 이 PC에만 있고 다른 PC와 공유되지 않는다.');
  out.push('');

  out.push(
    '### 아직 표시하지 않는 항목',
    '',
    '- 도구별 직접 호출·훅 상태: 미확인 (`support-status.mjs` 미구현)',
    '- 마지막 평가 날짜와 모델: 기록 없음',
    '- 권장 플러그인 상태(context7, plugin-dev, skill-creator): 미확인',
  );
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(buildStatus());
}
