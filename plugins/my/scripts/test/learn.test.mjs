import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snap, check, restore } from '../guard.mjs';
import { learnRoot, newNote, relink, topics } from '../learn.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const read = (f) => fs.readFileSync(f, 'utf8');

test('편집 감시: 기록 파일 변경·새로 생긴 커밋 안 된 파일을 찾고 되돌린다', () => {
  const root = tmp('my-guard-t-');
  const g = (...a) => execFileSync('git', a, { cwd: root, stdio: 'ignore' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  fs.writeFileSync(path.join(root, 'a.md'), 'A\n');
  fs.writeFileSync(path.join(root, 'b.md'), 'B\n');
  g('add', '.');
  g('commit', '-qm', 'init');
  fs.writeFileSync(path.join(root, 'a.md'), 'A2\n'); // 실행 전부터 커밋 안 된 변경
  const dir = snap({ cwd: root });
  assert.deepEqual(check(dir).changed, []);
  fs.writeFileSync(path.join(root, 'a.md'), 'A3\n');
  fs.writeFileSync(path.join(root, 'b.md'), 'B2\n');
  fs.writeFileSync(path.join(root, 'c.md'), 'C\n');
  const ch = Object.fromEntries(check(dir).changed.map((c) => [c.file, c]));
  assert.equal(ch['a.md'].source, 'snap');
  assert.equal(ch['b.md'].source, 'HEAD');
  assert.equal(ch['c.md'].kind, '새 파일');
  restore(dir, 'a.md');
  restore(dir, 'b.md');
  assert.equal(read(path.join(root, 'a.md')).replace(/\r/g, ''), 'A2\n');
  assert.equal(read(path.join(root, 'b.md')).replace(/\r/g, ''), 'B\n');
  assert.throws(() => restore(dir, 'c.md'), /되돌릴 원래 내용이 없다/);
});

test('학습 루트: 프로젝트 밖이고 learn_root가 없으면 제안값을 돌려준다', () => {
  const cwd = tmp('my-learn-out-');
  const home = tmp('my-home-');
  const r = learnRoot({ cwd, home, env: {} });
  assert.equal(r.root, null);
  assert.equal(r.kind, 'central');
  assert.ok(r.need);
  const r2 = learnRoot({ cwd, home, env: { MY_LEARN_ROOT: path.join(home, 'notes') } });
  assert.equal(r2.kind, 'central');
  assert.match(r2.root, /notes$/);
});

test('노트: 번호·이동 링크·index.md·INDEX.md를 함께 갱신한다', () => {
  const root = tmp('my-learn-');
  const now = new Date(2026, 10, 19);
  const a = newNote(root, { topic: 'rag', name: 'pipeline', title: '파이프라인', now });
  assert.match(a.file, /rag\/01-pipeline\.md$/);
  assert.ok(!read(a.file).includes('subtopic:'));
  const b = newNote(root, { topic: 'rag', name: 'vector-db', title: '벡터 DB', sources: ['p.pdf:3'], now });
  assert.match(b.file, /02-vector-db\.md$/);
  assert.ok(b.updated.some((f) => f.endsWith('01-pipeline.md')));
  const first = read(a.file).split('\n');
  assert.ok(first.includes('[목록](index.md) | [다음 →](02-vector-db.md)'));
  assert.ok(read(b.file).includes('[목록](index.md) | [← 이전](01-pipeline.md)'));
  assert.match(read(b.file), /sources: \["p\.pdf:3"\]/);
  const idx = read(path.join(root, 'rag', 'index.md'));
  assert.match(idx, /- \[파이프라인\]\(01-pipeline\.md\)\n- \[벡터 DB\]\(02-vector-db\.md\)/);
  assert.match(read(path.join(root, 'INDEX.md')), /\[rag\]\(rag\/index\.md\) — 노트 2개, 최근 2026-11-19/);
  const s = newNote(root, { topic: 'rag', name: 'bm25', subtopic: 'search', now });
  assert.match(s.file, /rag\/01-search\/01-bm25\.md$/);
  assert.match(read(s.file), /subtopic: "search"/);
  assert.equal(newNote(root, { topic: 'rag', name: 'hybrid', subtopic: 'search', now }).file.match(/01-search\/02-hybrid/)?.length, 1);
  assert.deepEqual(topics(root).map((t) => [t.topic, t.notes, t.subtopics]), [['rag', 4, 1]]);
  assert.deepEqual(relink(root, 'rag'), []);
  assert.throws(() => newNote(root, { topic: '../x', name: 'n' }), /이름이 올바르지 않다/);
});
