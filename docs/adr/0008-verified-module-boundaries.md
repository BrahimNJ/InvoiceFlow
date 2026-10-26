# 0008. Module boundaries verified by Spring Modulith

- Status: accepted
- Date: 2026-10-26

## Context and problem

[ADR 0001](0001-modular-monolith.md) chose a modular monolith and noted that its boundaries were only a convention
enforced by review. Nothing stopped a module from reaching into another module's `dto` package or from creating a
dependency cycle, and the architecture diagram in the documentation could silently drift from the code.

## Options considered

| Option | For | Against |
|--------|-----|---------|
| Review only | No tooling | Violations slip through; nothing proves the claim "modular" |
| Maven multi-module build | Boundaries enforced by the compiler | Heavy restructuring for six packages, slower builds, more configuration |
| ArchUnit rules written by hand | Flexible | Every rule written and maintained by us |
| **Spring Modulith** (built on ArchUnit) | Derives modules from the package structure, verifies access and cycles with one call, knows Spring | One test dependency and two annotations |

## Decision

- `ModularityTest` calls `ApplicationModules.of(BackendApplication.class).verify()`. Every direct sub-package of
  `com.naji.backend` is a module; its sub-packages are internal.
- `common` is declared an **open** module (`@ApplicationModule(type = OPEN)`): it is the shared kernel (errors,
  validation, security, paging) used by every module, and it must never depend on a business module.
- `user.dto` is declared a **named interface**: `auth` returns `UserResponse`, the only cross-module DTO.
- The same test generates the module dependency diagram from the bytecode and compares it with the block in
  [Architecture](../architecture.md); the build fails if the documentation is out of date.

## Consequences

- The first run reported 111 accesses to internal packages, all to `common` sub-packages and `user.dto`; declaring
  the shared kernel and the named interface resolved them without moving code. No cycle was found.
- A new module that imports another module's internals, or a cycle such as `customer → invoice → customer`, now fails
  CI with the offending types listed.
- The architecture diagram in the docs is guaranteed to describe the real dependencies.
