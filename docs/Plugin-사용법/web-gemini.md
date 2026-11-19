# Gemini 웹에서 my 사용하기 (채팅 모드)

Gemini 웹에 로그인한 뒤 `my` 스킬을 등록한다. 웹에서 작업 결과는 화면과 Markdown으로 받는다.

## 설치

1. [웹 패키지 만들기](README.md#웹-패키지-만들기) 절차로 `dist/web/my/` 폴더를 생성한다.
2. Gemini 웹에서 **맞춤설정 → 스킬 → 만들기 → 업로드**를 열고 `dist/web/my/` 폴더를 통째로 선택한다. `SKILL.md`가 같은 폴더의 안내와 현황 파일을 참조한다. [Gemini 스킬 업로드 도움말](https://support.google.com/gemini/answer/17094296?co=GENIE.Platform%3DDesktop&hl=ko)
3. 업로드한 지침과 첨부 파일을 확인한 뒤 스킬을 만든다.

스킬 업로드 메뉴를 쓸 수 없으면 `dist/web/my-onefile.md`의 내용을 Gem 지침에 붙이거나 대화 첫 메시지에 파일을 첨부해 그 지침을 따라 달라고 요청한다.

## 설치 확인

새 대화에서 `마이 플러그인 현황`을 보낸다. 자동으로 적용되지 않으면 입력창의 `/` 또는 `@` 목록에서 **my** 스킬을 선택한 뒤 보낸다. [Gemini 스킬 사용 도움말](https://support.google.com/gemini/answer/17094296?co=GENIE.Platform%3DDesktop&hl=ko)

Gemini 웹에서 업로드 메뉴가 표시되고 현황 응답에 `my 플러그인 현황 (웹)`, 버전 0.11.0과 키워드 표가 나오는 것을 확인했다. 표에서 `마이 플러그인 개선`과 `마이 플러그인 평가`는 로컬 전용으로 표시된다.

## 작업별 호출

- 입력과 받는 것: [claude.ai 웹의 작업별 호출](web-claude.md#작업별-호출)
- 인계 md와 학습 노트 md를 로컬로 가져오는 법: [로컬로 가져오기](web-claude.md#로컬로-가져오기)
- 웹에서 하지 않는 것과 결과 표시: [한계](web-claude.md#한계)

## 업데이트

1. [웹 패키지 업데이트](README.md#웹-패키지-업데이트) 절차로 `dist/web/my/`를 다시 만든다.
2. 스킬 목록에서 **my**를 열고 **더보기 → 스킬 교체(Replace skill)**를 선택한다. 새 `dist/web/my/` 폴더를 올리고 지침과 참조 파일을 확인한 뒤 저장한다. Gem 지침으로 쓰는 경우 새 `my-onefile.md`로 지침을 교체한다. [Gemini 스킬 수정 도움말](https://support.google.com/gemini/answer/17094296?co=GENIE.Platform%3DDesktop&hl=en)
3. 새 대화에서 [설치 확인](#설치-확인)을 따라 버전과 최근 변경을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
