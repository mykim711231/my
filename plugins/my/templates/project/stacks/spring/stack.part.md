### Spring Boot (`{{root}}`)

- 생성 도구(승인 후 실행): Spring Initializr — `curl https://start.spring.io/starter.zip -d type=gradle-project-kotlin -d language=java -d groupId={{package}} -d dependencies=web,validation,flyway,testcontainers -o starter.zip` 뒤 `{{root}}`에 푼다.
- `build.gradle.kts`에 더할 것(diff 승인 후): Spotless 플러그인, springdoc-openapi, springdoc OpenAPI Gradle 플러그인(`generateOpenApiDocs`의 출력을 `{{contracts}}/openapi.json`으로). 버전은 레지스트리에서 확인해 `docs/stack.md` "버전"에 적는다.
- 경계: DB ↔ 서버는 `db/migrations/`(Flyway)가 원본이다. 서버 ↔ 화면은 코드 먼저다.

| 명령 | 실행 위치 | 명령어 |
|---|---|---|
| 설치 | `{{root}}` | `./gradlew dependencies` |
| 실행 | `{{root}}` | `./gradlew bootRun` |
| lint | `{{root}}` | `./gradlew spotlessCheck` |
| format | `{{root}}` | `./gradlew spotlessCheck` |
| 타입 검사 | `{{root}}` | `./gradlew compileJava compileTestJava` |
| 테스트 | `{{root}}` | `./gradlew test` |
| 빌드 | `{{root}}` | `./gradlew bootJar` |
| 생성 | `{{root}}` | `./gradlew generateOpenApiDocs` 뒤 `git diff --exit-code {{contracts}}/openapi.json` |
