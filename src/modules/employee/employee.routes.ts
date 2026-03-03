import { FastifyInstance } from 'fastify';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { validateSchema } from '../../middleware/validate';
import { employeeService } from './employee.service';

const syncBodySchema = z.object({
  keycloakId: z.string().min(1),
  email: z.string().email().optional(),
  username: z.string().min(1).optional(),
  ip: z.string().min(1).optional()
});

const idParamSchema = z.object({
  id: z.string().uuid()
});

const keycloakParamSchema = z.object({
  keycloakId: z.string().min(1)
});

const roleBodySchema = z.object({
  role: z.nativeEnum(Role)
});

const teamBodySchema = z.object({
  teamId: z.string().uuid()
});

const departmentBodySchema = z.object({
  departmentId: z.string().uuid()
});

const positionBodySchema = z.object({
  positionId: z.string().uuid()
});

const trackerBodySchema = z.object({
  tid: z.string().min(1)
});

export async function employeeRoutes(app: FastifyInstance): Promise<void> {
  app.post('/internal/employees/sync', async (request, reply) => {
    const payload = validateSchema(syncBodySchema, request.body);
    const employee = await employeeService.syncEmployee(payload);
    return reply.status(200).send(employee);
  });

  app.get('/internal/employees/:keycloakId', async (request, reply) => {
    const { keycloakId } = validateSchema(keycloakParamSchema, request.params);
    const employee = await employeeService.getEmployeeByKeycloakId(keycloakId);
    return reply.status(200).send(employee);
  });

  app.get('/internal/employees', async (_request, reply) => {
    const employees = await employeeService.listEmployees();
    return reply.status(200).send(employees);
  });

  app.patch('/internal/employees/:id/role', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const { role } = validateSchema(roleBodySchema, request.body);
    const employee = await employeeService.updateRole(id, role);
    return reply.status(200).send(employee);
  });

  app.patch('/internal/employees/:id/activate', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const employee = await employeeService.activateEmployee(id);
    return reply.status(200).send(employee);
  });

  app.patch('/internal/employees/:id/deactivate', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const employee = await employeeService.deactivateEmployee(id);
    return reply.status(200).send(employee);
  });

  app.patch('/internal/employees/:id/team', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const { teamId } = validateSchema(teamBodySchema, request.body);
    const employee = await employeeService.assignEmployeeToTeam(id, teamId);
    return reply.status(200).send(employee);
  });

  app.patch('/internal/employees/:id/department', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const { departmentId } = validateSchema(departmentBodySchema, request.body);
    const employee = await employeeService.assignEmployeeToDepartment(id, departmentId);
    return reply.status(200).send(employee);
  });

  app.patch('/internal/employees/:id/position', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const { positionId } = validateSchema(positionBodySchema, request.body);
    const employee = await employeeService.assignEmployeeToPosition(id, positionId);
    return reply.status(200).send(employee);
  });

  app.patch('/internal/employees/:id/tracker', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const { tid } = validateSchema(trackerBodySchema, request.body);
    const employee = await employeeService.setTracker(id, tid);
    return reply.status(200).send(employee);
  });
}
