# Gemini CLI에서 my 스킬 사용하기

## 현재 사용 범위

현재 체크아웃에는 Gemini CLI 확장에 필요한 `gemini-extension.json`과 `/my:<스킬>` 명령 파일이 없다. `gemini extensions install`과 자동 키워드 훅은 전용 확장이 추가된 뒤 사용할 수 있다. 지금은 로컬 체크아웃에서 스킬 파일을 지정해 실행할 수 있다. [Gemini CLI 확장 명세](https://geminicli.com/docs/extensions/reference/)

## 로컬 체크아웃으로 실행

[내 포크 만들기](README.md)에 따라 복제한 뒤 PowerShell에서 `gemini --version`, `node --version`을 확인한다. 작업할 프로젝트 루트에서 `gemini`를 실행하고 아래 요청을 입력한다. 아래 예시의 `C:/Users/YOUR_WINDOWS_USER/src/my`를 내 체크아웃의 실제 절대 경로로 바꾼다.

```text
C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills/plugin-status/SKILL.md를 읽고 지시에 따라 my 플러그인 현황을 보여 줘.
```

Gemini CLI가 외부 폴더의 파일을 읽지 못하면 세션에서 `/directory add C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my`로 플러그인 폴더를 추가한 뒤 다시 요청한다. 스킬이 `../../scripts/`와 `../../templates/` 등을 참조하므로 체크아웃 안에서 원래 폴더 구조를 유지한다. [Gemini CLI 세션 명령](https://geminicli.com/docs/cli/commands/)

| 하려는 일 | `plugins/my/skills/` 아래에서 지정할 파일 |
| --- | --- |
| 버전과 키워드 목록 확인 | `plugin-status/SKILL.md` |
| 작업 시작 브리핑 | `work-start/SKILL.md` |
| 작업 요약과 인계 문서 작성 | `work-end/SKILL.md` |
| 최근 인계 문서에서 재개 | `work-resume/SKILL.md` |

현황의 `키워드 훅 미적용` 표시는 이 방식에서 예상되는 결과다. 버전과 키워드 목록만 터미널에서 확인하려면 `node (Join-Path $MyRepo 'plugins/my/scripts/status.mjs')`를 실행한다.

## 작업별 호출 예시

Gemini 대화창에 스킬 파일 경로와 입력값을 함께 적는다. 스킬 파일은 `my` 체크아웃에서 읽고, `./src` 같은 작업 대상은 Gemini CLI를 실행한 프로젝트를 기준으로 지정한다.

| 하려는 일 | Gemini 대화창에 입력 |
| --- | --- |
| 기존 소스 함께 읽기 | `C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills/learn-source/SKILL.md를 읽고, 현재 프로젝트의 ./src를 대상으로 학습을 시작해 줘.` |
| 요구사항과 명세 초안 만들기 | `C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills/project-define/SKILL.md를 읽고, todo 프로젝트의 기능을 정의해 줘. 요구사항은 이어서 설명할게.` |
| 설정 동기화 변경안 보기 | `C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills/sync/SKILL.md를 읽고, 현재 프로젝트에서 gemini->codex 방향으로 동기화할 파일과 diff를 보여 줘.` |
| 플러그인 문제 기록하기 | `C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills/plugin-issue/SKILL.md를 읽고, 현황 출력에 버전이 빠진 문제를 기록해 줘.` |

학습은 같은 세션에서 개요를 본 뒤 질문과 이해도 점검을 이어 간다. 프로젝트 정의나 설정 동기화는 초안 또는 diff를 검토하고 승인 여부를 답한다. 다른 작업도 [키워드 원본](../../plugins/my/scripts/keywords.json)의 `skill` 값에 해당하는 `SKILL.md`를 같은 방식으로 지정할 수 있다. [Claude Code](claude-code.md) · [Codex](codex.md)

## 업데이트

로컬 체크아웃을 원하는 버전으로 갱신한 뒤 새 세션에서 같은 경로의 스킬 파일을 읽는다. `plugin-status`로 버전을 확인한다.
