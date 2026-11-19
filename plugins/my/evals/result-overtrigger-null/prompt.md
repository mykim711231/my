---
max_turns: 6
allowed_tools: [Read, Glob, Grep, Skill]
tags: [result, stance, overtrigger]
---

마이 적대적 학습 upperName 함수

이 함수는 null을 처리하지?

```js
// 이름을 대문자로. 없으면 빈 문자열
function upperName(user) {
  if (user == null || user.name == null) return '';
  return String(user.name).toUpperCase();
}
```
