# XL Perfumes API

Express API using Sequelize with MySQL.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set your MySQL connection values.
3. Generate a random secret (for example, `openssl rand -base64 48`), set it as `JWT_SECRET`, and set `WEB_ORIGIN` to the web app's origin.
4. Create the first administrator by setting `ADMIN_USERNAME` and `ADMIN_PASSWORD`, then run `npm run seed`. The seed command is safe to run repeatedly and also creates or maintains the configured user as an active administrator. For the original one-time empty-table bootstrap behavior, use `npm run bootstrap:admin`.
5. Apply pending database migrations with `npm run migrate`. The API also applies pending migrations at startup.
6. Start the API with `npm start` (or `npm run dev` for Node's watch mode).

Migrations are tracked in the `SequelizeMeta` table. To revert the most recently
applied migration, run `npm run migrate:undo`. Reverting a migration can remove
its schema and associated data.

The API listens on port `4000` by default. JSON and URL-encoded request bodies
are limited to `100mb`. Credentialed CORS requests are allowed from the
configured `WEB_ORIGIN`.

## Authentication and users

Passwords are stored as bcrypt hashes. Login issues an eight-hour HS256 JWT in
an HttpOnly cookie and returns the token for clients that use the Bearer
authorization header. The API also supports logging out and viewing the current
account at `POST /api/auth/logout` and `GET /api/auth/me`.

All `/api/users` endpoints require an authenticated administrator. The routes
support listing, creating, updating, activating/deactivating, and deleting
users. Roles are `admin`, `spg`, `collecting`, `gudang`, and `owner`. User
responses never include password hashes.

## Activity logs

Authentication attempts and administrator changes to users and stores are
stored in the `activity_logs` table. `GET /api/activity-logs` requires an
authenticated administrator and returns up to 500 newest entries; pass
`?limit=100` to select a smaller page size. Password values are never logged.

## Products

`GET /api/products` lists barcode-tracked products and accepts optional `status`,
`search` (name or barcode), `branchId`, `startDate`, and `endDate` filters.
`GET /api/products/:id` returns product details and activity history matched by
the exact barcode in activity log details or entity IDs. `DELETE /api/products/:id`
removes it and records the action in the activity log. Products use one of the
statuses `pending`, `di_gudang`, `di_toko`, `di_spg`, `di_collecting`,
`terjual`, or `rusak` and belong to a branch.

## Zone details and store routes

The authenticated `GET /api/zones/:id` endpoint returns zone details and its
stores in route order, plus available unassigned stores from the zone's branch.
Zone-store assignments are stored in the `store_zonas` table; adding a store
uses `POST /api/zones/:id/stores` with `{ "storeIds": [1, 2] }` to add one or
more eligible stores atomically. The single-store
`POST /api/zones/:id/stores/:storeId` endpoint is also available. Removing a
store uses
`DELETE /api/zones/:id/stores/:storeId`. Removing a store only detaches it from
the zone; it does not delete the store record.

Each assignment has a `routeIndex`; `PUT /api/zones/:id/stores/order` accepts
`{ "storeIds": [1, 2] }` to save a reordered list. The request must include
every store currently assigned to the zone exactly once. Migration startup
copies existing `stores.zonaId` assignments into `store_zonas`.

The Detail Zona route tab embeds OpenStreetMap tiles and requests a driving
route from the public OSRM endpoint in saved store order. Store coordinates
are sent to that routing service when the route map is opened.

## Telegram AI bot

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `OPENAI_API_KEY` in
the API environment. The webhook uses `OPENAI_MODEL` (default
`gpt-4o-mini`) and an optional `OPENAI_SYSTEM_PROMPT`. It sends each incoming
text message to OpenAI and sends the reply back to the same Telegram chat.
Non-text updates and messages sent by bots are acknowledged without a reply.
The webhook does not require user authentication; it validates Telegram's
`X-Telegram-Bot-Api-Secret-Token` header. Generate the webhook secret with
`openssl rand -hex 32` and use the same value when registering the webhook.
Requests are limited to 50 per rolling minute for each Telegram sender and
client IP pair; excess requests receive HTTP 429 and a `Retry-After` header.
The limiter is in-memory and applies per API process.

After deploying the API at a publicly reachable HTTPS URL, register the
webhook with Telegram:

```sh
curl --fail-with-body \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=https://your-api.example.com/api/telegram/webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

## API documentation

With the API running, open `http://localhost:4000/api-docs` for the interactive
Swagger UI, or `http://localhost:4000/api-docs.json` to retrieve the OpenAPI
specification.
