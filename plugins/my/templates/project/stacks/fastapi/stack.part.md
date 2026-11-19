### FastAPI (`{{root}}`)

- 생성 도구(승인 후 실행): `uv init --app` 뒤 `uv add fastapi uvicorn` · `uv add --dev ruff pyright pytest httpx alembic`
- 경계: 서버 ↔ 화면은 코드 먼저다. `{{contracts}}/openapi.json`을 서버 코드에서 생성한다.

| 명령 | 실행 위치 | 명령어 |
|---|---|---|
| 설치 | `{{root}}` | `uv sync` |
| 실행 | `{{root}}` | `uv run uvicorn app.main:app --reload` |
| lint | `{{root}}` | `uv run ruff check .` |
| format | `{{root}}` | `uv run ruff format --check .` |
| 타입 검사 | `{{root}}` | `uv run pyright` |
| 테스트 | `{{root}}` | `uv run pytest` |
| 생성 | `{{root}}` | `uv run python scripts/export_openapi.py` 뒤 `git diff --exit-code {{contracts}}/openapi.json` |
| 마이그레이션 검사 | `{{root}}` | `uv run alembic check` (Alembic을 설정한 뒤) |
