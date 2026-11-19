# OpenCode에서 my 사용하기

OpenCode 데스크탑과 CLI에서 복제한 `my`의 `SKILL.md`를 스킬로 불러온다. OpenCode 전용 플러그인은 아직 없으므로 설치 명령과 키워드 훅 대신 스킬 경로를 등록한다. [OpenCode 스킬](https://opencode.ai/docs/skills/) · [OpenCode 플러그인](https://opencode.ai/docs/plugins/)

- 필요한 것: OpenCode 데스크탑 또는 CLI, Git, Node.js. 스킬이 현황 출력과 인계 문서 작성에 Node.js 스크립트를 쓴다.
- `마이` 키워드: 없음. `@<스킬>`로 부른다.

## 설치

1. PowerShell에서 저장소를 복제하고, 등록할 스킬 경로를 출력한다.

   ```powershell
   $MyRepo = Join-Path $env:USERPROFILE 'src/my'
   git clone https://github.com/mykim711231/my.git $MyRepo
   (Join-Path $MyRepo 'plugins/my/skills').Replace('\', '/')
   ```

2. 출력된 경로를 `opencode.json`(또는 `opencode.jsonc`)의 **`skills.paths`** 배열에 넣는다. 현재 OpenCode는 `skills`를 객체(`{ "paths": [...] }`)로 받는다. 데스크탑과 CLI가 같은 설정을 쓴다.

   **전역 설치 (모든 프로젝트에서 사용)** — 글로벌 config `~/.config/opencode/opencode.json` (Windows: `C:\Users\<사용자>\.config\opencode\opencode.json`):

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "skills": { "paths": ["C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills"] }
   }
   ```

   **프로젝트 설치 (해당 프로젝트에서만)** — 프로젝트 루트의 `opencode.json`/`opencode.jsonc`에 같은 `skills.paths`를 넣는다. 이미 `skills.paths`가 있으면 배열에 경로 한 줄만 더한다.

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "skills": { "paths": ["C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills"] }
   }
   ```

   스크립트와 템플릿을 찾을 수 있도록 체크아웃의 폴더 구조를 유지한다. [OpenCode 설정](https://opencode.ai/docs/config/) · [설정 스키마](https://opencode.ai/config.json)

## 설치 확인

> 설정은 OpenCode 시작 시 한 번 로드된다. config를 저장한 뒤 **OpenCode를 완전히 종료하고 다시 열어야** 반영된다.

- 데스크탑: 앱을 다시 열고 새 대화에서 `@plugin-status`를 입력한다(전역 설치면 어느 프로젝트에서나, 프로젝트 설치면 해당 프로젝트에서).
- CLI: `opencode --version`으로 CLI를 확인한다(없으면 [OpenCode 설치 안내](https://opencode.ai/docs/)). 전역 설치면 아무 프로젝트 루트에서나, 프로젝트 설치면 해당 프로젝트 루트에서 `opencode`를 실행하고 `@plugin-status`를 입력한다. [OpenCode CLI](https://opencode.ai/docs/cli/)

버전과 명령 목록이 나오면 된다. `키워드 훅 미적용`은 이 방식에서 예상되는 결과다. `@` 호출을 지원하지 않는 버전이면 `skill 도구로 plugin-status를 불러오고 그 지시에 따라 my 플러그인 현황을 보여 줘`라고 입력한다.

## 작업별 호출

| 하려는 일 | 대화창 입력 |
| --- | --- |
| 프로젝트 문서와 Git 상태 브리핑 | `@work-start 현재 프로젝트를 브리핑해 줘` |
| 작업 요약과 인계 문서 작성 | `@work-end 이번 작업을 요약하고 인계 문서를 작성해 줘` |
| 최근 인계 문서에서 재개 | `@work-resume 최근 인계 문서로 이어서 작업해 줘` |
| 기존 소스 함께 읽기 | `@learn-source 현재 프로젝트의 ./src를 함께 읽어 줘` |
| 플러그인 문제 기록하기 | `@plugin-issue 현황 출력에 버전이 빠진 문제를 기록해 줘` |

- 다른 기능도 스킬 이름 앞에 `@`를 붙여 부른다.
- 외부 폴더 접근 요청이 나오면 복제한 `my` 체크아웃 경로인지 확인한다. [OpenCode 권한](https://opencode.ai/docs/permissions/)

전체 키워드와 스킬 이름: [루트 README](../../README.md#플러그인-기능과-호출-방법) · [키워드 원본](../../plugins/my/scripts/keywords.json)

## 업데이트

```powershell
git -C $MyRepo pull
```

체크아웃을 원하는 버전으로 갱신하고 OpenCode를 다시 연다. `@plugin-status`로 버전을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
