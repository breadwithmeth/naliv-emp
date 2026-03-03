import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ownTracksService } from './owntracks.service';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';

const ownTracksBodySchema = z.object({
  _type: z.string(),
  tid: z.string().optional(),
  topic: z.string().optional(),
  tst: z.number().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  acc: z.number().optional(),
  conn: z.string().optional(),
  event: z.string().optional(),
  username: z.string().optional()
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

  if (user !== env.OWNTRACKS_BASIC_USER || pass !== env.OWNTRACKS_BASIC_PASS) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid basic credentials');
  }
}

export async function ownTracksRoutes(app: FastifyInstance): Promise<void> {
  app.post('/owntracks/hook', async (request, reply) => {
    checkBasicAuth(request.headers.authorization);

    const payload = ownTracksBodySchema.parse(request.body ?? {});

    const result = await ownTracksService.handlePing(payload);

    if (!result.stored) {
      return reply.status(202).send({ status: 'ignored', reason: result.reason });
    }

    return reply.status(200).send({ status: 'ok' });
  });
}
