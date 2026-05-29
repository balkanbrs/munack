# Hostinger Deploy Notes

This repo includes a shared-hosting-friendly Munack license backend at:

- `services/munack-license-api`

## Suggested domain split

- shared Gumroad webhook:
  - `https://billing.munatrust.online/api/gumroad/ping`
- Munack activation API:
  - `https://munack-license.munatrust.online/api/gumroad/verify`

## What to upload

Upload the contents of:

- `services/munack-license-api/api`

into the document root of the Munack license subdomain.

Expected resulting URLs:

- `/api/gumroad/verify`
- `/api/gumroad/ping`
- `/api/health`

## Server-side config

Create this file on the server:

- `api/storage/config.json`

Start from:

- `api/storage/config.json.example`

Recommended values:

- `product_id`
- `seller_id`
- `ping_token`
- `verify_bearer_token`
- `support_email`

## Munack client config

Set these on the machine running Munack:

- `MUNACK_GUMROAD_PRODUCT_ID`
- `MUNACK_LICENSE_API_URL`
- `MUNACK_LICENSE_API_TOKEN` if you enable bearer auth

Example:

```powershell
$env:MUNACK_GUMROAD_PRODUCT_ID="your_gumroad_product_id"
$env:MUNACK_LICENSE_API_URL="https://munack-license.munatrust.online/api/gumroad/verify"
$env:MUNACK_LICENSE_API_TOKEN="your_private_bearer_token"
node .\packages\munack-cli\dist\index.js activate YOUR-LICENSE-KEY
```

## Health check

After upload, verify:

- `GET /api/health`

Expected response:

```json
{
  "ok": true,
  "service": "munack-license-api"
}
```

## Shared ping router rule

If your existing Gumroad Ping URL is shared, route by `product_id` there and either:

- forward Munack events to this service
- or keep the router central and only use this service for `verify`

Do not point the Munack CLI or extension at the shared Ping URL.
