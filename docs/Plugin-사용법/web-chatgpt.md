# ChatGPT 웹에서 my 사용하기 (채팅 모드)

`my`는 웹에서 대화와 첨부 자료를 바탕으로 작업하며 결과를 화면과 Markdown으로 돌려준다. 플러그인 업로드 권한이 있는 ChatGPT 계정으로 진행한다. [ChatGPT 플러그인 업로드 권한](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt#upload-or-update-a-plugin-zip-file)

## 설치

1. [웹 패키지 만들기](README.md#웹-패키지-만들기) 절차로 `dist/web/my-chatgpt-plugin.zip`을 생성한다.
2. ChatGPT의 **플러그인 → 새 플러그인**에서 이 ZIP을 선택하고 **플러그인 추가**를 누른다.

등록에 쓰는 ZIP에는 `.codex-plugin/plugin.json`과 `skills/my/SKILL.md`가 들어 있다. 매니페스트 경로 또는 `interface` 오류가 표시되면 패키지를 다시 생성하고 `my-chatgpt-plugin.zip`을 선택한다. [플러그인 패키징](https://developers.openai.com/plugins/build/plugins)

ChatGPT의 **Skills → Create → Upload**는 스킬을 직접 등록하는 별도 메뉴다. `my-skill.zip`의 직접 등록은 미검증이다. [Skills in ChatGPT](https://help.openai.com/articles/20001066-skills-in-chatgpt)

업로드 메뉴를 쓸 수 없으면 `dist/web/my-onefile.md`의 내용을 프로젝트 지침이나 GPT 지침에 붙이거나 대화 첫 메시지에 파일을 첨부한다.

## 설치 확인

1. 플러그인으로 설치했다면 새 대화에서 `@`를 입력하고 **my**를 선택한다. `+` 메뉴의 플러그인 목록에서도 선택할 수 있다. [ChatGPT에서 플러그인 사용](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt#use-a-plugin)
2. `마이 플러그인 현황`을 보내고 `my 플러그인 현황 (웹)`, 버전, 키워드 표가 나오는지 확인한다.

`마이 플러그인 현황`만 입력했을 때 ChatGPT의 일반 플러그인 목록이 나오면, **my**를 선택한 상태에서 다시 보낸다.

ChatGPT 웹에서 `my` 0.11.0 등록, 상세 페이지의 스킬 1개 표시, 현황 명령 실행을 확인했다. 스킬이 로드된 채팅에서는 명령만 입력한 경우에도 현황이 표시됐다. 전체 키워드 23개 중 21개가 채팅 모드에 해당하고, `마이 플러그인 개선`과 `마이 플러그인 평가`는 로컬 전용이다.

## 작업별 호출

- 입력과 받는 것: [claude.ai 웹의 작업별 호출](web-claude.md#작업별-호출)
- 인계 md와 학습 노트 md를 로컬로 가져오는 법: [로컬로 가져오기](web-claude.md#로컬로-가져오기)
- 웹에서 하지 않는 것과 결과 표시: [한계](web-claude.md#한계)

## 업데이트

1. [웹 패키지 업데이트](README.md#웹-패키지-업데이트) 절차로 `dist/web/my-chatgpt-plugin.zip`을 다시 만든다.
2. ChatGPT의 **my** 상세 페이지에 **새 버전 업로드**가 표시되면 새 ZIP을 선택한다. 프로젝트나 GPT 지침으로 쓰는 경우 새 `my-onefile.md`로 지침을 교체한다. [ChatGPT 플러그인 업데이트 안내](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt#update-a-manually-uploaded-plugin)
3. 새 대화에서 [설치 확인](#설치-확인)을 따라 버전과 최근 변경을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
