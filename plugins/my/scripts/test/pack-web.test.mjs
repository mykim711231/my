import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { build, section, demote, sources, zip, GROUPS, PLUGIN } from '../pack-web.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const read = (f) => fs.readFileSync(f, 'utf8');

// 중앙 디렉터리를 따라 zip을 풀어 { 이름: Buffer }로 돌려준다.
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, '끝 레코드 없음');
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    assert.equal(buf.readUInt32LE(off), 0x04034b50);
    const lnlen = buf.readUInt16LE(off + 26);
    const data = zlib.inflateRawSync(buf.subarray(off + 30 + lnlen, off + 30 + lnlen + csize));
    assert.equal(data.length, size);
    assert.equal(zlib.crc32(data) >>> 0, crc);
    out[name] = data;
    p += 46 + nlen;
  }
  return out;
}

test('웹 패키지: 라우터가 모든 키워드 양식을 담고 설명이 400자 이하다', () => {
  const out = tmp('my-web-');
  build({ out });
  const router = read(path.join(out, 'my', 'SKILL.md'));
  const { keywords } = sources();
  for (const c of keywords.commands) assert.ok(router.includes(`\`${keywords.prefix} ${c.form}\``), c.form);
  const desc = /^description: (.*)$/m.exec(router)[1];
  assert.ok(desc.length <= 400, `${desc.length}자`);
  assert.match(router, /^name: my$/m);
  assert.match(router, /## 공통 규칙/);
  assert.match(router, /## 태도 규칙/);
});

test('웹 패키지: 묶음마다 해당 스킬이 다 있고 공통 줄은 빠진다', () => {
  const out = tmp('my-web-');
  const r = build({ out });
  const { skills } = sources();
  for (const g of GROUPS) {
    const text = read(path.join(out, 'my', g.file));
    for (const s of skills.filter(g.match)) assert.match(text, new RegExp(`^## .+ — \`${s}\`$`, 'm'), `${g.file}: ${s}`);
  }
  const all = r.files.filter((f) => f.endsWith('.md')).map((f) => read(path.join(out, f))).join('\n');
  assert.ok(!/^> 공통:/m.test(all));
  assert.ok(!fs.existsSync(path.join(out, 'my', 'scripts')));
  assert.ok(!all.includes(PLUGIN), '로컬 경로가 들어감');
  // 양식 안 제목은 그대로 (인계 md의 맨 위 제목)
  assert.match(read(path.join(out, 'my', 'work.md')), /^# 인계 /m);
});

test('웹 패키지: zip을 풀면 my/ 폴더 파일과 같다', () => {
  const out = tmp('my-web-');
  build({ out });
  const files = unzip(fs.readFileSync(path.join(out, 'my-skill.zip')));
  const names = fs.readdirSync(path.join(out, 'my')).map((n) => `my/${n}`).sort();
  assert.deepEqual(Object.keys(files).sort(), names);
  for (const n of names) assert.equal(files[n].toString('utf8'), read(path.join(out, n)));
});

test('웹 패키지: 한 파일 판은 라우터·모든 묶음·현황을 담는다', () => {
  const out = tmp('my-web-');
  build({ out });
  const one = read(path.join(out, 'my-onefile.md'));
  assert.ok(!/^---\nname:/.test(one));
  for (const g of GROUPS) assert.match(one, new RegExp(`^## ${g.title} \\(채팅 모드\\)$`, 'm'));
  assert.match(one, /^## my 플러그인 현황 \(웹\)$/m);
  assert.match(one, /플러그인 개선.*로컬 전용/);
});

test('제목 내리기: 코드 블록 안은 건드리지 않는다', () => {
  const md = '# 제목 (채팅 모드)\n\n> 공통: x\n\n## 할 일\n\n````md\n# 양식\n## 절\n````\n\n### 끝\n';
  const s = section('work-end', md);
  assert.match(s, /^## 제목 — `work-end`$/m);
  assert.match(s, /^### 할 일$/m);
  assert.match(s, /^# 양식$/m);
  assert.match(s, /^## 절$/m);
  assert.match(s, /^#### 끝$/m);
  assert.ok(!s.includes('공통'));
  assert.equal(demote('# a\n```\n# b\n```\n'), '## a\n```\n# b\n```\n');
});

test('zip: 빈 파일과 한글 이름도 담는다', () => {
  const files = unzip(zip([['한글/빈.md', Buffer.alloc(0)], ['a.txt', Buffer.from('가나다')]]));
  assert.equal(files['한글/빈.md'].length, 0);
  assert.equal(files['a.txt'].toString('utf8'), '가나다');
});
