# ChatGPT 웹에서 my 사용하기 (채팅 모드)

웹 채팅에서는 파일을 쓰거나 명령을 실행하지 않는다. 결과는 화면과 md 코드 블록으로 받는다. 올리는 법만 claude.ai와 다르고, 나머지는 [claude.ai 웹](web-claude.md)과 같다.

- 필요한 것: Skills를 쓸 수 있는 ChatGPT 계정, 웹 패키지를 만들 PC의 Git과 Node.js
- `마이` 키워드: 훅이 없어 모델이 스킬 안의 키워드 표를 보고 고른다.

## 설치

1. 저장소를 복제하고 웹 패키지를 만든다.

   ```powershell
   git clone https://github.com/mykim711231/my
   node my/plugins/my/scripts/pack-web.mjs
   ```

   `my/dist/web/`에 `my-skill.zip`과 `my-onefile.md`가 생긴다.

2. ChatGPT에서 Skills를 열고 Create → Upload를 고른다.
3. `my-skill.zip`을 올린다. zip을 받지 않으면 압축을 풀어 `my/` 폴더의 `SKILL.md`와 나머지 md를 함께 올린다.

Skills를 쓸 수 없으면 `my-onefile.md`를 프로젝트 지침이나 GPT 지침에 붙이거나 대화 첫 메시지에 첨부한다. 지침 글자 수 제한에 걸리면 첨부 파일로 올린다.

[Skills in ChatGPT](https://help.openai.com/articles/20001066-skills-in-chatgpt) · 요금제와 지역에 따라 Skills 메뉴가 없을 수 있다. 업로드 절차는 이 저장소에서 아직 직접 시험하지 않았다(미검증).

## 설치 확인

새 대화에서 `마이 플러그인 현황`을 보낸다. 답 첫 줄이 "채팅 모드 — 파일 쓰기·명령 실행 없음"이고 버전과 키워드 표가 나오면 적용된 것이다.

## 작업별 호출

claude.ai 웹과 같다.

- 입력과 받는 것: [claude.ai 웹의 작업별 호출](web-claude.md#작업별-호출)
- 인계 md와 학습 노트 md를 로컬로 가져오는 법: [로컬로 가져오기](web-claude.md#로컬로-가져오기)
- 웹에서 하지 않는 것과 결과 표시: [한계](web-claude.md#한계)

## 업데이트

체크아웃을 갱신(`git -C my pull`)하고 `pack-web.mjs`로 패키지를 다시 만든 뒤 다시 올린다. 새 대화에서 `마이 플러그인 현황`으로 버전을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
