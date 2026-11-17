# XL Perfumes API

Express API using Sequelize with MySQL.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set your MySQL connection values.
3. Generate a random secret (for example, `openssl rand -base64 48`), set it as `JWT_SECRET`, and set `WEB_ORIGIN` to the web app's origin.
4. Create the first administrator by setting `ADMIN_USERNAME` and `ADMIN_PASSWORD`, then run `npm run bootstrap:admin`. This command only works while the users table is empty.
5. Start the API with `npm start` (or `npm run dev` for Node's watch mode).

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

## API documentation

With the API running, open `http://localhost:4000/api-docs` for the interactive
Swagger UI, or `http://localhost:4000/api-docs.json` to retrieve the OpenAPI
specification.
