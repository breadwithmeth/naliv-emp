# Employee Workforce Service

Internal Workforce Control Layer for `bm` and `njt25` service-to-service integration.

## Stack
- Node.js + TypeScript (strict)
- Fastify
- Prisma + PostgreSQL
- Zod
- Pino
- Keycloak service token auth

## Security model
- All endpoints require `Authorization: Bearer <SERVICE_TOKEN>`.
- Only service-to-service tokens are accepted (Keycloak client credentials).
- Token validation uses Keycloak JWK with introspection fallback.
- No browser/public auth endpoints.
- Allowed service audiences are configured via `KEYCLOAK_ALLOWED_AUDIENCE` (CSV), e.g. `naliv-bm,naliv-njt25,naliv-web`.

## Setup
1. Copy env:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
4. Run migrations:
   ```bash
   npm run prisma:migrate:dev
   ```
5. Start dev server:
   ```bash
   npm run dev
   ```

## Internal endpoints
- `POST /internal/employees/sync`
- `POST /internal/employees/sync-keycloak`
- `GET /internal/employees/:keycloakId`
- `GET /internal/employees`
- `POST /internal/employees/:id/shifts/start`
- `POST /internal/employees/:id/shifts/stop`
- `GET /internal/employees/:id/shifts`
- `PATCH /internal/employees/:id/presence`
- `PATCH /internal/employees/:id/role`
- `PATCH /internal/employees/:id/activate`
- `PATCH /internal/employees/:id/deactivate`
- `PATCH /internal/employees/:id/sip/enable`
- `PATCH /internal/employees/:id/sip/disable`
- `PATCH /internal/employees/:id/sip/rotate`
- `POST /internal/teams`
- `GET /internal/teams`
- `PATCH /internal/employees/:id/team`

## Public endpoints
- Require `Authorization: Bearer <USER_JWT>`.
- Access is allowed only for employees with role `ADMIN` or `SUPERVISOR`.
- `GET /public/users`
- `POST /public/users`
- `GET /public/users/:id`
- `PATCH /public/users/:id/role`
- `PATCH /public/users/:id/activate`
- `PATCH /public/users/:id/deactivate`
- `POST /public/users/:id/shifts/start`
- `POST /public/users/:id/shifts/stop`
- `GET /public/users/:id/shifts`
- `PATCH /public/users/:id/presence`
- `POST /public/teams`
- `GET /public/teams`
- `PATCH /public/users/:id/team`
