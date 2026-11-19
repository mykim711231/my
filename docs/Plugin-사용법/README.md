# 포크해서 my 개선하기

처음 쓴다면 [루트 README](../../README.md#설치하고-시작하기)에서 쓰는 곳의 안내서를 따른다. 자기 작업 방식에 맞게 스킬이나 훅을 고치려면 아래 절차로 포크를 준비한다.

- 필요한 것: GitHub 계정, Git, Node.js
- 아래 `YOUR_GITHUB_ID`는 내 GitHub 계정명으로 바꾼다.

## 포크 설치

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
