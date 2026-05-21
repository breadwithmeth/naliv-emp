import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateSchema } from '../../middleware/validate';
import { shiftService } from './shift.service';

const idParamSchema = z.object({
  id: z.string().min(1)
});

const listShiftsQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export async function shiftRoutes(app: FastifyInstance): Promise<void> {
  app.get('/internal/shifts', async (request, reply) => {
    const { employeeId, from, to } = validateSchema(listShiftsQuerySchema, request.query ?? {});
    const filters = {
      ...(employeeId ? { employeeId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {})
    };
    const shifts = await shiftService.getAllShifts(filters);
    return reply.status(200).send(shifts);
  });

  app.post('/internal/employees/:id/shifts/start', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const shift = await shiftService.startShift(id);
    return reply.status(201).send(shift);
  });

  app.post('/internal/employees/:id/shifts/stop', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const shift = await shiftService.stopShift(id);
    return reply.status(200).send(shift);
  });

  app.get('/internal/employees/:id/shifts', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const shifts = await shiftService.getEmployeeShifts(id);
    return reply.status(200).send(shifts);
  });
}
