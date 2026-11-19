# Gemini CLI에서 my 사용하기

Gemini CLI 확장(`gemini-extension.json`, `/my:<스킬>` 명령 파일)은 아직 없다. `gemini extensions install`과 키워드 훅은 확장이 추가된 뒤 쓸 수 있고, 지금은 복제한 체크아웃의 `SKILL.md` 경로를 지정해 부른다. [Gemini CLI 확장 명세](https://geminicli.com/docs/extensions/reference/)

- 필요한 것: Gemini CLI, Git, Node.js. PowerShell에서 `gemini --version`, `node --version`으로 확인한다.
- `마이` 키워드: 없음. `SKILL.md` 경로로 부른다.

## 설치

```powershell
$MyRepo = Join-Path $env:USERPROFILE 'src/my'
git clone https://github.com/mykim711231/my.git $MyRepo
```

아래 예시의 `C:/Users/YOUR_WINDOWS_USER/src/my`는 실제 체크아웃 경로로 바꾼다. 스킬이 `../../scripts/`와 `../../templates/`를 참조하므로 체크아웃의 폴더 구조를 유지한다.

## 설치 확인

작업할 프로젝트 루트에서 `gemini`를 실행하고 아래처럼 요청한다.

```text
C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills/plugin-status/SKILL.md를 읽고 지시에 따라 my 플러그인 현황을 보여 줘.
```

버전과 키워드 목록이 나오면 된다. `키워드 훅 미적용`은 이 방식에서 예상되는 결과다.

- 외부 폴더를 읽지 못하면 세션에서 `/directory add C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my`로 폴더를 추가한 뒤 다시 요청한다. [Gemini CLI 세션 명령](https://geminicli.com/docs/cli/commands/)
- 터미널에서 버전만 보려면 `node (Join-Path $MyRepo 'plugins/my/scripts/status.mjs')`를 실행한다.

## 작업별 호출

대화창에 스킬 파일 경로와 요청을 함께 적는다. 스킬 파일은 `my` 체크아웃에서 읽고, `./src` 같은 작업 대상은 Gemini CLI를 실행한 프로젝트 기준이다. 아래 표의 `…/skills/`는 `C:/Users/YOUR_WINDOWS_USER/src/my/plugins/my/skills/`를 줄인 것이다.

| 하려는 일 | Gemini 대화창에 입력 |
| --- | --- |
| 프로젝트 문서와 Git 상태 브리핑 | `…/skills/work-start/SKILL.md를 읽고 현재 프로젝트를 브리핑해 줘.` |
| 작업 요약과 인계 문서 작성 | `…/skills/work-end/SKILL.md를 읽고 이번 작업의 인계 문서를 작성해 줘.` |
| 최근 인계 문서에서 재개 | `…/skills/work-resume/SKILL.md를 읽고 최근 인계 문서로 이어서 작업해 줘.` |
| 기존 소스 함께 읽기 | `…/skills/learn-source/SKILL.md를 읽고 현재 프로젝트의 ./src를 대상으로 학습을 시작해 줘.` |
| 요구사항과 명세 초안 만들기 | `…/skills/project-define/SKILL.md를 읽고 todo 프로젝트의 기능을 정의해 줘.` |
| 설정 동기화 변경안 보기 | `…/skills/sync/SKILL.md를 읽고 gemini->codex 방향으로 동기화할 파일과 diff를 보여 줘.` |
| 플러그인 문제 기록하기 | `…/skills/plugin-issue/SKILL.md를 읽고 현황 출력에 버전이 빠진 문제를 기록해 줘.` |

- 프로젝트 정의나 설정 동기화는 초안 또는 diff를 검토하고 승인 여부를 답한다.
- 다른 기능도 [키워드 원본](../../plugins/my/scripts/keywords.json)의 `skill` 값에 해당하는 `SKILL.md`를 같은 방식으로 지정한다.

전체 키워드와 스킬 이름: [루트 README](../../README.md#플러그인-기능과-호출-방법)

## 업데이트

```powershell
git -C $MyRepo pull
```

체크아웃을 원하는 버전으로 갱신한 뒤 새 세션에서 `plugin-status/SKILL.md`로 버전을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
