---
max_turns: 6
allowed_tools: [Read, Write, Skill]
tags: [result, mermaid]
---

다음 흐름을 Mermaid 흐름도로 그려 작업 폴더의 `diagram.md`에 저장해 줘. 노드 글자는 아래 그대로 쓴다.

1. 설정 읽기(config.json)
2. 값 검사(스키마 v2)
3. 실패하면 오류 출력(exit 2), 성공하면 저장(atomic write)
