#!/usr/bin/env node
// `마이 플러그인 문제 <내용>`: 개선 요청 한 건을 데이터 폴더의 improvements/IMP-<UUID>.md로 남긴다. 플러그인은 고치지 않는다.
// 사용: node issue.mjs [--skill <스킬>] [--summary <상황 요약>] -- <내용>
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitRoot, normalizePath } from './config.mjs';

// 데이터 폴더: CLAUDE_PLUGIN_DATA → PLUGIN_DATA → ~/.my/data. 현황과 같은 함수를 쓴다.
export function dataDir(env = process.env, home = os.homedir()) {
  if (env.CLAUDE_PLUGIN_DATA) return { dir: env.CLAUDE_PLUGIN_DATA, how: 'CLAUDE_PLUGIN_DATA' };
  if (env.PLUGIN_DATA) return { dir: env.PLUGIN_DATA, how: 'PLUGIN_DATA' };
  return { dir: path.join(home, '.my', 'data'), how: '대체 경로' };
}

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export function titleOf(content, max = 60) {
  const t = oneLine(content);
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

// 같은 ID가 이미 있으면(극히 드묾) 새 UUID로 다시 만든다. 'wx'는 있으면 실패하는 배타적 생성이다.
export function writeIssue({ dir, content, skill, summary, project, now = new Date(), uuid = crypto.randomUUID, tries = 5 }) {
  if (!oneLine(content)) throw new Error('내용이 비었다');
  const d = path.join(dir, 'improvements');
  fs.mkdirSync(d, { recursive: true });
  for (let i = 0; i < tries; i++) {
    const id = `IMP-${uuid()}`;
    const file = path.join(d, `${id}.md`);
    let fd;
    try {
      fd = fs.openSync(file, 'wx');
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      throw e;
    }
    const fm = {
      id,
      title: titleOf(content),
      created: now.toISOString(),
      status: 'open',
      skill: oneLine(skill) || '미확인',
      project: project || '없음',
    };
    const text = [
      '---',
      ...Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
      '---',
      '',
      '## 내용',
      '',
      String(content).trim(),
      '',
      '## 상황',
      '',
      String(summary ?? '').trim() || '(요약 없음)',
      '',
    ].join('\n');
    try {
      fs.writeSync(fd, text);
    } finally {
      fs.closeSync(fd);
    }
    return { id, file };
  }
  throw new Error(`ID 충돌이 ${tries}번 이어졌다`);
}

export function parseArgs(argv) {
  const out = { skill: '', summary: '', content: '' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      rest.push(...argv.slice(i + 1));
      break;
    }
    if (a === '--skill' || a === '--summary') out[a.slice(2)] = argv[++i] ?? '';
    else rest.push(a);
  }
  out.content = rest.join(' ');
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = parseArgs(process.argv.slice(2));
    const root = gitRoot(process.cwd());
    const dd = dataDir();
    const r = writeIssue({ dir: dd.dir, ...a, project: root ? normalizePath(root) : null });
    console.log(`기록함: ${r.id}\n파일: ${normalizePath(r.file)} (데이터 폴더: ${dd.how})`);
  } catch (e) {
    console.error(`기록 실패: ${e.message}`);
    process.exit(1);
  }
}
