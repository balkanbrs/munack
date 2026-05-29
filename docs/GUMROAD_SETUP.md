# Gumroad Setup

Munack uses Gumroad's license verification endpoint and intentionally does not require any private seller secret in the shipped app.

## Required environment variables

- `MUNACK_GUMROAD_PRODUCT_ID`
- `MUNACK_LICENSE_KEY`

## Optional dedicated license backend

If you want Munack to verify through your own backend instead of calling Gumroad directly from the client, set:

- `MUNACK_LICENSE_API_URL`
- `MUNACK_LICENSE_API_TOKEN` if your backend requires bearer auth

Recommended example:

- `https://license.munack.yourdomain.com/api/gumroad/verify`

or, if you want to keep it under the same parent domain without mixing products:

- `https://munack-license.munatrust.online/api/gumroad/verify`

The backend should stay logically separate from Munatrust:

- separate subdomain
- separate Gumroad product ID
- separate webhook secret
- separate database tables or namespaces
- separate logs and metrics
- no shared product activation logic

## Shared Ping URL strategy

If Gumroad only gives you one operational Ping URL in your current setup, keep one shared webhook endpoint and route by product there.

Recommended split:

- shared billing webhook:
  - `https://billing.munatrust.online/api/gumroad/ping`
- Munack activation endpoint:
  - `https://munack-license.munatrust.online/api/gumroad/verify`

Munack itself should never call the shared Ping URL. Ping is webhook-only.

See:

- `docs/GUMROAD_ARCHITECTURE.md`
- `services/munack-license-api`

## Recommended local setup

1. Copy values from your Gumroad product into environment variables.
2. Keep seller-only secrets outside the repo.
3. Test activation:

```powershell
node .\packages\munack-cli\dist\index.js activate YOUR-LICENSE-KEY
node .\packages\munack-cli\dist\index.js license status
```

## Offline behavior

- Munack caches the last verified paid status locally.
- If Gumroad is temporarily unavailable, Munack falls back to cached paid status when possible.
- Cache location defaults to `~/.munack/state.json` or `MUNACK_HOME` if set.
