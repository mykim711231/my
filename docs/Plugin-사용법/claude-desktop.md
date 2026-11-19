# Claude 데스크탑에서 my 사용하기

Claude 앱의 **Code 탭**에서 로컬 프로젝트를 열어 쓴다. 로컬 세션은 Claude Code CLI와 같은 설정 파일을 쓴다. [Claude Code 데스크탑](https://code.claude.com/docs/en/desktop) · [Claude Code 설정](https://code.claude.com/docs/en/settings)

- 필요한 것: Claude 데스크탑 앱, Node.js. PowerShell에서 `node --version`으로 확인한다.
- `마이` 키워드: 자동(훅)

## 설치

1. Claude 앱에서 **Customize → Plugins** 탭의 **Add → Add marketplace**를 선택한다. [Use plugins in Claude](https://support.claude.com/en/articles/13837440-use-plugins-in-claude)
2. `mykim711231/my`(또는 `https://github.com/mykim711231/my`)를 입력해 추가한다.
3. `my`를 찾아 설치한다.

Code 탭의 로컬 세션에서도 입력창 옆 **+** 버튼에서 플러그인 브라우저(**Plugins**, **Browse plugins** 또는 **Manage plugins**)를 열고 Marketplaces 탭에서 같은 저장소를 추가할 수 있다. 메뉴 이름은 앱 버전에 따라 다르다. [Install and manage plugins](https://code.claude.com/docs/en/plugins/install)

앱에서 마켓플레이스 추가 메뉴를 찾을 수 없다면 [Claude Code CLI](claude-code.md#설치)로 등록한 뒤 Code 탭에서 플러그인 목록을 다시 확인한다.

## 설치 확인

**Code → Local**에서 작업할 프로젝트를 열고 새 세션에 `마이 플러그인 현황`을 입력한다. 버전과 전체 키워드 목록이 나오면 된다. 입력창 옆 **+ → Plugins**에서도 `my`의 스킬을 찾을 수 있다.

`키워드 훅 미적용`이 표시되면 [Claude Code CLI의 설치 확인](claude-code.md#설치-확인) 절차로 점검한다.

## 작업별 호출

Claude Code CLI와 같다. 키워드와 슬래시 명령 표는 [Claude Code CLI의 작업별 호출](claude-code.md#작업별-호출)을 본다.

| 하려는 일 | 입력 |
| --- | --- |
| 프로젝트 문서와 Git 상태 브리핑 | `마이 작업 시작` |
| 기존 소스 함께 읽기 | `마이 기존 소스 학습 ./src` |
| 작업 요약과 인계 문서 작성 | `마이 작업 종료` |

## 업데이트

앱의 플러그인 관리자에서 `my`를 갱신하거나 [Claude Code CLI의 업데이트](claude-code.md#업데이트) 절차를 쓴다. 새 로컬 세션에서 `마이 플러그인 현황`으로 버전을 확인한다.

---

[다른 환경](../../README.md#설치하고-시작하기) · [포크해서 개선하기](README.md)
