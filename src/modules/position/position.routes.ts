import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateSchema } from '../../middleware/validate';
import { positionService } from './position.service';

const createPositionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1).optional(),
  requiresGeolocation: z.boolean().optional(),
  requiresPhoto: z.boolean().optional()
});

export async function positionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/internal/positions', async (request, reply) => {
    const payload = validateSchema(createPositionSchema, request.body);
    const position = await positionService.createPosition({
      name: payload.name,
      description: payload.description ?? null,
      requiresGeolocation: payload.requiresGeolocation ?? false,
      requiresPhoto: payload.requiresPhoto ?? false
    });
    return reply.status(201).send(position);
  });

  app.get('/internal/positions', async (_request, reply) => {
    const positions = await positionService.listPositions();
    return reply.status(200).send(positions);
  });
}
