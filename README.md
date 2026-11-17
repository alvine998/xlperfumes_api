# XL Perfumes API

Express API using Sequelize with MySQL.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set your MySQL connection values.
3. Start the API with `npm start` (or `npm run dev` for Node's watch mode).

The API listens on port `4000` by default. JSON and URL-encoded request bodies
are limited to `100mb`. CORS allows requests from any origin.

## API documentation

With the API running, open `http://localhost:4000/api-docs` for the interactive
Swagger UI, or `http://localhost:4000/api-docs.json` to retrieve the OpenAPI
specification. The specification documents the current API status endpoint.
