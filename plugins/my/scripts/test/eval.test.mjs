import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addHistory, cases, cost, lastHistory, lint } from '../eval.mjs';
import { ablate } from '../eval-ablate.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'my-eval-'));
const write = (root, f, text) => {
  fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
  fs.writeFileSync(path.join(root, f), text);
};
const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8');

test('lint: 강조·기본값 강요·끝까지·긴 description을 찾고, 코드와 "절대 경로"는 넘긴다', () => {
  const root = tmp();
  const long = 'x'.repeat(401);
  write(root, 'skills/a/SKILL.md', `---\nname: a\ndescription: ${long}\n---\n\n반드시 묻는다.\n애매하면 멈춘다.\n끝까지 고친다.\n절대 경로로 실행한다.\n\`MUST\` 문자열\n\`\`\`\nIMPORTANT 코드\n\`\`\`\n보통 문장.\n`);
  write(root, 'hooks/critical-stance.md', '- NEVER agree first\n');
  const r = lint(root);
  const at = r.found.map((f) => `${f.at} ${f.item}`);
  assert.deepEqual(at, [
    'skills/a/SKILL.md:6 강조 표현',
    'skills/a/SKILL.md:7 기본값 강요',
    'skills/a/SKILL.md:8 완료 조건 없는 지시',
    'skills/a/SKILL.md:description 긴 description',
    'hooks/critical-stance.md:1 강조 표현',
  ]);
});

test('cases: prompt.md·case.yaml 폴더를 사례로 세고 results는 뺀다', () => {
  const root = tmp();
  write(root, 'evals/b/prompt.md', '---\ntags: [keyword, x]\n---\nhi\n');
  write(root, 'evals/a/case.yaml', 'name: a\n');
  write(root, 'evals/results/r1/prompt.md', 'x');
  assert.deepEqual(cases(root).map((c) => c.name), ['a', 'b']);
  assert.deepEqual(cases(root, { tag: 'keyword' }).map((c) => c.name), ['b']);
});

test('cost: 사례×갈래×횟수×단가, 모르는 모델은 미측정', () => {
  const r = cost({ cases: 10, models: ['haiku', 'sonnet', 'opus'] });
  assert.equal(r.rows[0].usd, 0.15);
  assert.equal(r.rows[1].usd, 1.44);
  assert.equal(r.rows[2].usd, null);
  assert.deepEqual(r.unknown, ['opus']);
  assert.equal(cost({ cases: 1, models: ['opus'], runs: 1, arms: 1, unit: { opus: 0.5 } }).total, 0.5);
});

test('history: 더하고 마지막 줄을 읽는다', () => {
  const file = path.join(tmp(), 'd', 'eval-history.md');
  assert.equal(lastHistory(file), null);
  addHistory(file, { model: 'haiku', score: '0.8', now: new Date('2026-11-01T00:00:00Z') });
  addHistory(file, { model: 'sonnet', score: '9/10 | 1 실패', note: '첫\n평가', now: new Date('2026-11-19T00:00:00Z') });
  assert.deepEqual(lastHistory(file), { date: '2026-11-19', model: 'sonnet', score: '9/10 / 1 실패' });
  assert.throws(() => addHistory(file, { model: 'x' }), /필요/);
});

const plugin = () => {
  const root = tmp();
  write(root, 'skills/s/SKILL.md', '# s\n- 동의로 시작하지 않는다.\n- 다른 규칙\n');
  write(root, 'hooks/critical-stance.md', '- 동의로 시작하지 않는다.\n- 미확인 표시\n');
  write(root, 'hooks/hooks.json', JSON.stringify({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node "x/keyword.mjs"' }] }], SessionStart: [{ hooks: [{ type: 'command', command: 'node "x/keyword.mjs" stance' }] }] } }));
  write(root, 'evals/results/old/a.txt', 'x');
  write(root, 'evals/c/prompt.md', 'hi');
  return root;
};

test('ablate: 지정한 쪽에서만 줄을 빼고, 원본·결과 폴더는 그대로', () => {
  const root = plugin();
  const out = tmp();
  const r = ablate({ root, line: '동의로 시작하지', where: 'skills', out: path.join(out, '1') });
  assert.deepEqual(r.removed.map((x) => x.at), ['skills/s/SKILL.md:2']);
  assert.equal(read(r.copy, 'skills/s/SKILL.md'), '# s\n- 다른 규칙\n');
  assert.match(read(r.copy, 'hooks/critical-stance.md'), /동의로/);
  assert.ok(fs.existsSync(path.join(r.copy, 'evals/c/prompt.md')));
  assert.ok(!fs.existsSync(path.join(r.copy, 'evals/results')));
  assert.match(read(root, 'skills/s/SKILL.md'), /동의로/);

  const all = ablate({ root, line: '동의로 시작하지', out: path.join(out, '2') });
  assert.equal(all.removed.length, 2);
});

test('ablate: 태도 훅만 빼고 키워드 훅은 남긴다, 맞는 줄이 없으면 복사본을 지우고 오류', () => {
  const root = plugin();
  const out = tmp();
  const r = ablate({ root, noStance: true, out: path.join(out, '1') });
  const cfg = JSON.parse(read(r.copy, 'hooks/hooks.json'));
  assert.equal(cfg.hooks.SessionStart, undefined);
  assert.equal(cfg.hooks.UserPromptSubmit.length, 1);
  assert.throws(() => ablate({ root, line: '없는 문장', out: path.join(out, '2') }), /맞는 줄이 없다/);
  assert.ok(!fs.existsSync(path.join(out, '2')));
  assert.throws(() => ablate({ root, out: path.join(out, '3') }), /필요/);
});
