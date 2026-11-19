import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTable, route, respond, stance, MARKER } from '../keyword.mjs';

const T = loadTable();
const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'keyword.mjs');
const skillOf = (s) => {
  const r = route(s, T);
  return r && (r.kind === 'match' ? r.cmd.skill : 'usage');
};

test('일반 대화와 비슷한 말에는 반응하지 않는다', () => {
  for (const s of ['마이그레이션 해줘', '마이크 설정', '마이 친구', '안녕 마이 작업 시작', '마이작업 시작', '']) {
    assert.equal(route(s, T), null, s);
  }
});

test('등록 양식은 해당 스킬로', () => {
  assert.equal(skillOf('마이 작업 시작'), 'work-start');
  assert.equal(skillOf('  마이 작업 시작 오늘은 로그인 버그'), 'work-start');
  assert.equal(skillOf('마이 기존 소스 학습'), 'learn-source');
  assert.equal(skillOf('마이 플러그인 현황'), 'plugin-status');
  assert.equal(skillOf('마이 학습 점검'), 'learn-manage');
});

test('고정 단어는 공백이나 끝에서 끊긴다: 현황판은 현황이 아니다', () => {
  assert.equal(skillOf('마이 플러그인 현황판'), 'usage');
  assert.equal(skillOf('마이 작업 시작합니다'), 'usage');
});

test('인자를 꺼낸다', () => {
  let r = route('마이 플러그인 문제 키워드가 두 번 들어감', T);
  assert.equal(r.cmd.skill, 'plugin-issue');
  assert.deepEqual(r.args, { 내용: '키워드가 두 번 들어감' });
  r = route('마이 프로젝트 blog 구현', T);
  assert.equal(r.cmd.skill, 'project-build');
  assert.deepEqual(r.args, { name: 'blog' });
  r = route('마이 설정 동기화 claude->codex', T);
  assert.equal(r.cmd.skill, 'sync');
  assert.deepEqual(r.args, { 원본: 'claude', 대상: 'codex' });
});

test('필수 인자 누락은 사용법만', () => {
  for (const s of ['마이 플러그인 문제', '마이 적대적 학습', '마이 프로젝트 생성', '마이 설정 동기화', '마이 플러그인']) {
    assert.equal(skillOf(s), 'usage', s);
  }
});

test('Claude Code·Codex·Gemini CLI 출력: hook_event_name을 그대로 돌려준다', () => {
  const out = respond({ hook_event_name: 'BeforeAgent', prompt: '마이 플러그인 현황' }, T);
  assert.equal(out.hookSpecificOutput.hookEventName, 'BeforeAgent');
  assert.ok(out.hookSpecificOutput.additionalContext.startsWith(MARKER));
  assert.match(out.hookSpecificOutput.additionalContext, /plugin-status/);
});

test('구현 안 된 스킬은 미구현으로 알린다', () => {
  const out = respond({ hook_event_name: 'UserPromptSubmit', prompt: '마이 작업 시작' }, T, path.resolve('/no/such/root'));
  assert.match(out.hookSpecificOutput.additionalContext, /아직 구현되지 않았다/);
});

test('Antigravity CLI: invocationNum 0일 때만 injectSteps', () => {
  const out = respond({ lastUserInput: '마이 플러그인 현황', invocationNum: 0 }, T);
  assert.match(out.injectSteps[0].systemMessage.systemMessage, /plugin-status/);
  assert.equal(respond({ lastUserInput: '마이 플러그인 현황', invocationNum: 1 }, T), null);
  assert.equal(respond({ lastUserInput: '', invocationNum: 0 }, T), null);
});

test('태도 규칙: 도구별 형식', () => {
  assert.equal(stance({ hook_event_name: 'SessionStart' }).hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(stance({}, 'agy').injectSteps[0].systemMessage.systemMessage, /마이 적대적 학습/);
});

test('스크립트 실행: 반응 없으면 출력 없음, 깨진 입력에도 0으로 끝남', () => {
  const run = (input, args = []) => execFileSync('node', [SCRIPT, ...args], { input, encoding: 'utf8' });
  assert.equal(run(JSON.stringify({ prompt: '안녕' })), '');
  assert.equal(run('{ broken'), '');
  const out = JSON.parse(run(JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: '마이 플러그인 현황' })));
  assert.match(out.hookSpecificOutput.additionalContext, /plugin-status/);
});
