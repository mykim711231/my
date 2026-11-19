"""서버 코드에서 OpenAPI 스키마를 생성한다. 생성됨 — 직접 수정 금지 대상: {{contracts}}/openapi.json"""

import json
from pathlib import Path

from app.main import app

OUT = Path(__file__).resolve().parent.parent / "{{contracts}}" / "openapi.json"


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"생성: {OUT}")


if __name__ == "__main__":
    main()
