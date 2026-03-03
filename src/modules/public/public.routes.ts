import { Role, PresenceStatus } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateSchema } from '../../middleware/validate';
import { requireSupervisorOrAdmin } from '../../middleware/publicRoleAuth';
import { employeeService } from '../employee/employee.service';
import { shiftService } from '../shift/shift.service';
import { presenceService } from '../presence/presence.service';
import { teamService } from '../team/team.service';
import { departmentService } from '../department/department.service';
import { positionService } from '../position/position.service';

const employeeIdParamSchema = z.object({
  id: z.string().uuid()
});

const createEmployeeBodySchema = z.object({
  keycloakId: z.string().min(1),
  email: z.string().email().optional(),
  username: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  teamId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  trackerTid: z.string().min(1).optional()
});

const roleBodySchema = z.object({
  role: z.nativeEnum(Role)
});

const presenceBodySchema = z.object({
  status: z.nativeEnum(PresenceStatus)
});

const createTeamBodySchema = z.object({
  name: z.string().min(1)
});

const assignTeamBodySchema = z.object({
  teamId: z.string().uuid()
});

const createDepartmentBodySchema = z.object({
  name: z.string().min(1)
});

const assignDepartmentBodySchema = z.object({
  departmentId: z.string().uuid()
});

const createPositionBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  requiresGeolocation: z.boolean().optional(),
  requiresPhoto: z.boolean().optional()
});

const assignPositionBodySchema = z.object({
  positionId: z.string().uuid()
});

const trackerBodySchema = z.object({
  tid: z.string().min(1)
});

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', requireSupervisorOrAdmin);

  app.get('/public/users', async (_request, reply) => {
    const users = await employeeService.listEmployees();
    return reply.status(200).send(users);
  });

  app.post('/public/users', async (request, reply) => {
    const payload = validateSchema(createEmployeeBodySchema, request.body);
    const user = await employeeService.createEmployee(payload);
    return reply.status(201).send(user);
  });

  app.get('/public/users/:id', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const user = await employeeService.getEmployeeById(id);
    return reply.status(200).send(user);
  });

  app.patch('/public/users/:id/role', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const { role } = validateSchema(roleBodySchema, request.body);
    const user = await employeeService.updateRole(id, role);
    return reply.status(200).send(user);
  });

  app.patch('/public/users/:id/activate', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const user = await employeeService.activateEmployee(id);
    return reply.status(200).send(user);
  });

  app.patch('/public/users/:id/deactivate', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const user = await employeeService.deactivateEmployee(id);
    return reply.status(200).send(user);
  });

  app.post('/public/users/:id/shifts/start', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const shift = await shiftService.startShift(id);
    return reply.status(201).send(shift);
  });

  app.post('/public/users/:id/shifts/stop', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const shift = await shiftService.stopShift(id);
    return reply.status(200).send(shift);
  });

  app.get('/public/users/:id/shifts', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const shifts = await shiftService.getEmployeeShifts(id);
    return reply.status(200).send(shifts);
  });

  app.patch('/public/users/:id/presence', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const { status } = validateSchema(presenceBodySchema, request.body);
    const presence = await presenceService.setPresence(id, status);
    return reply.status(200).send(presence);
  });

  app.post('/public/teams', async (request, reply) => {
    const { name } = validateSchema(createTeamBodySchema, request.body);
    const team = await teamService.createTeam(name);
    return reply.status(201).send(team);
  });

  app.get('/public/teams', async (_request, reply) => {
    const teams = await teamService.listTeams();
    return reply.status(200).send(teams);
  });

  app.patch('/public/users/:id/team', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const { teamId } = validateSchema(assignTeamBodySchema, request.body);
    const user = await employeeService.assignEmployeeToTeam(id, teamId);
    return reply.status(200).send(user);
  });

  app.post('/public/departments', async (request, reply) => {
    const { name } = validateSchema(createDepartmentBodySchema, request.body);
    const department = await departmentService.createDepartment(name);
    return reply.status(201).send(department);
  });

  app.get('/public/departments', async (_request, reply) => {
    const departments = await departmentService.listDepartments();
    return reply.status(200).send(departments);
  });

  app.patch('/public/users/:id/department', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const { departmentId } = validateSchema(assignDepartmentBodySchema, request.body);
    const user = await employeeService.assignEmployeeToDepartment(id, departmentId);
    return reply.status(200).send(user);
  });

  app.post('/public/positions', async (request, reply) => {
    const payload = validateSchema(createPositionBodySchema, request.body);
    const position = await positionService.createPosition({
      name: payload.name,
      description: payload.description ?? null,
      requiresGeolocation: payload.requiresGeolocation ?? false,
      requiresPhoto: payload.requiresPhoto ?? false
    });
    return reply.status(201).send(position);
  });

  app.get('/public/positions', async (_request, reply) => {
    const positions = await positionService.listPositions();
    return reply.status(200).send(positions);
  });

  app.patch('/public/users/:id/position', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const { positionId } = validateSchema(assignPositionBodySchema, request.body);
    const user = await employeeService.assignEmployeeToPosition(id, positionId);
    return reply.status(200).send(user);
  });

  app.patch('/public/users/:id/tracker', async (request, reply) => {
    const { id } = validateSchema(employeeIdParamSchema, request.params);
    const { tid } = validateSchema(trackerBodySchema, request.body);
    const user = await employeeService.setTracker(id, tid);
    return reply.status(200).send(user);
  });
}
