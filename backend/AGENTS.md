# NoteForge — Backend (Java/Spring Boot)

## OVERVIEW

Java 21 + Spring Boot 3.3 microservices, multi-module Gradle build. ~70 Java files across 3 submodules.

## STRUCTURE

```
backend/
├── common/              # Shared lib: ApiResponse, PageResponse, GlobalExceptionHandler, StringUtils
├── note-service/        # Core business: notes, notebooks, tags, attachments, sync
│   ├── controller/      # REST endpoints (NoteController, NotebookController, TagController, etc.)
│   ├── service/         # Business logic (NoteService, SyncService, TagService, etc.)
│   ├── entity/          # JPA entities (Note, Notebook, Tag, SyncLog)
│   ├── repository/      # Spring Data JPA repos
│   ├── dto/             # Request/response DTOs
│   ├── config/          # Redis, WebSocket, Security config
│   └── security/        # JWT auth filter + provider
└── user-service/        # Auth & user management
    ├── controller/      # AuthController, UserController, HealthController
    ├── service/         # AuthService, UserService
    ├── entity/          # UserEntity
    ├── repository/      # UserRepository
    ├── dto/             # Auth/User DTOs
    ├── security/        # JWT + UserDetailsServiceImpl
    └── config/          # SecurityConfig
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Note CRUD API | `note-service/controller/NoteController.java` |
| Authentication | `user-service/controller/AuthController.java` |
| WebSocket sync | `note-service/config/SyncWebSocketHandler.java` |
| JWT token | `note-service/security/JwtTokenProvider.java` (mirrored in user-service) |
| API response format | `common/response/ApiResponse.java` |

## CONVENTIONS

- Standard 3-layer architecture: controller → service → repository
- Lombok used for entity boilerplate
- JWT stored in-memory (no refresh token rotation yet)
- Exceptions thrown as `ResourceNotFoundException` → caught by `GlobalExceptionHandler`
- Profiles: dev, test, prod (application-{profile}.yml)

## COMMANDS

```bash
gradlew :note-service:bootRun    # Run note-service
gradlew :user-service:bootRun    # Run user-service
gradlew build                    # Build all
```

## ANTI-PATTERNS

- Shared JWT secret between services (no secret rotation)
- No integration test containers — uses `TestSecurityConfig` mock
- No API gateway — services expose directly
