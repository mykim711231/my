# claude.ai 웹 채팅에서 my 쓰기 (채팅 모드)

웹 채팅에서는 파일을 쓰거나 명령을 실행하지 않는다. 결과는 화면과 md 코드 블록으로 받고, 로컬에 둘 파일은 직접 내려받아 저장한다. 키워드 훅이 없으므로 모델이 스킬 안의 키워드 표를 보고 고른다.

## 패키지 만들기

Node.js가 있는 PC에서 저장소를 복제하고 웹 패키지를 만든다.

```powershell
git clone https://github.com/mykim711231/my
node my/plugins/my/scripts/pack-web.mjs
```

`my/dist/web/`에 `my-skill.zip`(스킬 폴더 `my/`를 묶은 것)과 `my-onefile.md`(한 파일 판)가 생긴다. 플러그인을 업데이트하면 다시 만들어 올린다.

## 올리기

1. claude.ai 설정에서 코드 실행(Code execution and file creation)을 켠다. 꺼져 있으면 스킬을 쓰지 못한다.
2. 설정의 Capabilities → Skills에서 `my-skill.zip`을 업로드하고 켠다.

[Use skills](https://support.claude.com/en/articles/12512180-use-skills) · 메뉴 이름은 바뀔 수 있다. 업로드 절차는 이 저장소에서 아직 직접 시험하지 않았다(미검증).

스킬을 쓸 수 없는 요금제나 환경이면 `my-onefile.md`를 프로젝트 지침(Project instructions)에 붙이거나 대화 첫 메시지에 첨부한다.

## 쓰기

새 대화에서 `마이 플러그인 현황`을 보내 버전과 키워드 표가 나오는지 확인한다. 답 첫 줄이 "채팅 모드 — 파일 쓰기·명령 실행 없음"이면 웹 판이 적용된 것이다.

| 하려는 일 | 입력 | 받는 것 |
| --- | --- | --- |
| 대화를 새 창으로 넘기기 | `마이 작업 종료` | 인계 md와 새 창 첫 메시지 |
| 새 창에서 이어 가기 | 인계 md를 첨부하고 `마이 작업 이어서` | 요약과 시작할 항목 |
| 강의자료로 학습 | 자료를 첨부하고 `마이 수업 학습` | 질의응답, 이해도 점검, 노트 md |
| 요구사항 정리 | `마이 프로젝트 todo 정의` | 명세 md 초안 |
| 구현 초안 | 명세를 첨부하고 `마이 프로젝트 todo 구현` | 코드 블록(테스트 미실행) |

`마이 플러그인 개선`과 `마이 플러그인 평가`는 웹에서 하지 않고 로컬 도구로 안내한다. 명령으로 실행하지 않고 이름만 말하려면 맨 앞에 `\`를 붙인다.

## 로컬로 가져오기

- 인계 md: `docs/handoff/<YYYYMMDD-HHMM>.md`로 저장하면 로컬의 `마이 작업 이어서`·`마이 작업 현황`이 읽는다.
- 학습 노트 md(`미정-<이름>.md`): 로컬에서 아래 명령으로 번호를 매겨 학습 폴더에 들인다. 원본 파일은 그대로 둔다.

```powershell
node my/plugins/my/scripts/learn.mjs import 미정-vector-db.md
```

앞머리에 `topic`이 없으면 `--topic <주제>`를 붙인다. 중앙 학습 폴더에 넣으려면 `--central`을 붙인다.

## 한계

- 코드와 다이어그램은 실행·렌더링으로 확인하지 않는다. 결과 끝의 "테스트 미실행", "Mermaid 미검증" 표시를 보고 로컬에서 확인한다.
- `마이 프로젝트 … 검증`과 `마이 적대적 학습`은 같은 대화 안에서 하므로 "분리 검토 아님"이다.
- 설정은 그 대화에서만 쓴다.

[ChatGPT](web-chatgpt.md) · [Gemini](web-gemini.md) · [Claude Code](claude-code.md)
