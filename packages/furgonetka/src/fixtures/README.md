# Furgonetka Koszyk contract capture

Source: https://furgonetka.pl/api/koszyk (fetched 2026-08-29).

The public docs page describes `CheckoutCartData` and `CheckoutInitConfiguration` but the TypeScript definitions and inbound request/response examples live behind expandable UI that is not present in the static HTML. The sandbox script `universal-checkout-sandbox.js` is minified and does not contain those interfaces.

Until a live capture (HAR or copied types) replaces them:

- `order-inbound.json` / `payment-inbound.json` are the plan's adapter-owned fallback shapes.
- Inbound paths are `orders` and `payments` under the merchant base URL (`/api/furgonetka/*`).
- Shared-key header name is `X-Furgonetka-Key` (docs only say a secret is attached to every request).
- `CheckoutCartData` money fields are złoty (`grosze / 100`). Replace this file the moment official types exist.
