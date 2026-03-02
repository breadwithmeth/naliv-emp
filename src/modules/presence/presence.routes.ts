import { FastifyInstance } from 'fastify';
import { PresenceStatus } from '@prisma/client';
import { z } from 'zod';
import { validateSchema } from '../../middleware/validate';
import { presenceService } from './presence.service';

const idParamSchema = z.object({
  id: z.string().uuid()
});

const bodySchema = z.object({
  status: z.nativeEnum(PresenceStatus)
});

export async function presenceRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/internal/employees/:id/presence', async (request, reply) => {
    const { id } = validateSchema(idParamSchema, request.params);
    const { status } = validateSchema(bodySchema, request.body);

    const presence = await presenceService.setPresence(id, status);
    return reply.status(200).send(presence);
  });
}
