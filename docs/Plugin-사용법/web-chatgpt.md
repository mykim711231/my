# ChatGPT 웹 채팅에서 my 쓰기 (채팅 모드)

웹 채팅에서는 파일을 쓰거나 명령을 실행하지 않는다. 결과는 화면과 md 코드 블록으로 받는다. 쓰는 법과 로컬로 가져오는 법은 [claude.ai 안내](web-claude.md#쓰기)와 같고, 여기서는 올리는 법만 다르다.

## 패키지 만들기

```powershell
git clone https://github.com/mykim711231/my
node my/plugins/my/scripts/pack-web.mjs
```

`my/dist/web/`에 `my-skill.zip`과 `my-onefile.md`가 생긴다.

## 올리기

1. ChatGPT에서 Skills를 열고 Create → Upload를 고른다.
2. `my-skill.zip`을 올린다. zip을 받지 않으면 압축을 풀어 `my/` 폴더의 `SKILL.md`와 나머지 md를 함께 올린다.

[Skills in ChatGPT](https://help.openai.com/articles/20001066-skills-in-chatgpt) · 요금제와 지역에 따라 Skills 메뉴가 없을 수 있다. 업로드 절차는 이 저장소에서 아직 직접 시험하지 않았다(미검증).

Skills를 쓸 수 없으면 `my-onefile.md`를 프로젝트 지침이나 GPT 지침에 붙이거나 대화 첫 메시지에 첨부한다. 지침 글자 수 제한에 걸리면 첨부 파일로 올린다.

## 확인

새 대화에서 `마이 플러그인 현황`을 보낸다. 답 첫 줄이 "채팅 모드 — 파일 쓰기·명령 실행 없음"이고 버전과 키워드 표가 나오면 적용된 것이다.

- 인계 md와 학습 노트 md를 로컬로 가져오는 법: [로컬로 가져오기](web-claude.md#로컬로-가져오기)
- 웹에서 하지 않는 것과 결과 표시: [한계](web-claude.md#한계)

[claude.ai](web-claude.md) · [Gemini](web-gemini.md) · [Codex](codex.md)
