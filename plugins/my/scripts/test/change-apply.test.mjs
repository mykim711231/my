import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepare, apply, rollback, summary, Conflict } from '../change-apply.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);

function setup() {
  const root = tmp('my-ca-');
  fs.mkdirSync(path.join(root, 't'));
  fs.writeFileSync(path.join(root, 't', '01-a.md'), 'A\n');
  fs.writeFileSync(path.join(root, 't', 'index.md'), 'I\n');
  // 옮기기 = 새 자리에 쓰기 + 옛 자리 지우기 + 목록 고치기
  const dir = prepare(root, [
    { path: 't/s/01-a.md', content: 'A\n' },
    { path: 't/01-a.md', content: null },
    { path: 't/index.md', content: 'I2\n' },
  ]);
  return { root, dir, f: (p) => path.join(root, ...p.split('/')) };
}

test('적용: 옮긴 직후 중단돼도 같은 명령으로 이어서 끝낸다', () => {
  const { dir, f } = setup();
  assert.equal(apply(dir, { stopAfter: 1 }).status, 'applying');
  assert.equal(read(f('t/s/01-a.md')), 'A\n');
  assert.equal(read(f('t/01-a.md')), 'A\n');
  const r = apply(dir);
  assert.equal(r.status, 'done');
  assert.deepEqual(r.written, ['t/01-a.md', 't/index.md']);
  assert.equal(read(f('t/01-a.md')), null);
  assert.equal(summary(dir).status, 'done');
});

test('되돌림: 중단된 적용을 승인 전 상태로 돌린다(빈 폴더도 지운다)', () => {
  const { dir, f } = setup();
  apply(dir, { stopAfter: 1 });
  assert.deepEqual(rollback(dir).restored, ['t/s/01-a.md']);
  assert.equal(read(f('t/01-a.md')), 'A\n');
  assert.ok(!fs.existsSync(f('t/s')));
  assert.throws(() => apply(dir), /이미 되돌린/);
});

test('복구: git 저장소의 추적 안 된 노트도 기록에서 되살린다', () => {
  const { root, dir, f } = setup();
  execFileSync('git', ['init', '-q'], { cwd: root });
  apply(dir);
  assert.equal(read(f('t/01-a.md')), null);
  rollback(dir);
  assert.equal(read(f('t/01-a.md')), 'A\n');
  assert.equal(read(f('t/index.md')), 'I\n');
});

test('충돌: 승인 뒤 다른 세션이 고친 파일이 있으면 아무것도 쓰지 않는다', () => {
  const { dir, f } = setup();
  fs.writeFileSync(f('t/index.md'), '다른 세션\n');
  assert.throws(() => apply(dir), (e) => e instanceof Conflict && /t\/index\.md/.test(e.files.join()));
  assert.equal(read(f('t/s/01-a.md')), null);
  assert.equal(read(f('t/01-a.md')), 'A\n');
});

test('되돌림 충돌: 적용 뒤 바뀐 파일은 보존하고 나머지만 되돌린다', () => {
  const { dir, f } = setup();
  apply(dir);
  fs.writeFileSync(f('t/index.md'), '사용자 편집\n');
  assert.throws(() => rollback(dir), (e) => e instanceof Conflict && /보존/.test(e.files.join()));
  assert.equal(read(f('t/index.md')), '사용자 편집\n');
  assert.equal(read(f('t/01-a.md')), 'A\n');
  assert.equal(summary(dir).status, 'rolled-back-partial');
});

test('적용 뒤 검사: 문제가 있으면 완료로 표시하지 않고, 고친 뒤 다시 검사한다', () => {
  const { dir } = setup();
  let problems = ['x — 문제'];
  assert.throws(() => apply(dir, { verify: () => problems }), /검사 실패/);
  assert.equal(summary(dir).status, 'verify-failed');
  problems = [];
  assert.equal(apply(dir, { verify: () => problems }).status, 'done');
});
