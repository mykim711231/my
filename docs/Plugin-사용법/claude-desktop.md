# Claude 데스크탑에서 my 플러그인 사용하기

Claude 앱의 **Code 탭**에서 로컬 프로젝트를 열어 사용한다. `my`의 훅과 스크립트는 Node.js를 실행하므로 PowerShell에서 `node --version`을 확인한다. [Claude Code 데스크탑](https://code.claude.com/docs/en/desktop)

## 설치

1. Claude 앱에서 **Settings → Plugins → Add → Add Marketplace → Add from a repository**를 선택한다.
2. `https://github.com/mykim711231/my`를 입력하고 **Sync**를 누른다.
3. `my`를 찾아 설치한다. Code 탭의 로컬 세션에서도 입력창 옆 **+ → Plugins → Add plugin**을 열어 등록된 마켓플레이스에서 설치할 수 있다. [Claude 앱에서 GitHub 마켓플레이스 추가](https://developers.openai.com/learn/developers-codex-plugin)

앱에서 마켓플레이스 추가 메뉴를 찾을 수 없다면 [Claude Code CLI 가이드](claude-code.md)로 등록한 뒤 Claude 앱의 Code 탭에서 플러그인 목록을 다시 확인한다. 로컬 세션은 같은 Claude Code 설정 파일을 사용한다. [Claude Code 설정](https://code.claude.com/docs/en/settings)

## 호출과 업데이트

- **Code → Local**에서 작업할 프로젝트를 열고 새 세션에 `마이 플러그인 현황`을 입력한다. 입력창 옆 **+ → Plugins**에서도 `my`의 스킬을 찾을 수 있다.
- 프로젝트 상태를 확인하려면 `마이 작업 시작`, 기존 소스를 읽으려면 `마이 기존 소스 학습 ./src`를 입력한다. [전체 명령](../../README.md#플러그인-기능과-호출-방법)
- 버전을 갱신하려면 앱의 플러그인 관리자에서 `my`를 갱신하거나 [CLI 업데이트 절차](claude-code.md#업데이트)를 사용한 뒤 새 로컬 세션에서 버전을 확인한다.
