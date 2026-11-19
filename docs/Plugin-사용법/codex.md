# Codex에서 my 플러그인 사용하기

## 설치

현재 `my`는 저장소의 Claude Code 형식 마켓플레이스와 플러그인 매니페스트를 Codex의 호환 경로로 읽는다. PowerShell에서 `codex --version`과 `node --version`으로 CLI와 Node.js를 확인한다. `codex` 명령이 검색되지 않으면 설치된 Codex CLI 실행 파일의 전체 경로를 사용한다.

```powershell
codex plugin marketplace add mykim711231/my
codex plugin marketplace list
codex plugin add my@my
```

이미 `my` 마켓플레이스가 있다면 목록에서 등록된 출처를 확인한다. 사용 중인 CLI의 `codex plugin --help`에 `add`가 없으면 대화형 Codex의 `/plugins`에서 `my` 마켓플레이스의 `my`를 설치한다. 직접 수정한 버전을 사용하려면 [포크 및 개선 가이드](README.md)를 따른다. [Codex 플러그인 패키징](https://developers.openai.com/plugins/build/plugins)

## 실행과 훅 승인

1. 작업할 프로젝트에서 새 Codex 세션을 연다.
2. CLI에서 `/hooks`를 열어 `my`의 `SessionStart`와 `UserPromptSubmit` 명령을 검토하고 신뢰한다. 앞의 훅은 세션 시작 규칙을, 뒤의 훅은 `마이 …` 키워드 안내를 제공한다.
3. `/skills` 또는 `$` 선택 목록에서 `my:plugin-status`를 선택해 버전과 키워드 목록을 확인한다. 이어서 `마이 플러그인 현황`을 입력해 키워드 호출을 확인한다.

`키워드 훅 미적용`이 표시되면 스킬 선택 목록에서 `my:work-start`나 `my:work-resume`을 직접 선택할 수 있다. 훅을 사용하려면 `/hooks`의 신뢰 상태와 Codex를 시작한 환경에서 `node`가 실행되는지 확인한다. [Codex 훅](https://learn.chatgpt.com/docs/hooks) · [저장소의 Codex 호환 실험](../plan.md)

## 작업별 호출 예시

대화 입력창에서 `$`를 입력하고 목록에서 스킬을 선택한 뒤, 같은 메시지에 아래 요청을 덧붙여 보낸다. `/skills`가 있는 CLI에서는 그 목록에서도 스킬을 찾을 수 있다. 키워드 훅이 정상 동작한다면 오른쪽의 한국어 입력도 사용할 수 있다. [Codex 스킬](https://learn.chatgpt.com/docs/build-skills)

| 선택할 스킬 | 스킬 선택 후 덧붙일 요청 | 키워드 입력 |
| --- | --- | --- |
| `my:work-start` | 현재 프로젝트의 문서와 Git 상태를 브리핑해 줘. | `마이 작업 시작` |
| `my:work-end` | 이번 변경을 요약하고 인계 문서를 작성해 줘. | `마이 작업 종료` |
| `my:learn-source` | `./src`의 진입점과 핵심 흐름을 함께 읽어 줘. | `마이 기존 소스 학습 ./src` |
| `my:project-define` | `todo` 프로젝트의 기능을 정의해 줘. 요구사항은 이어서 설명할게. | `마이 프로젝트 todo 정의` |
| `my:sync` | `codex->claude` 방향으로 설정 동기화 변경안을 보여 줘. | `마이 설정 동기화 codex->claude` |
| `my:plugin-issue` | 현황 출력에 버전이 빠진 문제를 기록해 줘. | `마이 플러그인 문제 현황 출력에 버전이 빠짐` |

작업 종료 후 다른 세션에서 계속하려면 같은 프로젝트를 열고 `my:work-resume`을 선택하거나 `마이 작업 이어서`를 입력한다. 프로젝트 정의나 설정 동기화에서 승인 단계가 나오면 대화형 세션에서 초안이나 diff를 검토하고 답한다.

전체 명령은 `my:plugin-status` 또는 [키워드 원본](../../plugins/my/scripts/keywords.json)에서 확인한다. [Claude Code](claude-code.md) · [Gemini CLI](gemini-cli.md)

## 업데이트

GitHub 마켓플레이스는 `codex plugin marketplace upgrade my`로 갱신한다. 로컬 마켓플레이스는 체크아웃을 원하는 버전으로 갱신한다. 새 버전이 반영되지 않으면 `codex plugin add my@my`로 다시 설치한다. 새 세션에서 버전을 확인하고 훅 재검토가 표시되면 `/hooks`에서 변경 내용을 확인한다.
