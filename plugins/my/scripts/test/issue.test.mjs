import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { writeIssue, parseArgs, titleOf, dataDir } from '../issue.mjs';
import { frontmatter, buildStatus } from '../status.mjs';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'issue.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'my-issue-'));

test('기록 파일: 현황이 읽는 머리말과 본문', () => {
  const dir = tmp();
  const r = writeIssue({ dir, content: '키워드가 "두 번" 들어감: 확인', skill: 'plugin-status', summary: '현황 실행 중', project: 'D:/p' });
  assert.match(path.basename(r.file), /^IMP-[0-9a-f-]{36}\.md$/);
  const fm = frontmatter(r.file);
  assert.equal(fm.id, r.id);
  assert.equal(fm.title, '키워드가 "두 번" 들어감: 확인');
  assert.equal(fm.status, 'open');
  assert.equal(fm.skill, 'plugin-status');
  assert.equal(fm.project, 'D:/p');
  assert.ok(!Number.isNaN(Date.parse(fm.created)));
  assert.match(fs.readFileSync(r.file, 'utf8'), /## 상황\n\n현황 실행 중/);
});

test('같은 ID가 있으면 새 ID로 다시 만들고 기존 파일은 그대로', () => {
  const dir = tmp();
  const ids = ['same', 'same', 'other'];
  const a = writeIssue({ dir, content: '첫째', uuid: () => ids.shift() });
  const b = writeIssue({ dir, content: '둘째', uuid: () => ids.shift() });
  assert.equal(a.id, 'IMP-same');
  assert.equal(b.id, 'IMP-other');
  assert.equal(frontmatter(a.file).title, '첫째');
});

test('충돌이 계속되면 실패, 빈 내용은 실패', () => {
  const dir = tmp();
  writeIssue({ dir, content: 'x', uuid: () => 'fixed' });
  assert.throws(() => writeIssue({ dir, content: 'y', uuid: () => 'fixed', tries: 3 }), /충돌/);
  assert.throws(() => writeIssue({ dir, content: '  ' }), /비었다/);
});

test('동시에 여러 세션이 기록해도 모두 남는다', async () => {
  const dir = tmp();
  const run = promisify(execFile);
  const env = { ...process.env, CLAUDE_PLUGIN_DATA: dir };
  await Promise.all(Array.from({ length: 8 }, (_, i) => run('node', [SCRIPT, '--', `문제 ${i}`], { env })));
  const files = fs.readdirSync(path.join(dir, 'improvements'));
  assert.equal(files.length, 8);
  const titles = files.map((f) => frontmatter(path.join(dir, 'improvements', f)).title).sort();
  assert.deepEqual(titles, Array.from({ length: 8 }, (_, i) => `문제 ${i}`).sort());
});

test('현황의 개선 대기에 열린 건만 나온다', () => {
  const dir = tmp();
  writeIssue({ dir, content: '열린 문제' });
  const done = writeIssue({ dir, content: '끝난 문제' });
  fs.writeFileSync(done.file, fs.readFileSync(done.file, 'utf8').replace('status: "open"', 'status: "done"'));
  const out = buildStatus({ env: { CLAUDE_PLUGIN_DATA: dir }, home: tmp(), cwd: tmp() });
  assert.match(out, /- 1건 \(데이터 폴더: CLAUDE_PLUGIN_DATA\)\n {2}- 열린 문제/);
  assert.doesNotMatch(out, /끝난 문제/);
});

test('인자 해석, 제목 자르기, 데이터 폴더 순서', () => {
  assert.deepEqual(parseArgs(['--skill', 'work-start', '--summary', '요약', '--', '내용', '--skill']), {
    skill: 'work-start', summary: '요약', content: '내용 --skill',
  });
  assert.equal(titleOf('a\nb'), 'a b');
  assert.equal(titleOf('가'.repeat(100)).length, 60);
  assert.equal(dataDir({ PLUGIN_DATA: '/p' }, '/h').how, 'PLUGIN_DATA');
  assert.equal(dataDir({}, '/h').dir, path.join('/h', '.my', 'data'));
});
