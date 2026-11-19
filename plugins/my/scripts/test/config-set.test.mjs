import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { planChange, applyChange, buildTable, suggestLearnRoot, orphanProjects, normalizePath, resolveConfig } from '../config.mjs';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'config.mjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'my-cfg-'));
const cfgFile = (home) => path.join(home, '.my', 'config.json');
const writeCfg = (home, obj) => {
  fs.mkdirSync(path.join(home, '.my'), { recursive: true });
  fs.writeFileSync(cfgFile(home), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) + '\n');
};

test('미리보기는 파일을 만들지 않고, 저장은 해시가 맞을 때만', () => {
  const home = tmp();
  const op = { type: 'set', key: 'usage_log', value: '끔' };
  const p = planChange(op, { home, root: null });
  assert.equal(fs.existsSync(cfgFile(home)), false);
  assert.deepEqual(p.after, { usage_log: false });
  assert.throws(() => applyChange(op, 'wrong', { home, root: null }), /바뀌었다/);
  applyChange(op, p.expect, { home, root: null });
  assert.deepEqual(JSON.parse(fs.readFileSync(cfgFile(home), 'utf8')), { usage_log: false });
  assert.equal(resolveConfig({ home, root: null, env: {} }).values.usage_log.source, 'global');
});

test('다른 키와 projects는 보존하고, 깨진 JSON이면 쓰지 않는다', () => {
  const home = tmp();
  writeCfg(home, { mermaid_check: 'off', projects: { 'D:/a': { learn_target: 'central' } } });
  const p = planChange({ type: 'set', key: 'learn_root', value: 'D:/notes/' }, { home, root: null });
  assert.equal(p.after.mermaid_check, 'off');
  assert.deepEqual(p.after.projects, { 'D:/a': { learn_target: 'central' } });
  assert.equal(p.after.learn_root, normalizePath('D:/notes/'));
  writeCfg(home, '{ broken');
  assert.throws(() => planChange({ type: 'set', key: 'usage_log', value: 'true' }, { home, root: null }), /깨져/);
});

test('값 검증과 프로젝트 범위 제한', () => {
  const home = tmp();
  const o = { home, root: 'D:/proj' };
  assert.throws(() => planChange({ type: 'set', key: 'mermaid_check', value: 'always' }, o), /허용되지/);
  assert.throws(() => planChange({ type: 'set', key: 'nope', value: 'x' }, o), /모르는 키/);
  assert.throws(() => planChange({ type: 'set', key: 'learn_root', value: 'D:/n', project: true }, o), /프로젝트별/);
  assert.throws(() => planChange({ type: 'set', key: 'learn_target', value: 'central', project: true }, { home, root: null }), /git 루트 밖/);
  const p = planChange({ type: 'set', key: 'learn_target', value: 'central', project: true }, o);
  assert.deepEqual(p.after.projects[normalizePath('D:/proj')], { learn_target: 'central' });
});

test('기존 프로젝트 항목은 대소문자가 달라도 같은 키에 합친다(Windows)', () => {
  const home = tmp();
  writeCfg(home, { projects: { 'D:/Proj': { mermaid_check: 'off' } } });
  const p = planChange({ type: 'set', key: 'learn_target', value: 'central', project: true }, { home, root: 'd:/proj', platform: 'win32' });
  assert.deepEqual(p.after.projects, { 'D:/Proj': { mermaid_check: 'off', learn_target: 'central' } });
});

test('프로젝트 항목 지우기·옮기기', () => {
  const home = tmp();
  const live = tmp();
  writeCfg(home, { projects: { 'D:/gone': { learn_target: 'central' } } });
  assert.deepEqual(orphanProjects(JSON.parse(fs.readFileSync(cfgFile(home), 'utf8'))), ['D:/gone']);
  const mv = planChange({ type: 'move-project', path: 'D:/gone', to: live }, { home, root: null });
  assert.deepEqual(mv.after.projects, { [normalizePath(live)]: { learn_target: 'central' } });
  const rm = planChange({ type: 'remove-project', path: 'D:/gone' }, { home, root: null });
  assert.deepEqual(rm.after.projects, {});
  assert.throws(() => planChange({ type: 'remove-project', path: 'D:/none' }, { home, root: null }), /없는 경로/);
  assert.throws(() => planChange({ type: 'move-project', path: 'D:/gone', to: 'rel' }, { home, root: null }), /절대 경로/);
});

test('현황표: env가 파일 값을 가리면 표시, 폴더 없는 프로젝트 목록', () => {
  const home = tmp();
  writeCfg(home, { learn_root: 'D:/file-notes', projects: { 'D:/gone': { mermaid_check: 'off' } } });
  const out = buildTable({ home, root: null, env: { MY_LEARN_ROOT: tmp() } });
  assert.match(out, /\| `learn_root` \| .* \| `env` \| .*env가 우선 적용 중 \(파일 값 "D:\/file-notes"\)/);
  assert.match(out, /폴더가 없는 프로젝트 항목\n\n- `D:\/gone`/);
  assert.match(out, /\| `usage_log` \| 켬 \| `default` \|/);
});

test('learn_root 제안값', () => {
  assert.equal(suggestLearnRoot({ platform: 'win32', exists: () => true }), 'D:/_MyStudyNotes');
  assert.equal(suggestLearnRoot({ home: '/h', platform: 'linux', exists: () => true }), normalizePath('/h/MyStudyNotes'));
});

test('CLI: 미리보기 → --write --expect로 저장', () => {
  const home = tmp();
  const env = { ...process.env, HOME: home, USERPROFILE: home, MY_LEARN_ROOT: '', MY_PLUGIN_SRC: '' };
  const run = (...a) => execFileSync('node', [SCRIPT, ...a], { env, cwd: home, encoding: 'utf8' });
  const prev = run('set', 'mermaid_check', 'finish');
  assert.match(prev, /\+ {3}"mermaid_check": "finish"/);
  assert.equal(fs.existsSync(cfgFile(home)), false);
  const hash = /--expect (\w+)/.exec(prev)[1];
  const done = run('set', 'mermaid_check', 'finish', '--write', '--expect', hash);
  assert.match(done, /저장함/);
  assert.match(done, /\| `mermaid_check` \| `finish`/);
});
