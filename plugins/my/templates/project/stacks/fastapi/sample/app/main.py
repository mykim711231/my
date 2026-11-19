from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="{{name}}")


class Health(BaseModel):
    status: str


# REQ-00: 서버가 살아 있는지 알려 준다(기준 구현 예시)
@app.get("/health", operation_id="getHealth", response_model=Health)
def get_health() -> Health:
    return Health(status="ok")
