# Gemini 웹에서 my 사용하기 (채팅 모드)

웹 채팅에서 작업 결과는 화면과 Markdown으로 받는다. 채팅 모드에서 할 수 있는 작업은 [claude.ai 웹](web-claude.md)과 같다.

- 필요한 것: Gemini 계정, 웹 패키지를 만들 PC의 Git과 Node.js
- `마이` 키워드: 훅이 없어 모델이 스킬 안의 키워드 표를 보고 고른다.

## 설치

1. 저장소를 복제하고 웹 패키지를 만든다.

   ```powershell
   git clone https://github.com/mykim711231/my
   node my/plugins/my/scripts/pack-web.mjs
   ```

   `my/dist/web/my/`에 `SKILL.md`와 키워드별 안내·현황 Markdown 파일이 생긴다.

2. Gemini 웹에서 **스킬 → 만들기 → 업로드**를 열고 `my/dist/web/my/` 폴더를 통째로 선택한다. `SKILL.md`가 같은 폴더의 안내와 현황 파일을 참조한다. [Gemini 스킬 업로드 도움말](https://support.google.com/gemini/answer/17094296?hl=ko)
3. 업로드한 지침과 첨부 파일을 확인한 뒤 스킬을 만든다.

스킬 업로드 메뉴를 쓸 수 없으면 `my/dist/web/my-onefile.md`의 내용을 Gem 지침에 붙이거나 대화 첫 메시지에 파일을 첨부해 그 지침을 따라 달라고 요청한다.

## 설치 확인

새 대화에서 `마이 플러그인 현황`을 보낸다. 자동으로 적용되지 않으면 입력창의 `/` 또는 `@` 목록에서 **my** 스킬을 선택한 뒤 보낸다. [Gemini 스킬 사용 도움말](https://support.google.com/gemini/answer/17094296?hl=ko)

Gemini 웹에서 업로드 메뉴가 표시되고 현황 응답에 `my 플러그인 현황 (웹)`, 버전 0.11.0과 키워드 표가 나오는 것을 확인했다. 표에서 `마이 플러그인 개선`과 `마이 플러그인 평가`는 로컬 전용으로 표시된다.

## 작업별 호출

claude.ai 웹과 같다.

- 입력과 받는 것: [claude.ai 웹의 작업별 호출](web-claude.md#작업별-호출)
- 인계 md와 학습 노트 md를 로컬로 가져오는 법: [로컬로 가져오기](web-claude.md#로컬로-가져오기)
- 웹에서 하지 않는 것과 결과 표시: [한계](web-claude.md#한계)

## 업데이트

체크아웃을 갱신(`git -C my pull`)하고 `pack-web.mjs`로 패키지를 다시 만든다. 스킬의 **스킬 교체(Replace skill)**에서 새 `my/` 폴더를 올리거나 사용 중인 지침의 `my-onefile.md` 내용을 갱신한다. 새 대화에서 현황 명령으로 버전을 확인한다. [Gemini 스킬 수정 도움말](https://support.google.com/gemini/answer/17094296?hl=ko)

현황의 **최근 변경**은 패키지 생성 시 들어간 `status.md`를 읽는다. 버전이 같아도 이력이 달라질 수 있으므로, 교체한 뒤에는 새 대화에서 최근 변경 내용도 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
