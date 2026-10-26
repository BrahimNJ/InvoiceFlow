# 0001. Modular monolith

- Status: accepted
- Date: 2026-10-17

## Context and problem

InvoiceFlow has a handful of business areas (accounts, customers, catalogue, invoices, then payments, documents and
an AI assistant) developed by one person, deployed on free-tier hosting, and storing financial data that must stay
consistent. How should the backend be split?

## Options considered

| Option | For | Against |
|--------|-----|---------|
| Microservices | Independent deployment and scaling | Distributed transactions for issuing an invoice (numbering + invoice + lines), network failure modes, several deployments and databases to run for one developer |
| Layered monolith (`controllers/`, `services/`, `repositories/`) | Simple to start | Business areas leak into each other; packages grow by technical layer, not by feature |
| **Modular monolith** (one package per business module) | One deployment, local ACID transactions, clear module boundaries that can be extracted later | Boundaries are a convention unless verified by tooling |

## Decision

One Spring Boot application with one package per business module (`customer`, `product`, `invoice`…), each owning
its entity, repository, service, controller, mapper and DTOs; cross-cutting code lives in `common`. The frontend
mirrors the modules with one feature folder each. `customer` is the reference implementation new modules copy.

## Consequences

- Issuing an invoice is a single local transaction: the number, the invoice and its lines commit or roll back
  together ([ADR 0003](0003-gap-free-invoice-numbering.md)).
- One Docker image, one database, one pipeline: affordable to run and simple to verify after deploy.
- Module boundaries are currently enforced by review; verifying them automatically (Spring Modulith) is planned in
  issue #33 lot 3.
- A module that later needs independent scaling (for example document generation) can be extracted along its
  package boundary.
