import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snap, check as guardCheck, restore } from '../guard.mjs';
import { learnRoot, newNote, importNote, relink, topics, check, log, stage, applyStaged } from '../learn.mjs';
import { summary } from '../change-apply.mjs';

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
  assert.deepEqual(guardCheck(dir).changed, []);
  fs.writeFileSync(path.join(root, 'a.md'), 'A3\n');
  fs.writeFileSync(path.join(root, 'b.md'), 'B2\n');
  fs.writeFileSync(path.join(root, 'c.md'), 'C\n');
  const ch = Object.fromEntries(guardCheck(dir).changed.map((c) => [c.file, c]));
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
  assert.throws(() => newNote(root, { topic: 'rag', name: 'bm25', subtopic: 'search', now }), /섞을 수 없다/);
  const s = newNote(root, { topic: 'search', name: 'bm25', subtopic: 'lexical', now });
  assert.match(s.file, /search\/01-lexical\/01-bm25\.md$/);
  assert.match(read(s.file), /subtopic: "lexical"/);
  assert.equal(newNote(root, { topic: 'search', name: 'hybrid', subtopic: 'lexical', now }).file.match(/01-lexical\/02-hybrid/)?.length, 1);
  assert.throws(() => newNote(root, { topic: 'search', name: 'x', now }), /--subtopic/);
  assert.deepEqual(topics(root).map((t) => [t.topic, t.notes, t.subtopics]), [['rag', 2, 0], ['search', 2, 1]]);
  assert.deepEqual(relink(root, 'rag'), []);
  assert.deepEqual(check(root).problems, []);
  assert.throws(() => newNote(root, { topic: '../x', name: 'n' }), /이름이 올바르지 않다/);
});

test('가져오기: 채팅 모드 노트를 번호를 매겨 들이고 본문·앞머리를 옮긴다', () => {
  const root = tmp('my-learn-');
  const src = tmp('my-import-');
  const now = new Date(2026, 10, 19);
  newNote(root, { topic: 'rag', name: 'pipeline', now });
  const f = path.join(src, '미정-vector-db.md');
  fs.writeFileSync(
    f,
    '---\r\ntopic: "rag"\r\nsubtopic: "<소주제>"\r\ntags: ["ml"]\r\nsources: ["강의.pdf:3", "<자료:페이지>"]\r\nupdated: 2026-01-01\r\n---\r\n\r\n# 벡터 DB\r\n\r\n[목록](index.md)\r\n\r\n## 요약\r\n\r\n색인 구조.\r\n\r\n## 내용\r\n\r\n```md\r\n# 코드 안 제목\r\n[목록](index.md)\r\n```\r\n\r\n## 이해도 점검\r\n\r\n- 맞음\r\n',
  );
  const r = importNote(root, f, { now });
  assert.match(r.file, /rag\/02-vector-db\.md$/);
  const t = read(r.file);
  assert.match(t, /^# 벡터 DB$/m);
  assert.match(t, /sources: \["강의\.pdf:3"\]/);
  assert.match(t, /tags: \["ml"\]/);
  assert.ok(!t.includes('subtopic:'));
  assert.ok(!t.includes('\r'));
  assert.match(t, /^updated: 2026-11-19$/m);
  assert.match(t, /색인 구조\./);
  assert.match(t, /```md\n# 코드 안 제목\n\[목록\]\(index\.md\)\n```/);
  assert.equal(t.split('\n').filter((l) => l.startsWith('[목록](index.md) |')).length, 2);
  assert.equal((t.match(/^## 요약$/gm) || []).length, 1);
  assert.ok(fs.existsSync(f), '원본은 남긴다');
  assert.match(read(path.join(root, 'rag', 'index.md')), /\[벡터 DB\]\(02-vector-db\.md\)/);
  assert.deepEqual(check(root).problems, []);
  // 앞머리 없는 노트: 주제가 없으면 거부, --topic·--name이면 들인다
  const g = path.join(src, '03-x.md');
  fs.writeFileSync(g, '# 제목만\n\n본문\n');
  assert.throws(() => importNote(root, g, { now }), /주제가 없다/);
  const r2 = importNote(root, g, { topic: 'misc', name: 'only-title', now });
  assert.match(r2.file, /misc\/01-only-title\.md$/);
  assert.match(read(r2.file), /\[목록\]\(index\.md\)\n\n본문\n\n\[목록\]\(index\.md\)/);
});

test('노트: 버전 폴더, versions 앞머리, 자료·이력 기록', () => {
  const root = tmp('my-learn-v-');
  const now = new Date(2026, 10, 19);
  newNote(root, { topic: 'react', name: 'hooks', version: 18, now });
  const b = newNote(root, { topic: 'react', name: 'actions', version: 'v19', versions: ['react=19.0'], now });
  assert.match(b.file, /react\/v19\/01-actions\.md$/);
  assert.match(read(b.file), /versions: \{"react": "19\.0"\}\nupdated:/);
  assert.ok(read(b.file).includes('[목록](../index.md)'));
  const idx = read(path.join(root, 'react', 'index.md'));
  assert.match(idx, /### v18 \(이전 버전\)/);
  assert.match(idx, /### v19\n\n- \[actions\]\(v19\/01-actions\.md\)/);
  assert.deepEqual(topics(root)[0].versions, ['v18', 'v19']);
  log(root, 'react', { sources: ['https://react.dev'], history: '버전 비교', now });
  assert.equal(log(root, 'react', { sources: ['https://react.dev'] }), null);
  assert.match(read(path.join(root, 'react', 'index.md')), /## 자료\n\n- https:\/\/react\.dev\n\n## 학습 이력\n\n- 2026-11-19 시작\n- 2026-11-19 버전 비교/);
  const r = check(root);
  assert.deepEqual(r.problems, []);
  assert.equal(r.info.length, 1);
  assert.match(r.info[0], /v18 — 이전 버전/);
});

test('점검: 깨진 링크·번호 누락·목록 불일치·오래된 INDEX를 찾는다', () => {
  const root = tmp('my-learn-c-');
  const now = new Date(2026, 10, 19);
  const a = newNote(root, { topic: 'rag', name: 'a', now });
  newNote(root, { topic: 'rag', name: 'b', now });
  newNote(root, { topic: 'rag', name: 'c', now });
  fs.appendFileSync(a.file, '\n[없음](09-x.md) [절대](C:/x.md) [제목](03-c.md#intro)\n');
  fs.rmSync(path.join(root, 'rag', '02-b.md'));
  fs.writeFileSync(path.join(root, 'rag', 'memo.md'), '# 메모\n');
  const kinds = new Set(check(root).problems.map((p) => p.kind));
  for (const k of ['깨진 링크', '절대 경로 링크', '다른 파일 제목 링크', '번호 누락', '번호 없는 노트', '노트 목록이 폴더와 다름', 'INDEX.md가 오래됨', '이동 링크 불일치']) assert.ok(kinds.has(k), k);
});

test('통합: 소주제로 나누는 변경안을 검사하고 적용한다(링크·앞머리 갱신)', () => {
  const root = tmp('my-learn-s-');
  const now = new Date(2026, 10, 19);
  const a = newNote(root, { topic: 'rag', name: 'a', now });
  newNote(root, { topic: 'rag', name: 'b', now });
  newNote(root, { topic: 'other', name: 'x', now });
  fs.appendFileSync(path.join(root, 'other', '01-x.md'), '\n[참고](../rag/02-b.md)\n');
  fs.appendFileSync(a.file, '\n[다음 글](02-b.md)\n');
  assert.deepEqual(check(root).problems, []);
  const sub = (t) => `---\ntopic: "rag"\ntags: []\nupdated: 2026-11-19\n---\n\n# ${t}\n\n## 개요\n\n## 노트\n\n## 자료\n\n## 학습 이력\n`;
  const plan = { changes: [
    { move: 'rag/01-a.md', to: 'rag/01-base/01-a.md' },
    { move: 'rag/02-b.md', to: 'rag/02-adv/01-b.md' },
    { path: 'rag/01-base/index.md', content: sub('base') },
    { path: 'rag/02-adv/index.md', content: sub('adv') },
  ] };
  const { dir } = stage(root, plan);
  assert.ok(fs.existsSync(path.join(root, 'rag', '01-a.md')), '적용 전에는 그대로');
  assert.ok(summary(dir).entries.length >= 6);
  applyStaged(dir);
  const moved = read(path.join(root, 'rag', '01-base', '01-a.md'));
  assert.match(moved, /subtopic: "base"/);
  assert.ok(moved.includes('[다음 글](../02-adv/01-b.md)'));
  assert.ok(read(path.join(root, 'other', '01-x.md')).includes('[참고](../rag/02-adv/01-b.md)'));
  assert.match(read(path.join(root, 'rag', 'index.md')), /- \[base\]\(01-base\/index\.md\)\n- \[adv\]\(02-adv\/index\.md\)/);
  assert.deepEqual(check(root).problems, []);
  assert.throws(() => stage(root, { changes: [{ path: 'rag/03-z.md', content: 'x' }] }), /새 문제/);
});
