# OpenCode 데스크탑과 CLI에서 my 스킬 사용하기

OpenCode는 GitHub에서 복제한 `my`의 `SKILL.md`를 스킬로 불러올 수 있다. 현재 `my`에는 OpenCode 전용 플러그인이 없으므로 Claude Code용 설치 명령과 자동 키워드 훅 대신 아래의 스킬 등록 방식을 사용한다. [OpenCode 스킬](https://opencode.ai/docs/skills/) · [OpenCode 플러그인](https://opencode.ai/docs/plugins/)

## 등록

1. PowerShell에서 저장소를 복제한다. `node --version`으로 Node.js를 확인한다. `my` 스킬은 현황 출력이나 인계 문서 작성에 Node.js 스크립트를 사용한다.

   ```powershell
   $MyRepo = Join-Path $env:USERPROFILE 'src/my'
   git clone https://github.com/mykim711231/my.git $MyRepo
   (Join-Path $MyRepo 'plugins/my/skills').Replace('\', '/')
   ```

2. **작업 프로젝트**의 `opencode.json` 또는 `opencode.jsonc`에 앞 단계에서 출력된 스킬 경로를 추가한다. 기존 `skills` 배열이 있으면 그 배열에 경로 한 줄을 추가한다. 이 설정은 데스크탑과 CLI에서 공통으로 사용한다.

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "skills": ["C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills"]
   }
   ```

   사용 중인 OpenCode가 배열 형식을 거부하면 `"skills": {"paths": ["C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills"]}` 형식으로 지정한다. 스크립트와 템플릿을 찾을 수 있도록 체크아웃의 폴더 구조를 유지한다. [OpenCode 설정](https://opencode.ai/docs/config/) · [설정 스키마](https://opencode.ai/config.json)

## 데스크탑에서 실행

OpenCode 데스크탑을 다시 열고 설정한 작업 프로젝트의 새 대화에서 `@plugin-status`를 입력한다.

## CLI에서 실행

PowerShell에서 `opencode --version`으로 CLI를 확인한다. 명령이 없다면 [OpenCode 설치 안내](https://opencode.ai/docs/)에 따라 CLI를 설치한다. 설정한 작업 프로젝트 루트에서 `opencode`를 실행하고 대화형 화면에 `@plugin-status`를 입력한다. [OpenCode CLI](https://opencode.ai/docs/cli/)

## 작업별 호출

`@plugin-status`로 버전과 명령 목록을 확인한다. 설치 버전에서 `@` 호출을 지원하지 않으면 `skill 도구로 plugin-status를 불러오고 그 지시에 따라 my 플러그인 현황을 보여 줘`라고 입력한다. `키워드 훅 미적용`은 이 방식에서 예상되는 결과다.

| 하려는 일 | 대화창 입력 |
| --- | --- |
| 프로젝트 문서와 Git 상태 확인 | `@work-start 현재 프로젝트를 브리핑해 줘` |
| 기존 소스 읽기 | `@learn-source 현재 프로젝트의 ./src를 함께 읽어 줘` |
| 작업 인계 문서 작성 | `@work-end 이번 작업을 요약하고 인계 문서를 작성해 줘` |
| 최근 인계 문서에서 재개 | `@work-resume 현재 프로젝트의 최근 인계 문서로 이어서 작업해 줘` |
| 개선 아이디어 기록 | `@plugin-issue 현황 출력에 버전이 빠진 문제를 기록해 줘` |

다른 기능도 [루트 README의 스킬 이름](../../README.md#플러그인-기능과-호출-방법) 앞에 `@`를 붙여 호출한다. 외부 폴더 접근 요청이 나오면 복제한 `my` 체크아웃 경로인지 확인한다. [OpenCode 권한](https://opencode.ai/docs/permissions/)

## 업데이트와 포크

로컬 체크아웃을 원하는 버전으로 갱신하고 OpenCode를 다시 연다. 자기 포크에서 개선하려면 [포크 및 개선 가이드](README.md)에 따라 복제한 뒤 `skills` 경로와 `plugin_src`를 자기 체크아웃으로 지정한다.
