import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { traccarService } from './traccar.service';
import { AppError } from '../../lib/errors';
import { env } from '../../config/env';

const traccarSchema = z.object({
  id: z.number().optional(),
  deviceId: z.number().optional(),
  uniqueId: z.string().min(1).optional(),
  fixTime: z.string().min(1).optional(),
  serverTime: z.string().optional(),
  deviceTime: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracy: z.number().optional(),
  speed: z.number().optional(),
  attributes: z.record(z.any()).optional()
});

function checkBasicAuth(authorization?: string) {
  if (!authorization || !authorization.startsWith('Basic ')) {
    throw new AppError(401, 'UNAUTHORIZED', 'Basic auth required');
  }

  const token = authorization.substring('Basic '.length);
  const decoded = Buffer.from(token, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');

  if (!user || !pass) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid basic credentials');
  }

  if (user !== env.TRACCAR_BASIC_USER || pass !== env.TRACCAR_BASIC_PASS) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid basic credentials');
  }
}

export async function traccarRoutes(app: FastifyInstance): Promise<void> {
  app.post('/traccar/hook', async (request, reply) => {
    checkBasicAuth(request.headers.authorization);

    const payload = traccarSchema.parse(request.body ?? {});

    const result = await traccarService.handlePing(payload);

    if (!result.stored) {
      return reply.status(202).send({ status: 'ignored', reason: result.reason });
    }

    return reply.status(200).send({ status: 'ok' });
  });

  app.post('/internal/traccar/sync-devices', async (_request, reply) => {
    const results = await traccarService.syncDevicesForGeoEmployees();
    return reply.status(200).send({ synced: results });
  });
}
