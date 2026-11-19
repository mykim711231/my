import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { latestHandoff, newHandoff, specTasks, nextItems, specs, buildStatus } from '../work.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'my-work-'));
const write = (root, f, text) => {
  fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
  fs.writeFileSync(path.join(root, f), text);
};

test('인계 문서: 같은 분이면 -2, -3 접미사, 최근 것은 접미사 순', () => {
  const root = tmp();
  assert.equal(latestHandoff(root), null);
  const now = new Date(2026, 10, 19, 9, 5);
  const a = newHandoff(root, { branch: 'main', spec: 'docs/specs/01-a.md', now });
  const b = newHandoff(root, { now });
  const c = newHandoff(root, { now });
  assert.match(a, /20261119-0905\.md$/);
  assert.match(b, /20261119-0905-2\.md$/);
  assert.match(c, /20261119-0905-3\.md$/);
  assert.equal(latestHandoff(root), c);
  const text = fs.readFileSync(a, 'utf8');
  assert.match(text, /^branch: "main"$/m);
  assert.match(text, /^spec: "docs\/specs\/01-a\.md"$/m);
  assert.match(text, /# 인계 2026-11-19/);
  assert.ok(!text.includes('{{'));
  newHandoff(root, { now: new Date(2026, 10, 19, 10, 0) });
  assert.match(latestHandoff(root), /20261119-1000\.md$/);
});

test('명세 작업 체크박스와 인계 다음 할 일', () => {
  const root = tmp();
  write(root, 'docs/specs/01-a.md', '---\nstatus: approved\n---\n## 작업\n\n- [x] 하나\n- [ ] 둘\n- [ ] 셋\n\n## 검증 결과\n\n- [ ] 아님\n');
  write(root, 'docs/specs/02-b.md', '---\nstatus: draft\n---\n# b\n');
  write(root, 'docs/specs/_template.md', '---\nstatus: draft\n---\n');
  const t = specTasks(path.join(root, 'docs/specs/01-a.md'));
  assert.deepEqual(t, { open: ['둘', '셋'], done: 1, total: 3 });
  assert.equal(specs(root).length, 2);
  write(root, 'docs/handoff/20261119-0900.md', '## 다음 할 일\n\n1. 테스트 추가\n- [ ] 문서 정리\n\n## 주의할 것\n\n- 무시\n');
  assert.deepEqual(nextItems(latestHandoff(root)), ['테스트 추가', '문서 정리']);
  const s = buildStatus(root);
  assert.match(s, /### 할 일\n\n- docs\/specs\/02-b\.md[\s\S]*테스트 추가 \(인계 문서\)/);
  assert.match(s, /### 진행\n\n- docs\/specs\/01-a\.md — 작업 1\/3\n  - \[ \] 둘/);
});

test('인계 문서: 템플릿이 CRLF로 받아졌어도(Windows autocrlf) LF로 쓴다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'my-work-crlf-'));
  const tpl = path.join(root, 'handoff.md');
  fs.writeFileSync(tpl, '---\r\nbranch: {{branch}}\r\n---\r\n\r\n## 다음 할 일\r\n');
  const f = newHandoff(root, { branch: 'main', template: tpl });
  const text = fs.readFileSync(f, 'utf8');
  assert.ok(!text.includes('\r'), text);
  assert.match(text, /branch: "main"\n/);
});
