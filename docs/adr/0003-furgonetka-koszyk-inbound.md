# ADR-003: Furgonetka Koszyk is inbound

## Status

Accepted

## Decision

LiteShop does not host checkout. The storefront loads `Furgonetka.Checkout` and supplies cart data from a server-prepared snapshot. Furgonetka then POSTs order and payment events to LiteShop endpoints authenticated with a shared key.

OAuth is a separate track for admin sign-in and "open in Furgonetka". It is not required to accept the first paid sandbox order.

Inbound URL paths and JSON schemas are copied from https://furgonetka.pl/api/koszyk into `@liteshop/furgonetka` during Phase 1 contract capture. They are not invented in plans.

## Consequences

`@liteshop/core` never imports Furgonetka types. The adapter maps captured payloads onto `CreateOrderCommand` and `ApplyPaymentCommand`.
