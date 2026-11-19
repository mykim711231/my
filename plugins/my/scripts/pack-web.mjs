#!/usr/bin/env node
// 웹 채팅 패키지(plan 2-1-6): 각 스킬의 chat.md와 keywords.json으로 라우터 스킬 하나와 한 파일 판을 만든다.
// 사용: node pack-web.mjs [--out 폴더]   (기본: 저장소의 dist/web)
//   만드는 것: my/(SKILL.md, work.md, learn.md, project.md, sync.md, plugin.md, status.md), my-skill.zip, my-onefile.md
//   스크립트·훅은 넣지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN = path.resolve(HERE, '..');
const REPO = path.resolve(PLUGIN, '..', '..');
const ISSUE_URL = 'https://github.com/mykim711231/my/issues/new';

export const GROUPS = [
  { file: 'work.md', title: '작업', match: (s) => s.startsWith('work-') },
  { file: 'learn.md', title: '학습', match: (s) => s.startsWith('learn-') },
  { file: 'project.md', title: '프로젝트', match: (s) => s.startsWith('project-') },
  { file: 'sync.md', title: '설정 동기화', match: (s) => s === 'sync' },
  { file: 'plugin.md', title: '플러그인', match: (s) => s.startsWith('plugin-') },
];
const LOCAL_ONLY = new Set(['plugin-apply', 'plugin-eval']);

const read = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const groupOf = (skill) => GROUPS.find((g) => g.match(skill));

// 코드 블록(``` 또는 ~~~) 밖의 줄에만 fn을 적용한다. 블록 안의 양식 제목은 그대로 둔다.
export function outsideFences(text, fn) {
  let fence = null;
  return text
    .split('\n')
    .map((l) => {
      const m = /^\s*(`{3,}|~{3,})/.exec(l);
      if (m) {
        if (!fence) fence = m[1];
        else if (m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
        return l;
      }
      return fence ? l : fn(l);
    })
    .join('\n');
}

export const demote = (text) => outsideFences(text, (l) => (/^#{1,5} /.test(l) ? `#${l}` : l));

// chat.md → 묶음 파일의 한 절: 공통 줄을 빼고 제목을 한 단계 내린다.
export function section(skill, text) {
  const body = text.split('\n').filter((l) => !/^> 공통:/.test(l)).join('\n');
  let title = false;
  const out = outsideFences(body, (l) => {
    if (!title && /^# /.test(l)) {
      title = true;
      return `## ${l.slice(2).replace(/\s*\(채팅 모드\)\s*$/, '')} — \`${skill}\``;
    }
    return /^#{2,5} /.test(l) ? `#${l}` : l;
  });
  return out.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function sources(root = PLUGIN) {
  const keywords = JSON.parse(read(path.join(root, 'scripts', 'keywords.json')));
  const skills = fs
    .readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const missing = skills.filter((s) => !fs.existsSync(path.join(root, 'skills', s, 'chat.md')));
  if (missing.length) throw new Error(`chat.md가 없는 스킬: ${missing.join(', ')}`);
  const unmapped = keywords.commands.filter((c) => !groupOf(c.skill)).map((c) => c.skill);
  if (unmapped.length) throw new Error(`묶음이 없는 스킬: ${unmapped.join(', ')}`);
  const version = JSON.parse(read(path.join(root, '.claude-plugin', 'plugin.json'))).version;
  // 묶음 안 순서는 키워드 표 순서. 표에 없는 스킬은 뒤에 이름순으로.
  const rank = (s) => {
    const i = keywords.commands.findIndex((c) => c.skill === s);
    return i < 0 ? Infinity : i;
  };
  skills.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return { keywords, skills, version };
}

function statusText(root, { keywords, version }) {
  const lines = [`# my 플러그인 현황 (웹)`, '', `- 버전: ${version}`, '- 키워드 훅: 미적용(웹). 모델이 키워드 표를 보고 고른다', '', '| 입력 | 스킬 | 웹 |', '|---|---|---|'];
  for (const c of keywords.commands) lines.push(`| \`${keywords.prefix} ${c.form}\` | \`${c.skill}\` | ${LOCAL_ONLY.has(c.skill) ? '로컬 전용' : '채팅 모드'} |`);
  const log = read(path.join(root, 'CHANGELOG.md'));
  const recent = log.split(/^## /m).slice(1, 4).map((b) => {
    const [head, ...body] = b.trim().split('\n');
    return `- ${head.trim()}: ${body.filter((l) => l.startsWith('- ')).map((l) => l.slice(2)).join(' / ')}`;
  });
  lines.push('', '## 최근 변경', '', ...recent, '', `문제는 \`마이 플러그인 문제 <내용>\` 또는 ${ISSUE_URL}`);
  return lines.join('\n') + '\n';
}

function routerBody(root, { keywords, version }, onefile) {
  const stance = read(path.join(root, 'hooks', 'critical-stance.md')).replace(/^# .*\n+/, '');
  const where = (g) => (onefile ? `아래 "${g.title}" 장` : `\`${g.file}\``);
  const rows = keywords.commands.map((c) => `| \`${keywords.prefix} ${c.form}\` | \`${c.skill}\` | ${where(groupOf(c.skill))} |`);
  return [
    `# my (채팅 모드, ${version})`,
    '',
    `"${keywords.prefix} "로 시작하는 메시지를 아래 표의 양식과 비교해 맞는 스킬의 지침을 ${onefile ? '찾아' : '그 파일에서 읽어'} 따른다. \`{…}\`는 사용자가 넣는 값이다. 맞는 양식이 없으면 일반 대화로 답한다.`,
    '',
    '| 입력 | 스킬 | 지침 |',
    '|---|---|---|',
    ...rows,
    '',
    read(path.join(root, 'templates', 'web', 'common.md')).trim(),
    '',
    '## 태도 규칙',
    '',
    stance.trim(),
    '',
    `\`${keywords.prefix} 플러그인 현황\`은 ${onefile ? '아래 "my 플러그인 현황 (웹)" 장' : '`status.md`'}을 그대로 보여 준다.`,
    '',
  ].join('\n');
}

export function build({ root = PLUGIN, out = path.join(REPO, 'dist', 'web') } = {}) {
  const src = sources(root);
  const desc = `my 플러그인의 웹 채팅 판. "${src.keywords.prefix} 작업 종료", "${src.keywords.prefix} 수업 학습"처럼 "${src.keywords.prefix} "로 시작하는 메시지에 쓴다. 파일을 쓰거나 명령을 실행하지 않고 결과를 화면과 md로 준다.`;
  const files = new Map();
  files.set('SKILL.md', `---\nname: my\ndescription: ${desc}\n---\n\n${routerBody(root, src, false)}`);
  const groups = GROUPS.map((g) => {
    const parts = src.skills.filter(g.match).map((s) => section(s, read(path.join(root, 'skills', s, 'chat.md'))));
    return { g, text: `# ${g.title} (채팅 모드)\n\n${parts.join('\n')}` };
  });
  for (const { g, text } of groups) files.set(g.file, text);
  const status = statusText(root, src);
  files.set('status.md', status);

  fs.rmSync(out, { recursive: true, force: true });
  const dir = path.join(out, 'my');
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of files) fs.writeFileSync(path.join(dir, name), text);
  fs.writeFileSync(path.join(out, 'my-skill.zip'), zip([...files].map(([n, t]) => [`my/${n}`, Buffer.from(t)])));
  const one = [routerBody(root, src, true), ...groups.map((x) => demote(x.text)), demote(status)].join('\n');
  fs.writeFileSync(path.join(out, 'my-onefile.md'), one);
  return { out: out.replace(/\\/g, '/'), files: [...files.keys()].map((n) => `my/${n}`).concat('my-skill.zip', 'my-onefile.md'), version: src.version };
}

// 최소 zip 쓰기(deflate). 외부 패키지를 쓰지 않는다.
export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const n = Buffer.from(name, 'utf8');
    const body = zlib.deflateRawSync(data);
    const crc = zlib.crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6); // UTF-8 이름
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(0x00210000, 10); // 1980-01-01 00:00 (재현 가능하게 고정)
    head.writeUInt32LE(crc >>> 0, 14);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    head.copy(cen, 8, 6, 26); // 플래그~크기
    cen.writeUInt16LE(n.length, 28);
    cen.writeUInt32LE(offset, 42);
    locals.push(head, n, body);
    centrals.push(cen, n);
    offset += head.length + n.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argv = process.argv.slice(2);
    const i = argv.indexOf('--out');
    const r = build(i >= 0 ? { out: path.resolve(argv[i + 1]) } : {});
    console.log(`웹 패키지 ${r.version}: ${r.out}`);
    for (const f of r.files) console.log(`- ${f}`);
  } catch (e) {
    process.stderr.write(`패키지 오류: ${e.message}\n`);
    process.exit(2);
  }
}
