import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../prisma/client';
import { validateSchema } from '../../middleware/validate';

const querySchema = z.object({
  windowSeconds: z.coerce.number().int().positive().max(3600).default(30)
});

export async function locationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/internal/locations/latest', async (request, reply) => {
    const { windowSeconds = 30 } = validateSchema(querySchema, request.query ?? {});

    const since = new Date(Date.now() - windowSeconds * 1000);

    const pings = await prisma.locationPing.findMany({
      where: { tst: { gte: since } },
      orderBy: [
        { employeeId: 'asc' },
        { tst: 'desc' }
      ],
      select: {
        employeeId: true,
        tid: true,
        lat: true,
        lon: true,
        acc: true,
        tst: true
      }
    });

    const latestMap = new Map<string, typeof pings[number]>();
    for (const ping of pings) {
      if (!latestMap.has(ping.employeeId)) {
        latestMap.set(ping.employeeId, ping);
      }
    }

    return reply.status(200).send(Array.from(latestMap.values()));
  });
}
