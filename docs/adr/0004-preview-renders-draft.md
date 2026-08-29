# ADR-004: Preview renders draft on /preview

## Status

Accepted

## Decision

MVP preview URL is `{storeUrl}/preview` behind the admin session, not `preview-{shop}.liteshop.dev`. Wildcard DNS comes after the first merchant domain is real.

Publish does not rebuild the Astro app. It swaps the published Store Definition pointer. Custom hostname is stored on shop META; wiring `sst.aws.Astro({ domain })` is a per-stage ops change, not a merchant self-serve DNS control plane.

## Consequences

PRD §40 describes the stable preview *capability*. The physical URL for MVP is this ADR, not a preview subdomain.
