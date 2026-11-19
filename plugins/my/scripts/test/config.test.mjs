import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveConfig, normalizePath, pathKey } from '../config.mjs';

function makeHome(config, known) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'my-config-'));
  if (config !== undefined) {
    fs.mkdirSync(path.join(home, '.my'));
    fs.writeFileSync(path.join(home, '.my', 'config.json'), typeof config === 'string' ? config : JSON.stringify(config));
  }
  if (known) {
    fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'plugins', 'known_marketplaces.json'), JSON.stringify(known));
  }
  return home;
}
const ROOT = path.resolve('/work/proj');
const run = (home, extra = {}) => resolveConfig({ home, env: {}, root: ROOT, ...extra });

test('파일이 없으면 기본값', () => {
  const r = run(makeHome());
  assert.deepEqual(r.values.learn_target, { value: 'project', source: 'default' });
  assert.deepEqual(r.values.learn_root, { value: null, source: 'default' });
  assert.equal(r.warnings.length, 0);
});

test('env > project > global > default 순서와 출처', () => {
  const home = makeHome({
    learn_target: 'central',
    learn_root: path.resolve('/notes/global'),
    mermaid_check: 'finish',
    projects: { [ROOT]: { learn_target: 'project', mermaid_check: 'off' } },
  });
  const r = run(home, { env: { MY_LEARN_ROOT: path.resolve('/notes/env') } });
  assert.deepEqual(r.values.learn_target, { value: 'project', source: 'project' });
  assert.deepEqual(r.values.mermaid_check, { value: 'off', source: 'project' });
  assert.deepEqual(r.values.learn_root, { value: normalizePath('/notes/env'), source: 'env' });
  assert.deepEqual(r.values.work_end_question, { value: true, source: 'default' });
});

test('프로젝트 밖(git 루트 없음)이면 projects를 쓰지 않는다', () => {
  const home = makeHome({ learn_target: 'central', projects: { [ROOT]: { learn_target: 'project' } } });
  const r = resolveConfig({ home, env: {}, root: null });
  assert.deepEqual(r.values.learn_target, { value: 'central', source: 'global' });
});

test('잘못된 값과 모르는 키는 그 항목만 기본값, 경고', () => {
  const home = makeHome({ learn_target: 'nowhere', usage_log: false, foo: 1, project_learn_dir: '../x' });
  const r = run(home);
  assert.deepEqual(r.values.learn_target, { value: 'project', source: 'default' });
  assert.deepEqual(r.values.usage_log, { value: false, source: 'global' });
  assert.deepEqual(r.values.project_learn_dir, { value: 'docs/learn', source: 'default' });
  assert.equal(r.warnings.length, 3);
});

test('projects에 둘 수 없는 키는 무시', () => {
  const home = makeHome({ projects: { [ROOT]: { learn_root: path.resolve('/x') } } });
  const r = run(home);
  assert.equal(r.values.learn_root.source, 'default');
  assert.equal(r.warnings.length, 1);
});

test('깨진 JSON은 경고 후 기본값', () => {
  const r = run(makeHome('{ nope'));
  assert.equal(r.values.learn_target.source, 'default');
  assert.equal(r.warnings.length, 1);
});

test('잘못된 env 값은 무시하고 다음 순서로', () => {
  const r = run(makeHome({ learn_root: path.resolve('/notes/g') }), { env: { MY_LEARN_ROOT: 'relative/dir' } });
  assert.equal(r.values.learn_root.source, 'global');
  assert.equal(r.warnings.length, 1);
});

test('plugin_src 자동: 로컬 폴더로 등록된 my 마켓플레이스', () => {
  const src = path.resolve('/dev/my');
  const home = makeHome(undefined, { my: { source: { source: 'directory', path: src }, installLocation: src } });
  assert.deepEqual(run(home).values.plugin_src, { value: normalizePath(src), source: 'auto' });
});

test('plugin_src 자동: GitHub 설치면 원본 없음', () => {
  const home = makeHome(undefined, { my: { source: { source: 'github', repo: 'a/b' }, installLocation: path.resolve('/c') } });
  assert.deepEqual(run(home).values.plugin_src, { value: null, source: 'default' });
});

test('경로 정규화: 구분자 /, 끝 / 없음, Windows 대소문자 무시', () => {
  assert.ok(!normalizePath(path.resolve('/a/b') + path.sep).endsWith('/'));
  assert.ok(!normalizePath(path.resolve('/a/b')).includes('\\'));
  assert.equal(pathKey('C:\\Work\\Proj\\', 'win32'), pathKey('c:/work/proj', 'win32'));
});

test('projects 키 대소문자·구분자가 달라도 Windows에서는 같은 프로젝트', { skip: process.platform !== 'win32' }, () => {
  const home = makeHome({ projects: { [ROOT.toUpperCase().replace(/\\/g, '/') + '/']: { learn_target: 'central' } } });
  assert.equal(run(home).values.learn_target.source, 'project');
});
