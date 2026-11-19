#!/usr/bin/env node
// 프롬프트 제출 훅: "마이 <등록 양식>"을 스킬 안내로 바꾼다. 인자 `stance`면 세션 시작 태도 규칙을 넣는다.
// 입력(stdin JSON): Claude Code·Codex·Gemini CLI는 `prompt`, Antigravity CLI는 `lastUserInput`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(HERE, '..');
export const MARKER = '[my 키워드 훅]';

export function loadTable(file = path.join(HERE, 'keywords.json')) {
  const t = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { prefix: t.prefix, commands: t.commands.map(compile) };
}

// "프로젝트 {name} 생성" → 정규식. 마지막 단독 인자는 나머지 전체, 그 밖의 인자는 공백 없는 한 단어.
function compile(cmd) {
  const tokens = cmd.form.split(/\s+/);
  const names = [];
  const parts = tokens.map((tok, i) => {
    const last = i === tokens.length - 1;
    if (last && /^\{[^}]+\}$/.test(tok)) {
      names.push(tok.slice(1, -1));
      return '(.+)';
    }
    return tok
      .split(/(\{[^}]+\})/)
      .map((s) => {
        if (/^\{[^}]+\}$/.test(s)) {
          names.push(s.slice(1, -1));
          return '(\\S+?)';
        }
        return s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
      })
      .join('');
  });
  const fixed = tokens.join(' ').replace(/\{[^}]+\}/g, '');
  return {
    ...cmd,
    first: tokens[0],
    names,
    fixedLen: fixed.replace(/\s/g, '').length,
    re: new RegExp('^' + parts.join('\\s+') + '(?=\\s|$)'),
  };
}

// 결과: null(반응 안 함) | {kind:'match', cmd, args} | {kind:'usage', forms}
export function route(text, table) {
  if (typeof text !== 'string') return null;
  const s = text.trim();
  const head = table.prefix + ' ';
  if (!s.startsWith(head)) return null;
  const rest = s.slice(head.length).trimStart();
  const word = rest.split(/\s/)[0];
  const family = table.commands.filter((c) => c.first === word);
  if (family.length === 0) return null;

  const hits = [];
  for (const c of family) {
    const m = c.re.exec(rest);
    if (!m) continue;
    const args = {};
    c.names.forEach((n, i) => (args[n] = m[i + 1].trim()));
    if (Object.values(args).some((v) => v === '')) continue;
    hits.push({ cmd: c, args });
  }
  if (hits.length === 0) return { kind: 'usage', forms: family };
  const best = Math.max(...hits.map((h) => h.cmd.fixedLen));
  const top = hits.filter((h) => h.cmd.fixedLen === best);
  if (top.length > 1) return { kind: 'usage', forms: top.map((h) => h.cmd) };
  return { kind: 'match', ...top[0] };
}

export function message(result, table, root = PLUGIN_ROOT) {
  const p = table.prefix;
  if (result.kind === 'usage') {
    const lines = result.forms.map((c) => `- \`${p} ${c.form}\` → \`${c.skill}\``);
    return [
      `${MARKER} 등록된 양식과 정확히 맞지 않는다(필수 인자 누락이거나 양식이 여럿 맞음).`,
      '아무 작업도 하지 말고 아래 사용법만 사용자에게 보여 줘라.',
      ...lines,
    ].join('\n');
  }
  const { cmd, args } = result;
  const exists = fs.existsSync(path.join(root, 'skills', cmd.skill, 'SKILL.md'));
  if (!exists) {
    return `${MARKER} \`${p} ${cmd.form}\` → \`${cmd.skill}\` 스킬은 아직 구현되지 않았다. 사용자에게 그렇게 알리고 다른 작업은 하지 마라.`;
  }
  const argText = Object.keys(args).length
    ? ' 인자: ' + Object.entries(args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')
    : '';
  return `${MARKER} \`${p} ${cmd.form}\` → my 플러그인의 \`${cmd.skill}\` 스킬을 사용하라.${argText}`;
}

// 도구별 출력 형식. Antigravity CLI는 lastUserInput이 있는 입력으로 구분한다.
export function respond(input, table, root = PLUGIN_ROOT) {
  const antigravity = input && Object.prototype.hasOwnProperty.call(input, 'lastUserInput');
  if (antigravity && input.invocationNum !== 0) return null;
  const r = route(antigravity ? input.lastUserInput : input?.prompt, table);
  if (!r) return null;
  const text = message(r, table, root);
  if (antigravity) return { injectSteps: [{ systemMessage: { systemMessage: text } }] };
  return {
    hookSpecificOutput: {
      hookEventName: input.hook_event_name || 'UserPromptSubmit',
      additionalContext: text,
    },
  };
}

// Antigravity CLI의 훅 설정은 `stance agy`로 부른다(입력 형태로 구분하지 않는다).
export function stance(input, format, root = PLUGIN_ROOT) {
  const text = fs.readFileSync(path.join(root, 'hooks', 'critical-stance.md'), 'utf8');
  if (format === 'agy') return { injectSteps: [{ systemMessage: { systemMessage: text } }] };
  return {
    hookSpecificOutput: { hookEventName: input?.hook_event_name || 'SessionStart', additionalContext: text },
  };
}

function readStdin() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = readStdin();
    const out = process.argv[2] === 'stance' ? stance(input, process.argv[3]) : respond(input, loadTable());
    if (out) process.stdout.write(JSON.stringify(out));
  } catch (e) {
    // 훅 실패로 사용자의 입력을 막지 않는다.
    process.stderr.write(`my keyword hook: ${e.message}\n`);
  }
  process.exit(0);
}
