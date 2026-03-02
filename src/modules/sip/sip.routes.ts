import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateSchema } from '../../middleware/validate';
import { sipService } from './sip.service';

const idParamSchema = z.object({
  id: z.string().uuid()
});

const enableBodySchema = z.object({
  extension: z.string().min(1),
  password: z.string().min(8)
});

export async function sipRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/internal/employees/:id/sip/enable', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const { extension, password } = validateSchema(enableBodySchema, request.body);
    const result = await sipService.enableSip(id, extension, password);
    return reply.status(200).send(result);
  });

  app.patch('/internal/employees/:id/sip/disable', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const result = await sipService.disableSip(id);
    return reply.status(200).send(result);
  });

  app.patch('/internal/employees/:id/sip/rotate', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const result = await sipService.rotateSipPassword(id);
    return reply.status(200).send(result);
  });
}
