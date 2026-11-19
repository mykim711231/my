// 마크다운 파일 단위 검사(H-1, H-4): BOM, 줄바꿈, 제목, 링크. learn.mjs와 project.mjs가 함께 쓴다.
import fs from 'node:fs';
import path from 'node:path';

export const stripCode = (text) => text.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
export const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
export const external = (t) => /^[a-z][a-z0-9+.-]*:/i.test(t) && !/^[A-Za-z]:[\\/]/.test(t);

// dir 아래 .md 파일. 점으로 시작하는 폴더와 skip에 든 이름은 건너뛴다.
export function mdFiles(dir, out = [], skip = new Set()) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) mdFiles(p, out, skip);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// 인코딩: BOM, CRLF
export function encodingProblems(raw) {
  const out = [];
  const text = raw.toString('utf8');
  if (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) out.push({ kind: 'BOM', detail: 'UTF-8 BOM을 지운다(앞머리를 읽지 못한다)' });
  if (text.includes('\r\n')) out.push({ kind: '줄바꿈', detail: 'CRLF — LF로 쓴다' });
  return out;
}

export const headingsOf = (text) =>
  [...stripCode(text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '')).matchAll(/^(#{1,6}) (.+)$/gm)].map((m) => ({ level: m[1].length, text: m[2].trim() }));

// 제목: H1 하나, 단계 건너뜀 없음
export function headingProblems(text) {
  const out = [];
  const heads = headingsOf(text).map((h) => h.level);
  const h1 = heads.filter((h) => h === 1).length;
  if (h1 !== 1) out.push({ kind: 'H1 개수', detail: `${h1}개 — 하나만 둔다` });
  for (let i = 1; i < heads.length; i++) if (heads[i] > heads[i - 1] + 1) out.push({ kind: '제목 단계 건너뜀', detail: `${'#'.repeat(heads[i - 1])} 다음 ${'#'.repeat(heads[i])}` });
  return out;
}

// 링크: 절대 경로, 깨진 링크, 다른 파일 제목 링크, 역슬래시
export function linkProblems(file, text) {
  const out = [];
  for (const m of stripCode(text).matchAll(LINK)) {
    const t = m[1];
    if (t.startsWith('#') || (external(t) && !/^file:/i.test(t))) continue;
    if (/^file:|^[A-Za-z]:[\\/]|^[\\/]/.test(t)) {
      out.push({ kind: '절대 경로 링크', detail: t });
      continue;
    }
    const [p, anchor] = t.split('#');
    let target;
    try {
      target = path.resolve(path.dirname(file), decodeURI(p));
    } catch {
      target = path.resolve(path.dirname(file), p);
    }
    if (!fs.existsSync(target)) out.push({ kind: '깨진 링크', detail: t });
    else if (anchor && p.endsWith('.md')) out.push({ kind: '다른 파일 제목 링크', detail: `${t} — 파일로만 링크한다` });
    if (p.includes('\\')) out.push({ kind: '링크 구분자', detail: `${t} — /를 쓴다` });
  }
  return out;
}
