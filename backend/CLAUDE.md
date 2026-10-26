# Backend rules (loaded when working under `backend/`)

Spring Boot 4, Java source level 17, Maven wrapper. Package root `com.naji.backend`.

## Module layout
```
com.naji.backend.<module>/        entity, repository, service, controller, mapper
com.naji.backend.<module>/dto/    request/response records with Bean Validation
com.naji.backend.common/          config, security, exception, validation, persistence, web
```
Reference implementations: `customer` (simple CRUD), `product`, `invoice` (lifecycle, calculation, numbering).

## Conventions
- Never expose JPA entities from controllers: DTO records + mapper.
- Every query is scoped to the authenticated owner; another user's resource is reported as not found (no disclosure).
- Errors go through `GlobalExceptionHandler` (RFC 9457 `ProblemDetail`): `ResourceNotFoundException` (404),
  `ConflictException` (409), `UnprocessableException` (422).
- Money is `BigDecimal`, never `double`; VAT rates validated by `@FrenchVatRate`.
- Time comes from the injected `Clock` (`ClockConfig`), never `LocalDate.now()` without it.
- Schema changes only through a new Flyway migration `V<n>__<description>.sql`; never edit an applied one.
- Services: `@Transactional(readOnly = true)` on the class, `@Transactional` on writes.

## Tests (every module)
- Mockito service test, `@WebMvcTest` controller test (`@Import(SecurityConfig.class)`, `jwt()` post-processor),
  `@DataJpaTest` repository test, and an ownership integration test for owner scoping.
- Run `./mvnw test` from `backend/`; report the real pass/fail counts.
