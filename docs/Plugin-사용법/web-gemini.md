# Gemini 웹에서 my 사용하기 (채팅 모드)

웹 채팅에서는 파일을 쓰거나 명령을 실행하지 않는다. 결과는 화면과 md 코드 블록으로 받는다. 올리는 법만 claude.ai와 다르고, 나머지는 [claude.ai 웹](web-claude.md)과 같다.

- 필요한 것: Gemini 계정, 웹 패키지를 만들 PC의 Git과 Node.js
- `마이` 키워드: 훅이 없어 모델이 스킬 안의 키워드 표를 보고 고른다.

## 설치

1. 저장소를 복제하고 웹 패키지를 만든다.

   ```powershell
   git clone https://github.com/mykim711231/my
   node my/plugins/my/scripts/pack-web.mjs
   ```

   `my/dist/web/`에 `my-skill.zip`과 `my-onefile.md`가 생긴다. Gemini에는 대개 한 파일 판 `my-onefile.md`를 쓴다.

2. Gemini 앱의 스킬 업로드는 순차 배포 중이고, Gem은 스킬로 바뀌는 중이다. 계정에서 되는 방법을 위에서부터 고른다.
   - 스킬 업로드가 보이면 `my-onefile.md`를 스킬로 올린다(SKILL.md 한 장만 받는 경우).
   - Gem을 만들 수 있으면 Gem 지침에 `my-onefile.md` 내용을 붙이거나 지식 파일로 첨부한다.
   - 둘 다 없으면 대화마다 첫 메시지에 `my-onefile.md`를 첨부하고 "이 파일의 규칙을 따라 줘"라고 보낸다.

[Gemini skills](https://support.google.com/gemini/answer/18560919) · 메뉴 이름과 제공 범위는 바뀔 수 있다. 세 방법 모두 이 저장소에서 아직 직접 시험하지 않았다(미검증).

## 설치 확인

`마이 플러그인 현황`을 보낸다. 답 첫 줄이 "채팅 모드 — 파일 쓰기·명령 실행 없음"이고 버전과 키워드 표가 나오면 적용된 것이다. 첨부 방식은 대화가 길어지면 규칙이 흐려질 수 있으니, 응답이 양식을 벗어나면 파일을 다시 첨부한다.

## 작업별 호출

claude.ai 웹과 같다.

- 입력과 받는 것: [claude.ai 웹의 작업별 호출](web-claude.md#작업별-호출)
- 인계 md와 학습 노트 md를 로컬로 가져오는 법: [로컬로 가져오기](web-claude.md#로컬로-가져오기)
- 웹에서 하지 않는 것과 결과 표시: [한계](web-claude.md#한계)

## 업데이트

체크아웃을 갱신(`git -C my pull`)하고 `pack-web.mjs`로 패키지를 다시 만든 뒤 다시 올리거나 붙인다. 새 대화에서 `마이 플러그인 현황`으로 버전을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
