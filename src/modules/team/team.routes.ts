import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { validateSchema } from '../../middleware/validate';
import { teamService } from './team.service';

const bodySchema = z.object({
  name: z.string().min(1)
});

export async function teamRoutes(app: FastifyInstance): Promise<void> {
  app.post('/internal/teams', async (request, reply) => {
    const { name } = validateSchema(bodySchema, request.body);
    const team = await teamService.createTeam(name);
    return reply.status(201).send(team);
  });

  app.get('/internal/teams', async (_request, reply) => {
    const teams = await teamService.listTeams();
    return reply.status(200).send(teams);
  });
}
