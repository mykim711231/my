# my 사용 안내

데스크탑과 CLI 설치는 [루트 README](../../README.md#설치하고-시작하기)의 환경별 안내를 따른다. 웹에서 쓸 파일은 아래 절차로 만들고, 직접 수정할 원본은 [포크 설치](#포크-설치) 절차로 준비한다.

## 웹 패키지 만들기

패키지를 만들 PC에 Git과 Node.js가 필요하다. ZIP 생성에 쓰는 `zlib.crc32`는 Node.js 22.2부터 제공되며, 20.x에서는 20.15부터 쓸 수 있다. [Node.js API 문서](https://nodejs.org/api/zlib.html#zlibcrc32data-value)

처음 설치할 때는 저장소를 복제하고 복제한 `my` 폴더로 이동한다. 이미 복제했다면 해당 저장소 루트로 이동한다.

```powershell
git clone https://github.com/mykim711231/my
Set-Location my
```

저장소 루트에서 패키지를 만든다.

```powershell
node plugins/my/scripts/pack-web.mjs
```

| `dist/web/`의 파일 또는 폴더 | 사용할 화면 |
| --- | --- |
| `my-chatgpt-plugin.zip` | [ChatGPT 웹](web-chatgpt.md#설치)의 **새 플러그인** |
| `my-claude-plugin.zip` | [Claude 웹](web-claude.md#설치)의 **플러그인 업로드** |
| `my-skill.zip` | [Claude 웹](web-claude.md#설치)의 **스킬 업로드** |
| `my/` | [Gemini 웹](web-gemini.md#설치)의 **스킬 → 만들기 → 업로드** |
| `my-onefile.md` | 프로젝트·GPT·Gem 지침 또는 대화 첨부 |

## 웹 패키지 업데이트

저장소 루트에서 `git pull --ff-only`로 체크아웃을 갱신한다. 성공하면 `node plugins/my/scripts/pack-web.mjs`를 다시 실행하고, 사용 중인 웹 서비스에서 `dist/web/`의 새 결과물로 교체한다. [ChatGPT 업데이트](web-chatgpt.md#업데이트) · [Claude 업데이트](web-claude.md#업데이트) · [Gemini 업데이트](web-gemini.md#업데이트)

웹의 현황표와 최근 변경은 올린 패키지에 들어 있다. 교체한 뒤 새 대화에서 `마이 플러그인 현황`을 보내 버전과 최근 변경을 확인한다. 같은 버전으로 패키지를 다시 만들었을 때는 최근 변경 내용을 비교해 교체 여부를 확인한다. 대화 첨부로 쓰는 경우 새 대화에 최신 `my-onefile.md`를 첨부한다.

## 포크 설치

GitHub 계정, Git, Node.js가 필요하다. `YOUR_GITHUB_ID`는 내 GitHub 계정명으로 바꾼다.

1. GitHub에서 [원본 저장소](https://github.com/mykim711231/my)를 열고 **Fork**를 눌러 내 계정에 복사한다.
2. PowerShell에서 내 포크를 복제한다. `$MyRepo`는 로컬 체크아웃 경로다. 다른 위치를 쓰려면 첫 줄을 바꾼다.

   ```powershell
   $MyRepo = Join-Path $env:USERPROFILE 'src/my'
   git clone https://github.com/YOUR_GITHUB_ID/my.git $MyRepo
   git -C $MyRepo remote get-url origin
   ```

3. `origin`이 내 포크를 가리키는지 확인한 뒤, 쓰는 도구에서 포크를 가리키게 한다.

| 도구 | 바꿀 곳 |
| --- | --- |
| [Claude Code CLI](claude-code.md#설치) · [Claude 데스크탑](claude-desktop.md#설치) | 마켓플레이스 등록의 `mykim711231/my`를 `$MyRepo`(로컬) 또는 `YOUR_GITHUB_ID/my`(푸시한 포크)로 |
| [Codex CLI](codex.md#설치) · [ChatGPT 데스크탑](chatgpt-desktop.md#설치) | 위와 같음 |
| [OpenCode](opencode-desktop.md#설치) | `opencode.json`의 `skills` 경로를 `$MyRepo`의 `plugins/my/skills`로 |
| [Gemini CLI](gemini-cli.md#설치) | 요청에 적는 `SKILL.md` 경로를 `$MyRepo` 아래로 |
| 웹 채팅 ([ChatGPT](web-chatgpt.md#설치) · [Gemini](web-gemini.md#설치) · [claude.ai](web-claude.md#설치)) | `$MyRepo`에서 `pack-web.mjs`를 실행하고 사용 환경에 맞는 생성물을 올림 |

기존 `my` 등록과 출처가 다르면 전환할 때 기존 마켓플레이스 등록을 먼저 제거한다.

## 내 포크에서 개선하기

1. `plugin-config` 스킬에서 원본 경로(`plugin_src`)를 내 체크아웃의 절대 경로로 저장한다. PowerShell에서 임시로 지정하려면 도구를 실행하기 전에 `$env:MY_PLUGIN_SRC = $MyRepo`를 입력한다. 이 환경 변수가 저장된 설정보다 우선한다.
2. `plugin-issue` 스킬로 불편한 점이나 개선 아이디어를 기록한다. 같은 도구에서 `plugin-apply` 스킬을 열고 대기 목록의 고칠 원본이 내 체크아웃의 `plugins/my`인지 확인한다.
3. 반영할 항목을 고르고 수정안과 diff를 검토해 승인한다. 스킬은 내 체크아웃에 적용하고, 검증을 통과하면 버전을 올린 뒤 커밋 여부를 묻는다. 구조 검증에는 Claude Code의 `plugin-dev` 또는 `claude plugin validate`가 필요하므로, 다른 도구에서 개선할 때도 Claude Code를 준비한다.
4. 각 안내서의 업데이트 절차로 변경을 반영한다. GitHub에서 내 포크를 설치했다면 검증한 커밋을 포크에 푸시하고 마켓플레이스를 갱신한다. 원본에도 공유하려면 포크에서 PR을 연다.

`plugin-apply`와 `plugin-eval`은 웹 채팅에서 하지 않는다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [변경 이력](../../plugins/my/CHANGELOG.md)
