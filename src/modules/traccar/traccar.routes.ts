import { FastifyInstance } from 'fastify';
import { traccarService } from './traccar.service';

export async function traccarRoutes(app: FastifyInstance): Promise<void> {
  app.post('/internal/traccar/sync-devices', async (_request, reply) => {
    const results = await traccarService.syncDevicesForGeoEmployees();
    return reply.status(200).send({ synced: results });
  });
}
