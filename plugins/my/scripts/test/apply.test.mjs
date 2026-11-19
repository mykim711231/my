import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pluginDir, listItems, findItem, checkVersions, nextVersion, bump, markDone, dirtyCount } from '../apply.mjs';
import { writeIssue } from '../issue.mjs';
import { buildStatus } from '../status.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'my-apply-'));

// 마켓플레이스 루트 모양의 가짜 원본.
function fakeSrc(version = '0.3.0', extra = {}) {
  const src = tmp();
  const p = path.join(src, 'plugins', 'my');
  fs.mkdirSync(path.join(p, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(path.join(p, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'my', version }, null, 2) + '\n');
  for (const [f, v] of Object.entries(extra)) {
    fs.mkdirSync(path.dirname(path.join(p, f)), { recursive: true });
    fs.writeFileSync(path.join(p, f), JSON.stringify({ name: 'my', version: v }, null, 2) + '\n');
  }
  fs.writeFileSync(path.join(p, 'CHANGELOG.md'), `# Changelog\n\n## ${version}\n\n- 이전\n`);
  return { src, p };
}

test('원본에서 플러그인 폴더 찾기', () => {
  const { src, p } = fakeSrc();
  assert.equal(pluginDir(src), p);
  assert.equal(pluginDir(p), p);
  assert.throws(() => pluginDir(null), /plugin_src/);
  assert.throws(() => pluginDir(tmp()), /찾지 못했다/);
});

test('대기 목록과 ID 앞부분으로 찾기', () => {
  const dir = tmp();
  const ids = ['aaaa-1', 'aaaa-2', 'bbbb-1'];
  for (const c of ['하나', '둘', '셋']) writeIssue({ dir, content: c, uuid: () => ids.shift() });
  assert.equal(listItems(dir).length, 3);
  assert.equal(findItem(dir, 'IMP-bbbb').title, '셋');
  assert.throws(() => findItem(dir, 'IMP-aaaa'), /여러 기록/);
  assert.throws(() => findItem(dir, 'IMP-zzzz'), /없다/);
});

test('버전 계산', () => {
  assert.equal(nextVersion('0.3.0', 'patch'), '0.3.1');
  assert.equal(nextVersion('0.3.4', 'minor'), '0.4.0');
  assert.equal(nextVersion('0.3.4', 'major'), '1.0.0');
  assert.throws(() => nextVersion('0.3', 'patch'), /SemVer/);
  assert.throws(() => nextVersion('0.3.0', 'big'), /올림 종류/);
});

test('버전 올림: 있는 매니페스트 모두 + CHANGELOG 맨 위', () => {
  const { p } = fakeSrc('0.3.0', { 'gemini-extension.json': '0.3.0' });
  const r = bump(p, 'patch', { ids: ['IMP-x'], lines: ['문구 수정'], date: new Date('2026-11-19T00:00:00Z') });
  assert.deepEqual([r.from, r.to], ['0.3.0', '0.3.1']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(p, 'gemini-extension.json'), 'utf8')).version, '0.3.1');
  const cl = fs.readFileSync(path.join(p, 'CHANGELOG.md'), 'utf8');
  assert.match(cl, /^# Changelog\n\n## 0\.3\.1 — 2026-11-19\n\n- 문구 수정\n- 반영: IMP-x\n\n## 0\.3\.0/);
  assert.deepEqual(checkVersions(p).problems, []);
});

test('매니페스트 버전이 다르면 올리지 않는다', () => {
  const { p } = fakeSrc('0.3.0', { '.codex-plugin/plugin.json': '0.2.0' });
  assert.match(checkVersions(p).problems[0], /버전이 다르다/);
  assert.throws(() => bump(p, 'patch', { lines: ['x'] }), /검사 실패/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(p, '.claude-plugin', 'plugin.json'), 'utf8')).version, '0.3.0');
});

test('완료 표시하면 현황 개선 대기에서 빠진다', () => {
  const dir = tmp();
  const a = writeIssue({ dir, content: '고칠 것' });
  writeIssue({ dir, content: '남을 것' });
  markDone(dir, a.id, '0.3.1');
  const it = findItem(dir, a.id);
  assert.equal(it.status, 'done');
  assert.equal(it.version, '0.3.1');
  assert.throws(() => markDone(dir, a.id, '0.3.1'), /이미 done/);
  const out = buildStatus({ env: { CLAUDE_PLUGIN_DATA: dir }, home: tmp(), cwd: tmp() });
  assert.match(out, /- 1건 .*\n {2}- 남을 것/);
});

test('커밋 안 된 변경 수: git 저장소가 아니면 null', () => {
  const { p } = fakeSrc();
  assert.equal(dirtyCount(p), null);
});
