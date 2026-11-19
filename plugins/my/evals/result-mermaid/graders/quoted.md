---
type: regex
pattern: '[\[{]\s*[^"\s\]}][^\]}\n]*\('
match: not_contains
target:
  source: file
  path: diagram.md
weight: 2
---

괄호가 든 노드 글자는 따옴표로 감싼다(`A["설정 읽기(config.json)"]`). 따옴표 없이 `[ … ( … ]`나 `{ … ( … }`로 쓰면 실패다.
