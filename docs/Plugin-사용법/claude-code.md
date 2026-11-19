# Claude Code에서 my 플러그인 사용하기

## 설치

Claude Code와 Node.js가 설치되어 있어야 한다. PowerShell에서 `claude --version`, `node --version`으로 확인한다.

PowerShell에서 GitHub의 `mykim711231/my`를 마켓플레이스로 등록한다.

```powershell
claude plugin marketplace add mykim711231/my
claude plugin install my@my
claude plugin list
```

`my@my`의 앞쪽은 플러그인 이름, 뒤쪽은 마켓플레이스 이름이다. 이미 `my`가 등록되어 있다면 `claude plugin marketplace list`로 출처를 확인한다. 직접 수정한 버전을 사용하려면 [포크 및 개선 가이드](README.md)를 따른다. [Claude Code 플러그인 마켓플레이스](https://code.claude.com/docs/en/discover-plugins)

## 실행

작업할 프로젝트에서 새 Claude Code 세션을 열고 `마이 플러그인 현황`을 입력한다. 버전과 전체 키워드 목록이 표시된다.

| 하려는 일 | 입력 |
| --- | --- |
| 프로젝트 문서와 Git 상태 브리핑 | `마이 작업 시작` 또는 `/my:work-start` |
| 작업 요약과 인계 문서 작성 | `마이 작업 종료` |
| 직전 인계 문서에서 작업 재개 | `마이 작업 이어서` |
| 프로젝트 설정 동기화 | `마이 설정 동기화 claude->codex` |

`키워드 훅 미적용`이 표시되면 `/my:plugin-status`로 스킬을 직접 실행해 보고, `claude plugin list`에서 `my@my`가 활성화되어 있는지와 Claude Code를 시작한 셸에서 `node`가 실행되는지 확인한다. [Claude Code 스킬](https://code.claude.com/docs/en/skills)

## 작업별 호출 예시

아래 입력은 Claude Code 대화창에 보낸다. 왼쪽은 한국어 키워드 호출이고 오른쪽은 같은 스킬을 직접 여는 슬래시 호출이다. 슬래시 명령 뒤에는 대상 경로나 요구사항을 이어서 적을 수 있다.

| 하려는 일 | `마이` 키워드 | 슬래시 명령 |
| --- | --- | --- |
| 기존 소스 함께 읽기 | `마이 기존 소스 학습 ./src` | `/my:learn-source ./src` |
| 요구사항과 명세 초안 만들기 | `마이 프로젝트 todo 정의` | `/my:project-define todo` |
| 승인된 명세 구현하기 | `마이 프로젝트 todo 구현` | `/my:project-build todo` |
| 설정 동기화 변경안 보기 | `마이 설정 동기화 claude->codex` | `/my:sync claude->codex` |
| 플러그인 문제 기록하기 | `마이 플러그인 문제 현황 출력에 버전이 빠짐` | `/my:plugin-issue 현황 출력에 버전이 빠짐` |

키워드 훅이 적용된 세션에서 `마이 학습`이나 `마이 프로젝트`만 입력하면 해당 명령의 입력 양식을 볼 수 있다. 명령을 실행하지 않고 이름만 말하려면 맨 앞에 `\`를 붙인다(`\마이 작업 종료는 언제 쓰나?`). 프로젝트 정의는 요구사항을 알려 주고 명세·계약 초안을 확인한 뒤 승인한다. 설정 동기화는 파일 목록과 diff를 확인한 뒤 승인한다.

전체 키워드와 스킬 이름은 `마이 플러그인 현황` 또는 [키워드 원본](../../plugins/my/scripts/keywords.json)에서 확인한다. [Codex](codex.md) · [Gemini CLI](gemini-cli.md)

## 업데이트

GitHub 마켓플레이스는 `claude plugin marketplace update my`로 갱신한다. 로컬 마켓플레이스는 체크아웃을 원하는 버전으로 갱신한다. 이어서 `claude plugin update my@my`를 실행하고 새 세션에서 `마이 플러그인 현황`으로 버전을 확인한다.
