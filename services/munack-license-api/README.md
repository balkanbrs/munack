# Munack License API

This is a standalone PHP backend for Munack license verification and optional Gumroad ping intake.

It is designed for shared-hosting environments such as Hostinger and keeps Munack logically separate from MunaTrust:

- separate product config
- separate storage files
- separate response contract
- no MunaTrust code reuse

## Endpoints

- `POST /api/gumroad/verify`
- `POST /api/gumroad/ping`
- `GET /api/health`

## Why both ping and verify exist

- `ping` is the server-to-server webhook Gumroad calls after a sale event
- `verify` is the endpoint Munack CLI and extension call during activation

If you already use one shared Gumroad Ping URL, keep that shared URL and route Munack product events into this service or replicate the same parsing logic here.

## Config

Copy `api/storage/config.json.example` to `api/storage/config.json` on the server and fill in real values.

## Response shape for verify

```json
{
  "ok": true,
  "active": true,
  "plan": "pro",
  "productName": "Munack Pro",
  "detail": "Verified with Gumroad."
}
```
