# Gumroad Architecture For Munack

Munack should treat Gumroad in two separate layers:

## 1. Shared Ping URL

Gumroad sends server-to-server sale notifications to a Ping URL.

If you already have one shared Ping URL in production, keep it shared. That is fine.

Recommended shared endpoint:

- `https://billing.munatrust.online/api/gumroad/ping`

That shared endpoint should:

- validate the seller
- inspect `product_id`
- route or fan out by product
- keep Munack and MunaTrust storage separate

Munack does not call this endpoint from the CLI or extension.

## 2. Munack Verify URL

Munack activation should call a Munack-specific endpoint:

- `https://munack-license.munatrust.online/api/gumroad/verify`

or

- `https://license.munack.app/api/gumroad/verify`

This endpoint should:

- accept a license key from Munack
- call Gumroad license verify
- normalize the response for Munack
- never expose seller-only secrets

## Recommended production split

- Shared webhook router:
  - `billing.munatrust.online`
- Munack activation API:
  - `munack-license.munatrust.online`
- MunaTrust activation API:
  - keep existing MunaTrust endpoint separate

## Included backend

This repo now includes a standalone PHP backend here:

- `services/munack-license-api`

It can be deployed directly to a Hostinger subdomain and supports:

- `POST /api/gumroad/verify`
- `POST /api/gumroad/ping`
- `GET /api/health`
