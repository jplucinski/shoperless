# ADR-001: DynamoDB single-table design

## Status

Accepted

## Decision

One table `Table` with `pk` + `sk` and GSI `gsi1` (`gsi1pk` + `gsi1sk`). Keys:

- `SHOP#{shopId}` / `META`
- `SHOP#{shopId}` / `PRODUCT#{productId}`
- `SHOP#{shopId}` / `INVENTORY#{sku}`
- `SHOP#{shopId}` / `INVEVT#{eventId}`
- `SHOP#{shopId}` / `ORDER#{orderId}`
- `SHOP#{shopId}` / `EXTORDER#{externalOrderId}`
- `SHOP#{shopId}` / `RESERVATION#{orderId}`
- `SHOP#{shopId}` / `FURGONETKA`
- `SESSION#{sessionId}` / `META`
- later: `SHOP#{shopId}` / `STORE#DRAFT`, `STORE#VERSION#{n}`, `STORE#PUBLISHED`

GSI1:

- products by slug: `gsi1pk = SHOP#{shopId}#SLUG`, `gsi1sk = {slug}`
- reservations by expiry: `gsi1pk = SHOP#{shopId}#RESERVATION`, `gsi1sk = {expiresAtIso}`

PRD §42 lists **entities**, not physical keys. `PRODUCT#BLUE` in the PRD example is conceptual; the item key uses `productId`, inventory uses `sku`.

## Consequences

All commerce items are shop-scoped. Core tests use in-memory ports; the Dynamo adapter is the only AWS SDK user.
