# ChatGPT 웹에서 my 사용하기 (채팅 모드)

웹 채팅에서는 파일을 쓰거나 명령을 실행하지 않는다. 결과는 화면과 md 코드 블록으로 받는다. 채팅 모드에서 할 수 있는 작업은 [claude.ai 웹](web-claude.md)과 같다.

- 필요한 것: 플러그인 또는 스킬을 업로드할 수 있는 ChatGPT 계정, 웹 패키지를 만들 PC의 Git과 Node.js
- `마이` 키워드: 훅이 없어 모델이 스킬 안의 키워드 표를 보고 고른다.

## 설치

1. 저장소를 복제하고 웹 패키지를 만든다.

   ```powershell
   git clone https://github.com/mykim711231/my
   node my/plugins/my/scripts/pack-web.mjs
   ```

   ChatGPT 플러그인 업로드에 사용할 `my/dist/web/my-chatgpt-plugin.zip`이 생긴다.

2. ChatGPT의 **플러그인 → 새 플러그인**에서 `my-chatgpt-plugin.zip`을 선택하고 **플러그인 추가**를 누른다. ZIP 최상위에 `.codex-plugin/plugin.json`과 `skills/my/SKILL.md`가 들어 있다. 매니페스트 경로나 `interface` 오류가 표시되면 1단계에서 ZIP을 다시 만들어 새 파일을 선택한다. [플러그인 패키징](https://developers.openai.com/plugins/build/plugins)

ChatGPT의 **Skills → Create → Upload**는 스킬을 직접 등록하는 별도 메뉴다. `my-skill.zip`의 직접 등록은 미검증이다. [Skills in ChatGPT](https://help.openai.com/articles/20001066-skills-in-chatgpt)

업로드 메뉴를 쓸 수 없으면 `my-onefile.md`를 프로젝트 지침이나 GPT 지침에 붙이거나 대화 첫 메시지에 첨부한다. 지침 글자 수 제한에 걸리면 첨부 파일로 올린다.

ZIP 구조는 자동 테스트로 검증한다. ChatGPT 웹에서 `my` 0.11.0을 등록하고 상세 페이지에 스킬 1개가 표시되는 것을 확인했다.

## 설치 확인

1. 새 ChatGPT 대화의 입력창에 `@`를 입력하고 목록에서 설치한 **my** 플러그인을 선택한다. `+` 메뉴의 플러그인 목록에서도 선택할 수 있다. [ChatGPT에서 플러그인 사용](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt#use-a-plugin)
2. 입력창에 **my**가 선택된 상태에서 `마이 플러그인 현황`을 보내고 `my 플러그인 현황 (웹)`, 버전, 키워드 표가 나오는지 확인한다.

`마이 플러그인 현황`만 입력했을 때 ChatGPT의 일반 플러그인 목록이 나오면, **my**를 선택한 상태에서 다시 보낸다.

ChatGPT 웹에서 이 절차로 0.11.0의 현황 명령을 실행해 버전과 키워드 표가 표시되는 것을 확인했다. 스킬이 로드된 채팅에서는 명령만 입력한 경우에도 현황이 표시됐다. 전체 키워드 23개 중 21개가 채팅 모드에 해당하고, `마이 플러그인 개선`과 `마이 플러그인 평가`는 로컬 전용이다.

## 작업별 호출

claude.ai 웹과 같다.

- 입력과 받는 것: [claude.ai 웹의 작업별 호출](web-claude.md#작업별-호출)
- 인계 md와 학습 노트 md를 로컬로 가져오는 법: [로컬로 가져오기](web-claude.md#로컬로-가져오기)
- 웹에서 하지 않는 것과 결과 표시: [한계](web-claude.md#한계)

## 업데이트

체크아웃을 갱신(`git -C my pull`)하고 `pack-web.mjs`로 `my-chatgpt-plugin.zip`을 다시 만든다. ChatGPT의 **my** 상세 페이지에 **새 버전 업로드**가 표시되면 새 ZIP을 선택한다. [ChatGPT 플러그인 업데이트 안내](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt#update-a-manually-uploaded-plugin)

새 대화에서 [설치 확인](#설치-확인) 절차를 따르고 현황에 표시된 버전과 최근 변경을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
