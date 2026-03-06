# Internal API Endpoints

Service-to-service endpoints. All calls require a Bearer token (realm role `employee-service-access`) issued for the service client. Base URL: `http://localhost:3005`.

## Employees
- `POST /internal/employees/sync` — upsert by `keycloakId`; body `{ keycloakId, email?, username?, ip? }`
- `GET /internal/employees/:keycloakId` — get by Keycloak ID
- `GET /internal/employees` — list employees (для доступа, например, сервису njt25)
- `PATCH /internal/employees/:id/role` — set role; body `{ role }`
- `PATCH /internal/employees/:id/activate` — activate
- `PATCH /internal/employees/:id/deactivate` — deactivate
- `PATCH /internal/employees/:id/team` — assign team; body `{ teamId }`
- `PATCH /internal/employees/:id/department` — assign department; body `{ departmentId }`
- `PATCH /internal/employees/:id/position` — assign position; body `{ positionId }`
- `PATCH /internal/employees/:id/tracker` — set tracker id; body `{ tid }`
- `GET /internal/employees/:id/presence-history?limit=&from=&to=` — presence history

## Presence
- `PATCH /internal/employees/:id/presence` — set presence; body `{ status }` (ONLINE | OFFLINE | BUSY | AWAY)

## Shifts
- `POST /internal/employees/:id/shifts/start` — start shift
	- params: `id` — employee UUID
	- body: none
	- success: 201 + `Shift { id, employeeId, startedAt, endedAt: null, status: ACTIVE }`
	- errors: 404 `EMPLOYEE_NOT_FOUND`, 403 `EMPLOYEE_INACTIVE`, 409 `ACTIVE_SHIFT_EXISTS`
	- side effect: Presence set to `ONLINE`
- `POST /internal/employees/:id/shifts/stop` — stop active shift
	- params: `id` — employee UUID
	- body: none
	- success: 200 + `Shift { id, employeeId, startedAt, endedAt, status: CLOSED }`
	- errors: 404 `ACTIVE_SHIFT_NOT_FOUND`
	- side effect: Presence set to `OFFLINE`
- `GET /internal/employees/:id/shifts` — list shifts (desc by startedAt)
	- params: `id` — employee UUID
	- success: 200 + `Shift[]`
	- body: none

## SIP
- `PATCH /internal/employees/:id/sip/enable` — enable SIP; body `{ extension, password }`
- `PATCH /internal/employees/:id/sip/disable` — disable SIP
- `PATCH /internal/employees/:id/sip/rotate` — rotate SIP password

## Teams
- `POST /internal/teams` — create team; body `{ name }`
- `GET /internal/teams` — list teams

## Positions
- `POST /internal/positions` — create position; body `{ name, description?, requiresGeolocation?, requiresPhoto? }`
- `GET /internal/positions` — list positions

## Traccar
- `POST /internal/traccar/sync-devices` — sync devices for geo-enabled employees

---
Source: [src/app.ts](../src/app.ts), [src/modules/employee/employee.routes.ts](../src/modules/employee/employee.routes.ts), [src/modules/shift/shift.routes.ts](../src/modules/shift/shift.routes.ts), [src/modules/presence/presence.routes.ts](../src/modules/presence/presence.routes.ts), [src/modules/sip/sip.routes.ts](../src/modules/sip/sip.routes.ts), [src/modules/team/team.routes.ts](../src/modules/team/team.routes.ts), [src/modules/position/position.routes.ts](../src/modules/position/position.routes.ts), [src/modules/traccar/traccar.routes.ts](../src/modules/traccar/traccar.routes.ts)
