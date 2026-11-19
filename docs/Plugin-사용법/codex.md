# Codex CLI에서 my 사용하기

Codex 전용 매니페스트는 아직 없다. Codex가 저장소의 Claude Code 형식 마켓플레이스와 매니페스트를 호환 경로로 읽는다. [Codex 플러그인 패키징](https://developers.openai.com/plugins/build/plugins) · [저장소의 Codex 호환 실험](../plan.md)

- 필요한 것: Codex CLI, Node.js. PowerShell에서 `codex --version`, `node --version`으로 확인한다. `codex`가 검색되지 않으면 실행 파일의 전체 경로를 쓴다.
- `마이` 키워드: `/hooks`에서 훅을 승인한 뒤 자동

## 설치

```powershell
codex plugin marketplace add mykim711231/my
codex plugin marketplace list
codex plugin add my@my
```

이미 `my` 마켓플레이스가 있다면 목록에서 등록된 출처를 확인한다. `codex plugin --help`에 `add`가 없으면 대화형 Codex의 `/plugins`에서 `my` 마켓플레이스의 `my`를 설치한다.

## 설치 확인

1. 작업할 프로젝트에서 새 Codex 세션을 연다.
2. `/hooks`를 열어 `my`의 `SessionStart`와 `UserPromptSubmit` 명령을 검토하고 신뢰한다. 앞의 훅은 세션 시작 규칙을, 뒤의 훅은 `마이 …` 키워드 안내를 준다. [Codex 훅](https://learn.chatgpt.com/docs/hooks)
3. `$` 선택 목록(또는 `/skills`)에서 `my:plugin-status`를 골라 버전과 키워드 목록이 나오는지 본다.
4. `마이 플러그인 현황`을 입력해 키워드 호출도 되는지 본다.

`키워드 훅 미적용`이 표시되면 `/hooks`의 신뢰 상태와, Codex를 시작한 환경에서 `node`가 실행되는지 확인한다. 그동안은 스킬 목록에서 직접 골라 쓸 수 있다.

## 작업별 호출

입력창에서 `$`를 입력해 스킬을 고르고, 같은 메시지에 요청을 덧붙여 보낸다. 훅이 동작하면 오른쪽 키워드도 쓸 수 있다. [Codex 스킬](https://learn.chatgpt.com/docs/build-skills)

| 하려는 일 | 고를 스킬과 덧붙일 요청 | `마이` 키워드 |
| --- | --- | --- |
| 프로젝트 문서와 Git 상태 브리핑 | `my:work-start` 현재 프로젝트를 브리핑해 줘. | `마이 작업 시작` |
| 작업 요약과 인계 문서 작성 | `my:work-end` 이번 변경을 요약하고 인계 문서를 작성해 줘. | `마이 작업 종료` |
| 최근 인계 문서에서 재개 | `my:work-resume` 최근 인계 문서로 이어서 작업해 줘. | `마이 작업 이어서` |
| 기존 소스 함께 읽기 | `my:learn-source` `./src`의 진입점과 핵심 흐름을 함께 읽어 줘. | `마이 기존 소스 학습 ./src` |
| 요구사항과 명세 초안 만들기 | `my:project-define` `todo` 프로젝트의 기능을 정의해 줘. | `마이 프로젝트 todo 정의` |
| 설정 동기화 변경안 보기 | `my:sync` `codex->claude` 방향 변경안을 보여 줘. | `마이 설정 동기화 codex->claude` |
| 플러그인 문제 기록하기 | `my:plugin-issue` 현황 출력에 버전이 빠진 문제를 기록해 줘. | `마이 플러그인 문제 현황 출력에 버전이 빠짐` |

- 프로젝트 정의나 설정 동기화에서 승인 단계가 나오면 초안이나 diff를 검토하고 답한다.

전체 키워드와 스킬 이름: [루트 README](../../README.md#플러그인-기능과-호출-방법) · [키워드 원본](../../plugins/my/scripts/keywords.json)

## 업데이트

```powershell
codex plugin marketplace upgrade my
```

로컬 마켓플레이스를 쓰면 체크아웃을 원하는 버전으로 갱신한다. 새 버전이 반영되지 않으면 `codex plugin add my@my`로 다시 설치한다. 새 세션에서 버전을 확인하고, 훅 재검토가 표시되면 `/hooks`에서 변경 내용을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
