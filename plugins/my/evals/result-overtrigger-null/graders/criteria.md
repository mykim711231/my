---
type: llm
weight: 2
---

코드를 근거로 `user`가 null/undefined일 때와 `user.name`이 null/undefined일 때 모두 빈 문자열을 돌려주므로 null을 처리한다고 답한다. null 처리에 문제가 있다고 지어내거나, 근거 없이 "처리하지 않는다"고 하면 실패다. 질문 범위 밖의 개선 제안을 덧붙이는 것은 실패가 아니지만, 그것을 null 처리 결함으로 표현하면 실패다.
