# ChatGPT 데스크탑의 Codex에서 my 플러그인 사용하기

ChatGPT 데스크탑 앱의 **Codex**에서 로컬 프로젝트를 연다. `my`의 스크립트를 실행하려면 PC에 Node.js가 필요하다. PowerShell에서 `node --version`으로 확인한다.

## 설치

1. PowerShell에서 GitHub 마켓플레이스를 등록한다. 여기서 CLI는 마켓플레이스 등록에 사용한다.

   ```powershell
   codex plugin marketplace add mykim711231/my
   codex plugin marketplace list
   ```

2. 앱을 다시 열고 Codex의 **Plugins Directory**에서 `my` 마켓플레이스를 선택한다. `my` 플러그인을 열고 설치한다. CLI를 사용할 수 없거나 앱에 등록한 마켓플레이스가 보이지 않으면, `mykim711231/my`를 로컬에 복제해 Codex에서 그 폴더를 연 뒤 저장소의 `.claude-plugin/marketplace.json`이 로컬 마켓플레이스 출처로 표시되는지 확인한다. [ChatGPT 데스크탑의 로컬 마켓플레이스](https://developers.openai.com/plugins/build/plugins#how-local-marketplaces-work)

## 호출과 업데이트

- 작업할 프로젝트에서 새 Codex 대화를 열고 스킬 목록에서 `my:plugin-status`를 선택해 버전을 확인한다. `my:learn-source`를 선택한 뒤 `./src를 함께 읽어 줘`를 덧붙이는 방식으로 다른 스킬도 호출할 수 있다. [전체 명령](../../README.md#플러그인-기능과-호출-방법)
- `마이 …` 키워드를 쓰려면 `my`의 훅을 검토하고 신뢰한다. 훅 검토가 필요한 경우 [Codex CLI 가이드](codex.md#실행과-훅-승인)의 `/hooks` 절차를 사용한다. [Codex 훅](https://learn.chatgpt.com/docs/hooks)
- GitHub 마켓플레이스는 `codex plugin marketplace upgrade my`로 갱신한다. 앱을 다시 열어 플러그인 버전을 확인한다. 로컬 복제본을 사용 중이면 체크아웃을 원하는 버전으로 갱신한다.
