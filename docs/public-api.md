# Public API Endpoints

All endpoints require a Bearer token with realm role `employee-service-access` (ADMIN or SUPERVISOR) unless stated otherwise.
Base URL: `http://localhost:3005`

## Users
- `GET /public/users` — list users
- `POST /public/users` — create user
  - body: `{(email+password), email?, username?, name?, role?, isActive?, teamId?, departmentId?, positionId?, trackerTid?, password? }`
  - Если `keycloakId` не указан, при наличии `email+password` пользователь создается в Keycloak автоматически.
- `GET /public/users/:id` — user by id
- `PATCH /public/users/:id/role` — update role
  - body: `{ role }`
- `PATCH /public/users/:id/activate` — activate
- `PATCH /public/users/:id/deactivate` — deactivate

## Shifts
- `POST /public/users/:id/shifts/start` — start shift
- `POST /public/users/:id/shifts/stop` — stop shift
- `GET /public/users/:id/shifts` — list shifts

## Presence
- `PATCH /public/users/:id/presence` — set presence
  - body: `{ status }` (ONLINE | OFFLINE | IDLE)

## Teams
- `POST /public/teams` — create team
  - body: `{ name }`
- `GET /public/teams` — list teams
- `PATCH /public/users/:id/team` — assign team
  - body: `{ teamId }`

## Departments
- `POST /public/departments` — create department
  - body: `{ name }`
- `GET /public/departments` — list departments
- `PATCH /public/users/:id/department` — assign department
  - body: `{ departmentId }`

## Positions
- `POST /public/positions` — create position
  - body: `{ name, description?, requiresGeolocation?, requiresPhoto? }`
- `GET /public/positions` — list positions
- `PATCH /public/users/:id/position` — assign position
  - body: `{ positionId }`

## Tracker
- `PATCH /public/users/:id/tracker` — set tracker identifier
  - body: `{ tid }`

---
Source: [`src/modules/public/public.routes.ts`](../src/modules/public/public.routes.ts)
