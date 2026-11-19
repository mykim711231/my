# claude.ai 웹에서 my 사용하기 (채팅 모드)

웹에서 `my`의 결과는 화면과 Markdown으로 받는다. 로컬에서 이어 쓸 인계 문서나 학습 노트는 직접 저장한다.

## 설치

1. [웹 패키지 만들기](README.md#웹-패키지-만들기) 절차로 `dist/web/`에 ZIP을 생성한다.
2. Claude 설정에서 **Code execution and file creation**(새 설정의 **Create and edit files**)을 켠다. [Claude 스킬 사용 조건](https://support.claude.com/en/articles/12512180-use-skills-in-claude#how-to-enable-skills)
3. 사용 중인 업로드 화면에 맞는 ZIP을 선택한다.
   - **내 플러그인 → 플러그인 업로드**에서는 `my-claude-plugin.zip`을 선택한다. 이 ZIP의 최상위에 `.claude-plugin/plugin.json`과 `skills/my/SKILL.md`가 있다. [Claude 플러그인 도움말](https://support.claude.com/en/articles/13837440-use-plugins-in-claude) · [플러그인 구조](https://code.claude.com/docs/en/plugins-reference#plugin-directory-structure)
   - **Customize → Skills → + → Create skill → Upload a skill**에서는 `my-skill.zip`을 선택하고 목록에 추가된 **my**를 켠다. [Claude 스킬 도움말](https://support.claude.com/en/articles/12512180-use-skills-in-claude)

플러그인 업로드에서 `.claude-plugin/plugin.json` 오류가 표시되면 `dist/web/my-claude-plugin.zip`을 선택한다. 업로드 메뉴를 쓸 수 없으면 `dist/web/my-onefile.md`의 내용을 프로젝트 지침에 붙이거나 대화 첫 메시지에 파일을 첨부한다.

## 설치 확인

1. 플러그인으로 설치했다면 **My** 상세 화면에서 현재 버전과 **Skills 1개**를 확인하고 **채팅에서 사용해보기**를 누른다. 스킬로 설치했다면 **Customize → Skills**에서 **my**를 켜고 새 채팅을 연다.
2. `마이 플러그인 현황`을 보낸다. 스킬이 자동으로 적용되지 않으면 입력창의 `/` 또는 `+` 목록에서 **My**의 스킬을 선택해 보낸다. [Claude 플러그인 도움말](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)
3. `my 플러그인 현황 (웹)`, 버전, 키워드 표가 표시되는지 확인한다.

Claude 웹에서 `my-claude-plugin.zip`으로 0.11.0을 등록하고 현황 명령을 실행했다. 표에는 채팅 모드 21개와 로컬 전용 2개가 표시됐다.

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
- 학습 노트 md(`미정-<이름>.md`)는 가져올 로컬 프로젝트 폴더에 저장한다. 그 폴더에서 `$MyRepo`에 `my` 체크아웃의 절대 경로를 지정하고 아래 명령을 실행하면 번호를 매겨 학습 폴더로 가져온다.

```powershell
node (Join-Path $MyRepo 'plugins/my/scripts/learn.mjs') import './미정-vector-db.md'
```

앞머리에 `topic`이 없으면 `--topic <주제>`를 붙인다. 중앙 학습 폴더에 넣으려면 `--central`을 붙인다.

## 한계

- 코드와 다이어그램은 실행·렌더링으로 확인하지 않는다. 결과 끝의 "테스트 미실행", "Mermaid 미검증" 표시를 보고 로컬에서 확인한다.
- `마이 프로젝트 … 검증`과 `마이 적대적 학습`은 같은 대화 안에서 하므로 "분리 검토 아님"이다.
- 설정은 그 대화에서만 쓴다.

## 업데이트

1. [웹 패키지 업데이트](README.md#웹-패키지-업데이트) 절차로 `dist/web/`의 파일을 다시 만든다.
2. **플러그인 업로드**에는 새 `my-claude-plugin.zip`, **스킬 업로드**에는 새 `my-skill.zip`을 사용한다. 프로젝트 지침으로 쓰는 경우 새 `my-onefile.md`로 지침을 교체한다.
3. 새 대화에서 [설치 확인](#설치-확인)을 따라 버전과 최근 변경을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
