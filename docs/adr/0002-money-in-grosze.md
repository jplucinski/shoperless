# ADR-002: Money is integer grosze

## Status

Accepted

## Decision

`Money` is a non-negative integer count of grosze. PLN 199.00 is `19900`. Formatting happens at the UI edge via `formatPln`.

`Number.isInteger(199.0)` is true in JavaScript — tests that reject floats must use a value such as `19.99`.

## Consequences

JSON APIs send integers. The Furgonetka adapter converts to/from whatever fractional units Koszyk uses, inside `@liteshop/furgonetka` only.
