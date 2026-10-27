# OctoSupply API (Python)

FastAPI port of the OctoSupply API.

## Run

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 3000
```

Default API URL: `http://localhost:3000`

## Environment

- `PORT` (used by Makefile/uvicorn command, default `3000`)
- `DB_FILE` (default: `./data/app.db`)
- `API_CORS_ORIGINS` (comma-separated override; optional)
- `DB_MIGRATIONS_DIR` (optional override for migrations directory)

## Database

On startup, the API applies SQL migrations from:

- `../database/migrations/*.sql`

and seeds from:

- `../database/seed/*.sql`

## OpenAPI

- OpenAPI JSON: `http://localhost:3000/openapi.json`
- Swagger UI: `http://localhost:3000/docs`

## Guest carts

The cart API creates a guest cart with `POST /api/carts` and returns its opaque `cartId`.
Clients should retain that ID and use it to retrieve the cart with `GET /api/carts/{cartId}`.

- `POST /api/carts/{cartId}/items` adds the requested quantity to the product's existing line.
- `PUT /api/carts/{cartId}/items/{productId}` sets the line quantity.
- `DELETE /api/carts/{cartId}/items/{productId}` removes the line.

Cart responses include the current discounted unit prices, line totals, item count, and a
server-calculated total rounded to cents. Guest cart IDs are not tied to an authenticated user.
