### PWA (`{{root}}`)

- 생성 도구(승인 후 실행): `pnpm create vite . --template react-ts` 뒤 `pnpm add -D vite-plugin-pwa vitest @playwright/test openapi-typescript prettier eslint`
- 경계: 화면 타입은 `{{contracts}}/openapi.json`에서 생성한다. `src/api/schema.d.ts`는 손으로 고치지 않는다.

| 명령 | 실행 위치 | 명령어 |
|---|---|---|
| 설치 | `{{root}}` | `pnpm install --frozen-lockfile` |
| 실행 | `{{root}}` | `pnpm dev` |
| lint | `{{root}}` | `pnpm exec eslint .` |
| format | `{{root}}` | `pnpm exec prettier --check .` |
| 타입 검사 | `{{root}}` | `pnpm exec tsc -b --noEmit` |
| 테스트 | `{{root}}` | `pnpm exec vitest run` |
| E2E | `{{root}}` | `pnpm exec playwright test` |
| 빌드 | `{{root}}` | `pnpm build` |
| 생성 | `{{root}}` | `pnpm exec openapi-typescript {{contracts}}/openapi.json -o src/api/schema.d.ts` 뒤 `git diff --exit-code src/api/schema.d.ts` |
