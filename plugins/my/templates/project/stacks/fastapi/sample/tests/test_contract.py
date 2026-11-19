import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

CONTRACT = Path(__file__).resolve().parent.parent / "{{contracts}}" / "openapi.json"
client = TestClient(app)


# REQ-00: 생성한 계약과 서버가 같아야 한다
def test_contract_is_current() -> None:
    assert CONTRACT.exists(), "scripts/export_openapi.py를 먼저 실행한다"
    assert json.loads(CONTRACT.read_text(encoding="utf-8")) == app.openapi()


# REQ-00
def test_health() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}
