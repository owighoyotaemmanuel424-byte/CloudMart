# CloudMart

CloudMart is a provider-agnostic digital-services marketplace. Globalgle is the first provider adapter.

## Architecture

Customer/Admin UI -> CloudMart API -> Provider Router -> Globalgle API

The Globalgle API key is server-only. Never expose it in client-side code.

## Globalgle

Set:

- GLOBALGLE_API_BASE_URL=https://tudowebs.com/api/v1
- GLOBALGLE_API_KEY=...
- GLOBALGLE_WEBHOOK_SECRET=...

Available foundation routes:

- GET /api/health
- GET /api/services
- GET /api/provider/balance
- POST /api/webhooks/globalgle

The catalog is normalized at runtime instead of hard-coding provider products.

## Database

Prisma/PostgreSQL models cover users, wallets, immutable ledger entries, services, provider products, orders, order events, webhook events and audit logs.

Run:

```bash
npm install
cp .env.example .env      # then fill in the values
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Migrations are applied by a dedicated release step, not by `next build`:

```bash
npx prisma migrate deploy
```

## Security

- `CLOUDMART_SESSION_SECRET` is required and must be at least 32 random
  characters. Sessions are HMAC-signed with it; the server fails closed rather
  than falling back to a default.
- Admin access needs the server-side `CLOUDMART_ADMIN_ACCESS_KEY` **and** the
  password of the admin account. The first admin is bootstrapped from
  `/admin/login`; after that, bootstrap is locked and each admin signs in with
  their own password.
- Do not commit .env files or provider keys. Use a restricted Globalgle key and
  rotate any key that has been exposed.
- Provider cost basis and raw provider metadata are not exposed by the public
  catalog endpoints.
