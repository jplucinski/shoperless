# Furgonetka Koszyk contract fixtures

Source: [universal-checkout.d.ts](https://furgonetka.pl/js/dist/checkout/universal-checkout.d.ts) and [OpenAPI shop API](https://furgonetka.pl/js/swagger/universal-integration-structure-documentation.yaml).

- `add-order-in.json` — `POST /orders` (`AddOrderIn`)
- `add-payment-in.json` — `POST /orders/{sourceOrderId}/payments`
- `tracking-number-in.json` — `POST /orders/{id}/tracking_number`

Auth header: `Authorization` (raw token or `Bearer …`).
