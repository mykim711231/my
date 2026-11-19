# claude.ai 웹에서 my 사용하기 (채팅 모드)

웹 채팅에서는 파일을 쓰거나 명령을 실행하지 않는다. 결과는 화면과 md 코드 블록으로 받고, 로컬에 둘 파일은 직접 내려받아 저장한다.

- 필요한 것: claude.ai 계정(코드 실행 켜짐), 웹 패키지를 만들 PC의 Git과 Node.js
- `마이` 키워드: 훅이 없어 모델이 스킬 안의 키워드 표를 보고 고른다.

## 설치

1. 저장소를 복제하고 웹 패키지를 만든다.

   ```powershell
   git clone https://github.com/mykim711231/my
   node my/plugins/my/scripts/pack-web.mjs
   ```

   `my/dist/web/`에 Claude 플러그인용 `my-claude-plugin.zip`, 스킬용 `my-skill.zip`, 한 파일 판 `my-onefile.md`가 생긴다.

2. claude.ai 설정에서 **Code execution and file creation**(새 설정에서는 **Create and edit files**)을 켠다.
3. 사용 중인 업로드 화면에 맞는 ZIP을 선택한다.
   - **내 플러그인 → 플러그인 업로드**에서는 `my-claude-plugin.zip`을 선택한다. 이 ZIP의 최상위에 `.claude-plugin/plugin.json`과 `skills/my/SKILL.md`가 있다. [Claude 플러그인 도움말](https://support.claude.com/en/articles/13837440-use-plugins-in-claude) · [플러그인 구조](https://code.claude.com/docs/en/plugins-reference#plugin-directory-structure)
   - **Customize → Skills → + → Create skill → Upload a skill**에서는 `my-skill.zip`을 선택하고 목록에 추가된 **my**를 켠다. [Claude 스킬 도움말](https://support.claude.com/en/articles/12512180-use-skills-in-claude)

스킬을 쓸 수 없는 요금제나 환경이면 `my-onefile.md`를 프로젝트 지침(Project instructions)에 붙이거나 대화 첫 메시지에 첨부한다.

플러그인 업로드에서 `.claude-plugin/plugin.json`이 필요하다는 오류가 표시되면 `my-claude-plugin.zip`을 선택한다. ZIP 구조는 자동 테스트로 검증한다. claude.ai에서 업로드 성공과 실행은 미검증이다.

## 설치 확인

새 대화에서 `마이 플러그인 현황`을 보낸다. 플러그인으로 설치한 스킬이 자동으로 적용되지 않으면 입력창의 `/` 또는 `+` 목록에서 **my**의 스킬을 선택해 보낸다. 답에 "채팅 모드 — 파일 쓰기·명령 실행 없음", 버전, 키워드 표가 나오는지 확인한다. [Claude 플러그인 도움말](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)

## 작업별 호출

| 하려는 일 | 입력 | 받는 것 |
| --- | --- | --- |
| 대화를 새 창으로 넘기기 | `마이 작업 종료` | 인계 md와 새 창 첫 메시지 |
| 새 창에서 이어 가기 | 인계 md를 첨부하고 `마이 작업 이어서` | 요약과 시작할 항목 |
| 강의자료로 학습 | 자료를 첨부하고 `마이 수업 학습` | 질의응답, 이해도 점검, 노트 md |
| 요구사항 정리 | `마이 프로젝트 todo 정의` | 명세 md 초안 |
| 구현 초안 | 명세를 첨부하고 `마이 프로젝트 todo 구현` | 코드 블록(테스트 미실행) |

- `마이 플러그인 개선`과 `마이 플러그인 평가`는 웹에서 하지 않고 로컬 도구로 안내한다.
- 명령으로 실행하지 않고 이름만 말하려면 맨 앞에 `\`를 붙인다.

전체 키워드: [루트 README](../../README.md#플러그인-기능과-호출-방법)

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

## 업데이트

체크아웃을 갱신(`git -C my pull`)하고 `pack-web.mjs`를 실행한다. 기존에 선택한 업로드 화면에 맞춰 새 ZIP을 올리고, 새 대화에서 `마이 플러그인 현황`으로 버전을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
