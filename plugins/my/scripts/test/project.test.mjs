import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTrace, check, newSpec, plan, render, scaffold, stacks, writeTrace } from '../project.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'my-project-'));
const write = (root, f, text) => {
  fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
  fs.writeFileSync(path.join(root, f), text);
};
const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8');
const DATE = '2026-11-19';

test('스택 목록에 fastapi, pwa, spring이 있다', () => {
  assert.deepEqual(stacks().map((s) => s.name).sort(), ['fastapi', 'pwa', 'spring']);
});

test('자리표시: 모르는 이름은 오류, title은 남긴다', () => {
  assert.equal(render('{{name}} {{title}}', { name: 'a' }, 'x'), 'a {{title}}');
  assert.throws(() => render('{{nope}}', {}, 'x'), /모르는 자리표시/);
});

test('스택 하나: 루트에 두고 dot- 앞머리를 바꾸고 GEMINI.md는 --gemini일 때만', () => {
  const root = tmp();
  const p = plan(root, ['fastapi'], { name: 'demo', date: DATE });
  const paths = p.files.map((f) => f.path);
  assert.ok(paths.includes('.gitignore') && paths.includes('docs/handoff/.gitkeep'));
  assert.ok(paths.includes('app/main.py') && paths.includes('tests/test_contract.py'));
  assert.ok(!paths.includes('GEMINI.md'));
  assert.ok(plan(root, ['fastapi'], { gemini: true }).files.some((f) => f.path === 'GEMINI.md'));
  const stack = p.files.find((f) => f.path === 'docs/stack.md').content;
  assert.match(stack, /updated: 2026-11-19/);
  assert.match(stack, /### FastAPI \(`\.`\)/);
  assert.match(p.files.find((f) => f.path === 'tests/test_contract.py').content, /"contracts" \/ "openapi.json"/);
  assert.equal(p.files.find((f) => f.path === 'docs/specs/_template.md').content.includes('{{title}}'), true);
});

test('스택 여럿: 역할이 필요하고 apps/<역할>/에 두며 계약 경로는 상대 경로', () => {
  const root = tmp();
  assert.throws(() => plan(root, ['fastapi', 'pwa:web']), /역할을 붙인다/);
  assert.throws(() => plan(root, ['fastapi:a', 'pwa:a']), /역할이 겹친다/);
  assert.throws(() => plan(root, ['django']), /없는 스택/);
  assert.throws(() => plan(root, ['spring']), /package/);
  const p = plan(root, ['fastapi:api', 'spring:core'], { vars: { package: 'com.example.demo' } });
  const paths = p.files.map((f) => f.path);
  assert.ok(paths.includes('apps/api/app/main.py'));
  assert.ok(paths.includes('apps/core/src/main/java/com/example/demo/HealthController.java'));
  assert.ok(paths.includes('contracts/README.md'));
  assert.match(p.files.find((f) => f.path === 'docs/stack.md').content, /\.\.\/\.\.\/contracts\/openapi\.json/);
});

test('scaffold는 덮어쓰지 않는다: 있으면 아무것도 쓰지 않고, --skip-existing이면 나머지만', () => {
  const root = tmp();
  write(root, 'AGENTS.md', 'mine\n');
  assert.throws(() => scaffold(root, ['pwa']), /이미 있는 파일/);
  assert.ok(!fs.existsSync(path.join(root, 'docs')));
  const r = scaffold(root, ['pwa'], { skipExisting: true });
  assert.deepEqual(r.skipped, ['AGENTS.md']);
  assert.equal(read(root, 'AGENTS.md'), 'mine\n');
  assert.ok(fs.existsSync(path.join(root, '.prettierrc.json')));
  const planned = scaffold(tmp(), ['pwa'], { planOnly: true });
  assert.equal(planned.written.length, 0);
});

test('new-spec: 다음 번호, 제목·날짜를 채우고 같은 이름은 거절', () => {
  const root = tmp();
  scaffold(root, ['fastapi'], { date: '2026-01-01' });
  write(root, 'docs/specs/07-old.md', '# x\n');
  const f = newSpec(root, 'login', { title: '로그인', date: DATE });
  assert.equal(f, 'docs/specs/08-login.md');
  const text = read(root, f);
  assert.match(text, /^# 로그인$/m);
  assert.match(text, /updated: 2026-11-19/);
  assert.match(text, /status: draft/);
  assert.throws(() => newSpec(root, 'login', { title: 'x' }), /같은 이름/);
  assert.throws(() => newSpec(root, 'Login', { title: 'x' }), /kebab-case/);
});

test('trace: ID가 나오는 파일을 열별로 모으고, 같으면 다시 쓰지 않는다', () => {
  const root = tmp();
  write(root, 'docs/requirements.md', '---\nupdated: 2026-11-19\n---\n# 요구사항\n\n| ID | 요구사항 | 상태 |\n|---|---|---|\n| REQ-01 | 로그인 | 승인 |\n| REQ-02 | 로그아웃 | 초안 |\n');
  write(root, 'docs/specs/01-login.md', 'REQ-01\n');
  write(root, 'db/migrations/V1__user.sql', '-- REQ-01\n');
  write(root, 'contracts/openapi.json', '{"x":"REQ-01"}\n');
  write(root, 'app/login.py', '# REQ-01\n');
  write(root, 'tests/test_login.py', '# REQ-01\n');
  write(root, 'node_modules/x/a.js', '// REQ-01\n');
  const t = buildTrace(root);
  const row = t.split('\n').find((l) => l.startsWith('| REQ-01'));
  assert.equal(row, '| REQ-01 | 승인 | `docs/specs/01-login.md` | `db/migrations/V1__user.sql` | `contracts/openapi.json` | `app/login.py` | `tests/test_login.py` |');
  assert.match(t, /\| REQ-02 \| 초안 \| — \| — \| — \| — \| — \|/);
  assert.ok(t.startsWith('<!-- 생성됨 — 직접 수정 금지 -->\n'));
  assert.equal(writeTrace(root).same, false);
  assert.equal(writeTrace(root, { check: true }).same, true);
});

test('check: 새 뼈대와 새 명세는 문제 없음', () => {
  const root = tmp();
  scaffold(root, ['fastapi'], { date: DATE });
  newSpec(root, 'first', { title: '첫 기능', date: DATE });
  writeTrace(root);
  assert.deepEqual(check(root).problems, []);
});

test('check: 명세 앞머리·절·reqs, 요구사항 중복, trace 차이, 링크를 잡는다', () => {
  const root = tmp();
  scaffold(root, ['fastapi'], { date: DATE });
  write(root, 'docs/requirements.md', '---\nupdated: 2026-11-19\n---\n# 요구사항\n\n| ID | 요구사항 | 상태 |\n|---|---|---|\n| REQ-01 | a | 승인 |\n| REQ-01 | b | 보류 |\n');
  write(root, 'docs/specs/01-a.md', '---\nstatus: approved\nreqs: [REQ-01, REQ-09]\nupdated: 2026-11-19\n---\n# A\n\n## 목표\n\n## 작업\n\n[x](../nope.md)\n');
  write(root, 'docs/trace.md', 'hand\n');
  const kinds = check(root).problems.map((p) => `${p.kind}:${p.detail}`);
  const has = (re) => assert.ok(kinds.some((k) => re.test(k)), `${re} 없음:\n${kinds.join('\n')}`);
  has(/^요구사항 ID:REQ-01 중복/);
  has(/^요구사항 상태:REQ-01: 보류/);
  has(/^요구사항 ID:REQ-09 — docs\/requirements.md에 없다/);
  has(/^명세 절:목표 \/ 작업/);
  has(/^생성 표시:/);
  has(/^다시 생성 차이:/);
  has(/^깨진 링크:\.\.\/nope\.md/);
  write(root, 'docs/specs/02-b.md', '---\nstatus: wip\n---\n# B\n');
  const more = check(root).problems.filter((p) => p.file === 'docs/specs/02-b.md').map((p) => p.detail);
  assert.ok(more.some((d) => /status: wip/.test(d)) && more.some((d) => /updated/.test(d)) && more.some((d) => /reqs/.test(d)));
});
