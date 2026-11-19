# ChatGPT 데스크탑에서 my 사용하기

ChatGPT 데스크탑 앱의 **Codex**에서 로컬 프로젝트를 열어 쓴다. 마켓플레이스 등록에는 Codex CLI를 쓴다. [ChatGPT 데스크탑의 로컬 마켓플레이스](https://developers.openai.com/plugins/build/plugins#how-local-marketplaces-work)

- 필요한 것: ChatGPT 데스크탑 앱, Codex CLI(등록용), Node.js. PowerShell에서 `node --version`으로 확인한다.
- `마이` 키워드: 훅을 승인한 뒤 자동

## 설치

1. PowerShell에서 GitHub 마켓플레이스를 등록한다.

   ```powershell
   codex plugin marketplace add mykim711231/my
   codex plugin marketplace list
   ```

2. 앱을 다시 열고 Codex의 **Plugins Directory**에서 `my` 마켓플레이스를 고른 뒤 `my` 플러그인을 설치한다.

CLI를 쓸 수 없거나 앱에 마켓플레이스가 보이지 않으면, `mykim711231/my`를 로컬에 복제해 Codex에서 그 폴더를 연다. 저장소의 `.claude-plugin/marketplace.json`이 로컬 마켓플레이스 출처로 표시되는지 확인한다.

## 설치 확인

1. 작업할 프로젝트에서 새 Codex 대화를 연다.
2. 스킬 목록에서 `my:plugin-status`를 골라 버전과 키워드 목록이 나오는지 본다.
3. `마이 …` 키워드를 쓰려면 `my`의 훅을 검토하고 신뢰한다. 절차는 [Codex CLI의 설치 확인](codex.md#설치-확인)과 같다. [Codex 훅](https://learn.chatgpt.com/docs/hooks)

## 작업별 호출

Codex CLI와 같다. 스킬을 고르고 요청을 덧붙인다. 전체 표는 [Codex CLI의 작업별 호출](codex.md#작업별-호출)을 본다.

| 하려는 일 | 고를 스킬과 덧붙일 요청 | `마이` 키워드 |
| --- | --- | --- |
| 프로젝트 문서와 Git 상태 브리핑 | `my:work-start` 현재 프로젝트를 브리핑해 줘. | `마이 작업 시작` |
| 기존 소스 함께 읽기 | `my:learn-source` `./src`를 함께 읽어 줘. | `마이 기존 소스 학습 ./src` |
| 작업 요약과 인계 문서 작성 | `my:work-end` 이번 변경을 요약하고 인계 문서를 작성해 줘. | `마이 작업 종료` |

## 업데이트

```powershell
codex plugin marketplace upgrade my
```

로컬 복제본을 쓰면 체크아웃을 원하는 버전으로 갱신한다. 앱을 다시 열어 `my:plugin-status`로 버전을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
