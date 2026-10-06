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
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Security

Do not commit .env files or provider keys. Use a restricted Globalgle key and rotate any key that has been exposed.
