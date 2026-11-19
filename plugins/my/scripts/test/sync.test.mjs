import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Conflict, diff } from '../change-apply.mjs';
import { applySync, importCycles, plan, planRules, planSkills } from '../sync.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'my-sync-'));
const write = (root, f, text) => {
  fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
  fs.writeFileSync(path.join(root, f), text);
};
const read = (root, f) => fs.readFileSync(path.join(root, f), 'utf8');
const rec = () => fs.mkdtempSync(path.join(os.tmpdir(), 'my-sync-rec-'));

test('규칙: AGENTS.md가 없으면 보류하고 승격 후보를 알린다', () => {
  const root = tmp();
  write(root, 'CLAUDE.md', '# 규칙\n- a\n');
  const r = planRules(root, 'claude', 'gemini');
  assert.equal(r.changes.length, 0);
  assert.match(r.hold[0], /AGENTS.md가 없다.*CLAUDE.md/);
});

test('규칙: 대상 어댑터가 없으면 참조와 머리말로 만들고, 있으면 참조만 앞에 더한다', () => {
  const root = tmp();
  write(root, 'AGENTS.md', '# 공통\n');
  write(root, 'CLAUDE.md', '@AGENTS.md\n\n# Claude\n');
  const made = planRules(root, 'claude', 'gemini').changes[0];
  assert.equal(made.path, 'GEMINI.md');
  assert.match(made.content, /^@\.\/AGENTS\.md\n\n# Gemini 규칙\n/);
  write(root, 'GEMINI.md', '# 전용\n- g\n');
  assert.equal(planRules(root, 'claude', 'gemini').changes[0].content, '@./AGENTS.md\n\n# 전용\n- g\n');
  write(root, 'GEMINI.md', '@AGENTS.md\n# 전용\n');
  assert.equal(planRules(root, 'claude', 'gemini').changes.length, 0);
});

test('규칙: codex 대상은 바꿀 것이 없고, 원본이 AGENTS.md를 참조하지 않으면 알린다', () => {
  const root = tmp();
  write(root, 'AGENTS.md', '# 공통\n');
  write(root, 'CLAUDE.md', '# 섞임\n');
  const r = planRules(root, 'claude', 'codex');
  assert.equal(r.changes.length, 0);
  assert.ok(r.notes.some((n) => /참조하지 않는다/.test(n)) && r.notes.some((n) => /직접 읽는다/.test(n)));
});

test('규칙: 가져오기 순환은 보류한다', () => {
  const root = tmp();
  write(root, 'AGENTS.md', '@GEMINI.md\n');
  assert.deepEqual(importCycles(root, { 'A.md': '@A.md\n' }), ['A.md → A.md']);
  const r = planRules(root, 'claude', 'gemini');
  assert.equal(r.changes.length, 0);
  assert.match(r.hold[0], /순환/);
});

test('스킬: 폴더째 계획하고, 밖 참조·없는 참조·대상 전용 파일이 있으면 그 스킬만 보류', () => {
  const root = tmp();
  write(root, '.claude/skills/ok/SKILL.md', '# ok\n[r](references/a.md)\n');
  write(root, '.claude/skills/ok/references/a.md', '# a\n');
  write(root, '.claude/skills/out/SKILL.md', '# out\n`../../scripts/x.mjs`\n');
  write(root, '.claude/skills/miss/SKILL.md', '# miss\n[r](nope.md)\n');
  write(root, '.claude/skills/extra/SKILL.md', '# extra\n');
  write(root, '.agents/skills/extra/local.md', '# mine\n');
  write(root, '.claude/skills/same/SKILL.md', '# same\n');
  write(root, '.agents/skills/same/SKILL.md', '# same\n');
  const r = planSkills(root, 'claude', 'codex');
  assert.deepEqual(r.skills, ['ok']);
  assert.deepEqual(r.same, ['same']);
  assert.deepEqual(r.changes.map((c) => c.path).sort(), ['.agents/skills/ok/SKILL.md', '.agents/skills/ok/references/a.md']);
  const hold = r.hold.join('\n');
  assert.match(hold, /out: .*스킬 폴더 밖 참조/);
  assert.match(hold, /miss: .*없는 파일 참조/);
  assert.match(hold, /extra: 대상에만 있는 파일: local\.md/);
});

test('plan → apply: 승인한 변경을 쓰고, 원본이 바뀌었으면 쓰기 전에 멈춘다', () => {
  const root = tmp();
  write(root, 'AGENTS.md', '# 공통\n');
  write(root, '.gemini/skills/s/SKILL.md', '# s\n');
  assert.throws(() => plan(root, 'claude', 'claude'), /같다/);
  assert.throws(() => plan(root, 'claude', 'cursor'), /모르는 도구/);

  const p = plan(root, 'gemini', 'claude', { dir: rec() });
  assert.ok(p.record);
  assert.match(diff(p.record), /### CLAUDE\.md \(새 파일\)[\s\S]*\+@AGENTS\.md/);
  assert.ok(!fs.existsSync(path.join(root, 'CLAUDE.md')));
  const r = applySync(p.record);
  assert.equal(r.status, 'done');
  assert.match(read(root, 'CLAUDE.md'), /^@AGENTS\.md\n/);
  assert.equal(read(root, '.claude/skills/s/SKILL.md'), '# s\n');

  write(root, '.gemini/skills/s/SKILL.md', '# s2\n');
  const p2 = plan(root, 'gemini', 'claude', { dir: rec() });
  write(root, '.gemini/skills/s/SKILL.md', '# s3\n');
  assert.throws(() => applySync(p2.record), (e) => e instanceof Conflict && /원본이 계획 뒤 달라짐/.test(e.files[0]));
  assert.equal(read(root, '.claude/skills/s/SKILL.md'), '# s\n');
});

test('plan: 바꿀 것이 없으면 기록을 만들지 않는다', () => {
  const root = tmp();
  write(root, 'AGENTS.md', '# 공통\n');
  write(root, 'CLAUDE.md', '@AGENTS.md\n');
  assert.equal(plan(root, 'gemini', 'claude').record, null);
});
