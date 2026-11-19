# my

`my`는 AI 코딩 도구에서 작업 인계, 코드·논문 학습, 프로젝트 진행, 도구 설정 동기화를 돕는 플러그인입니다. GitHub의 `mykim711231/my`에서 설치할 수 있으며, 자신의 작업 방식에 맞게 개선하려면 자기 계정에 포크하면 됩니다.

## 설치하고 시작하기

쓰는 곳의 가이드를 따라 설치한 뒤, 새 세션에서 "설치 확인" 칸의 입력으로 버전과 전체 키워드가 나오는지 봅니다. "`마이` 키워드" 칸이 자동이 아닌 곳에서는 스킬 이름으로 부르거나 모델이 키워드 표를 보고 고릅니다.

| 사용 환경 | 설치 방식 | 설치 확인 | `마이` 키워드 | 가이드 |
| --- | --- | --- | --- | --- |
| Claude 데스크탑 (Code 탭) | 앱에서 마켓플레이스 추가 후 설치 | `마이 플러그인 현황` | 자동(훅) | [Claude 데스크탑](docs/Plugin-사용법/claude-desktop.md) |
| Claude Code CLI | 마켓플레이스 명령 (아래) | `마이 플러그인 현황` | 자동(훅) | [Claude Code CLI](docs/Plugin-사용법/claude-code.md) |
| ChatGPT 데스크탑 (Codex) | 마켓플레이스 등록 후 앱에서 설치 | `my:plugin-status` | CLI `/hooks` 승인 후 자동 | [ChatGPT 데스크탑](docs/Plugin-사용법/chatgpt-desktop.md) |
| Codex CLI | 마켓플레이스 명령 (아래) | `my:plugin-status` | `/hooks` 승인 후 자동 | [Codex CLI](docs/Plugin-사용법/codex.md) |
| OpenCode 데스크탑·CLI | 저장소 복제 후 `opencode.json`에 스킬 경로 등록 | `@plugin-status` | 없음 | [OpenCode](docs/Plugin-사용법/opencode-desktop.md) |
| Gemini CLI | 저장소 복제 후 `SKILL.md` 경로 지정 | `plugin-status/SKILL.md` 경로로 요청 | 없음 | [Gemini CLI](docs/Plugin-사용법/gemini-cli.md) |
| claude.ai 웹 | `my-claude-plugin.zip`을 플러그인으로 업로드하거나 `my-skill.zip`을 스킬로 업로드 | `마이 플러그인 현황` | 모델이 표로 판단 | [claude.ai](docs/Plugin-사용법/web-claude.md) |
| ChatGPT 웹 | `my-chatgpt-plugin.zip`을 새 플러그인으로 업로드 | 입력창에서 `my`를 선택하고 `마이 플러그인 현황` | 모델이 표로 판단 | [ChatGPT](docs/Plugin-사용법/web-chatgpt.md) |
| Gemini 웹 | `dist/web/my/` 폴더를 스킬로 업로드 | `마이 플러그인 현황` | 모델이 표로 판단 | [Gemini](docs/Plugin-사용법/web-gemini.md) |

### 마켓플레이스 명령

Claude Code CLI:

```powershell
claude plugin marketplace add mykim711231/my
claude plugin install my@my
```

Codex CLI:

```powershell
codex plugin marketplace add mykim711231/my
codex plugin add my@my
```

### 웹 채팅 (채팅 모드)

웹 채팅에서는 결과를 화면과 Markdown으로 받습니다. `마이 작업 종료`로 받은 인계 파일을 새 대화에 첨부하고 `마이 작업 이어서`로 계속할 수 있습니다. 키워드 23개 중 21개를 채팅 모드에서 쓸 수 있습니다. `마이 플러그인 개선`과 `마이 플러그인 평가`는 로컬 전용입니다.

저장소 루트에서 아래 명령으로 `dist/web/`에 웹 패키지를 만듭니다.

```powershell
node plugins/my/scripts/pack-web.mjs
```

| 생성물 | 사용처 |
| --- | --- |
| `my-chatgpt-plugin.zip` | ChatGPT 웹의 **새 플러그인** 화면 |
| `my-claude-plugin.zip` | Claude 웹의 **내 플러그인 → 플러그인 업로드** 화면 |
| `my/` | Gemini 웹의 **스킬 → 만들기 → 업로드** 화면에 폴더째 선택 |
| `my-skill.zip` | Claude 웹의 **Customize → Skills → Upload a skill** 화면 |
| `my-onefile.md` | 프로젝트·Gem 지침 또는 대화 첨부 |

0.11.0에서 ChatGPT 웹과 Claude 웹의 전용 ZIP 등록 및 현황 명령 실행을 확인했습니다. Gemini 웹에서는 스킬 업로드 메뉴와 현황 응답을 확인했습니다.

## 플러그인 기능과 호출 방법

예를 들어 기존 소스를 함께 읽는 `learn-source` 스킬은 다음과 같이 호출합니다.

| 도구 | 입력 예시 |
| --- | --- |
| Claude Code | `마이 기존 소스 학습 ./src` 또는 `/my:learn-source ./src` |
| Codex | `$` 목록에서 `my:learn-source`를 선택하고 `./src를 함께 읽어 줘`를 덧붙입니다. 키워드 훅이 동작하면 `마이 기존 소스 학습 ./src`도 사용할 수 있습니다. |
| Gemini CLI | `<로컬 저장소 절대 경로>/plugins/my/skills/learn-source/SKILL.md를 읽고 현재 프로젝트의 ./src를 함께 읽어 줘`라고 요청합니다. |
| OpenCode | 데스크탑과 CLI에서 `@learn-source 현재 프로젝트의 ./src를 함께 읽어 줘`라고 입력합니다. |

아래 표의 스킬 이름을 바꿔 같은 방식으로 호출할 수 있습니다. `{…}`에는 실제 값을 넣습니다. `[…]`로 표시한 학습 자료나 경로는 호출할 때 함께 적거나 스킬이 물을 때 알려 줍니다.

### 작업과 학습

| 기능 | 키워드 입력 | 스킬 |
| --- | --- | --- |
| 프로젝트 문서와 Git 상태 파악 | `마이 작업 시작` | `work-start` |
| 변경 내용을 요약하고 인계 문서 작성 | `마이 작업 종료` | `work-end` |
| 최근 인계 문서에서 작업 재개 | `마이 작업 이어서` | `work-resume` |
| 할 일, 진행 중, 완료 상태 확인 | `마이 작업 현황` | `work-status` |
| 강의 자료와 실습 코드 학습 | `마이 수업 학습 [자료]` | `learn-class` |
| 논문의 방법, 결과, 한계 검토 | `마이 논문 학습 [PDF 또는 arXiv 링크]` | `learn-paper` |
| 로컬 소스의 구조와 실행 흐름 읽기 | `마이 기존 소스 학습 [경로]` | `learn-source` |
| GitHub 저장소의 README와 코드 읽기 | `마이 깃허브 학습 [URL]` | `learn-github` |
| 주장이나 답변의 전제와 반례 검토 | `마이 적대적 학습 {대상}` | `learn-adversarial` |
| 학습 주제 목록 보기 | `마이 학습 목록` | `learn-manage` |
| 비슷한 학습 노트의 통합안 검토 | `마이 학습 통합 {주제}` | `learn-manage` |
| 학습 노트의 링크와 번호 점검 | `마이 학습 점검` | `learn-manage` |

### 프로젝트와 도구 설정

| 기능 | 키워드 입력 | 스킬 |
| --- | --- | --- |
| 기술 스택을 정하고 프로젝트 뼈대 생성 | `마이 프로젝트 {name} 생성` | `project-create` |
| 요구사항, 기능 명세, 계약 초안 작성 | `마이 프로젝트 {name} 정의` | `project-define` |
| 승인된 기능 명세 구현 | `마이 프로젝트 {name} 구현` | `project-build` |
| 테스트와 요구사항 추적 결과 확인 | `마이 프로젝트 {name} 검증` | `project-verify` |
| 배포 명령을 확인하고 승인 후 실행 | `마이 프로젝트 {name} 배포` | `project-deploy` |
| 도구 간 규칙과 스킬 동기화 | `마이 설정 동기화 {원본}->{대상}` | `sync` |

예를 들어 `마이 프로젝트 todo 정의`로 기능을 정의하고, 명세 승인 뒤 `마이 프로젝트 todo 구현`을 호출합니다. 설정 동기화는 `마이 설정 동기화 claude->codex`처럼 입력합니다. 방향에는 `claude`, `codex`, `gemini` 중 두 도구를 사용합니다.

### 플러그인 관리

| 기능 | 키워드 입력 | 스킬 |
| --- | --- | --- |
| 버전, 명령 목록, 최근 변경 확인 | `마이 플러그인 현황` | `plugin-status` |
| 문제나 개선 아이디어 기록 | `마이 플러그인 문제 {내용}` | `plugin-issue` |
| 기록된 개선 항목의 diff를 검토하고 반영 | `마이 플러그인 개선` | `plugin-apply` |
| 평가 사례, 모델, 비용을 검토하고 승인 후 평가 | `마이 플러그인 평가` | `plugin-eval` |
| 스킬 원본 경로와 학습 저장 위치 확인·변경 | `마이 플러그인 설정` | `plugin-config` |

키워드 훅이 동작하는 세션에서 `마이 학습`이나 `마이 프로젝트`만 입력하면 해당 명령의 입력 양식을 볼 수 있습니다. [키워드 원본](plugins/my/scripts/keywords.json)

명령을 실행하지 않고 이름만 말하려면 맨 앞에 `\`를 붙입니다. 예: `\마이 작업 종료는 언제 쓰나요?` 따옴표나 백틱으로 감싸도(`"마이 작업 종료"는…`) 키워드로 보지 않습니다.

## 내 포크 개선하기

`plugin_src`를 내 포크의 로컬 체크아웃으로 지정합니다. `plugin-issue`로 개선점을 기록하고, `plugin-apply`에서 수정안과 diff를 검토한 뒤 반영합니다. 도구별 업데이트 절차로 변경을 확인하고, 원본에도 공유하고 싶다면 포크에서 PR을 열 수 있습니다. [포크 설정과 개선 절차](docs/Plugin-사용법/README.md#내-포크에서-개선하기)

[변경 이력](plugins/my/CHANGELOG.md) · [설계 문서](docs/plan.md)
