# 내 포크로 my 설치하고 개선하기

1. GitHub에서 [원본 저장소](https://github.com/mykim711231/my)를 열고 **Fork**를 눌러 내 계정에 복사한다. 아래 `YOUR_GITHUB_ID`는 내 GitHub 계정명으로 바꾼다.
2. PowerShell에서 내 포크를 복제한다. `$MyRepo`는 로컬 체크아웃 경로다. 다른 위치를 쓰려면 첫 줄을 바꾼다.

   ```powershell
   $MyRepo = Join-Path $env:USERPROFILE 'src/my'
   git clone https://github.com/YOUR_GITHUB_ID/my.git $MyRepo
   git -C $MyRepo remote get-url origin
   ```

3. `origin`이 내 포크를 가리키는지 확인하고, 사용하는 도구의 가이드에 따라 설치한다. [Claude Code](claude-code.md) · [Codex](codex.md) · [Gemini CLI](gemini-cli.md)

## 내 포크에서 개선하기

1. `plugin-config` 스킬에서 원본 경로(`plugin_src`)를 내 체크아웃의 절대 경로로 저장한다. PowerShell에서 임시로 지정하려면 도구를 실행하기 전에 `$env:MY_PLUGIN_SRC = $MyRepo`를 입력한다. 이 환경 변수가 저장된 설정보다 우선한다.
2. `plugin-issue` 스킬로 불편한 점이나 개선 아이디어를 기록한다. 같은 도구에서 `plugin-apply` 스킬을 열고 대기 목록의 **고칠 원본**이 내 체크아웃의 `plugins/my`인지 확인한다.
3. 반영할 항목을 고르고 수정안과 diff를 검토해 승인한다. 스킬은 내 체크아웃에 적용하고, 검증을 통과하면 버전을 올린 뒤 커밋 여부를 묻는다. 구조 검증에는 Claude Code의 `plugin-dev` 또는 `claude plugin validate`가 필요하므로 Codex나 Gemini CLI에서 개선할 때도 검증 도구를 준비한다.
4. 로컬 설치는 도구별 가이드의 업데이트 절차로 반영한다. GitHub에서 내 포크를 설치했다면 검증한 커밋을 내 포크에 푸시하고 마켓플레이스를 갱신한다.
