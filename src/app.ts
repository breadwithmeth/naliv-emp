import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { logger } from './lib/logger';
import { registerErrorHandler } from './middleware/errorHandler';
import { serviceAuth } from './middleware/serviceAuth';
import { employeeRoutes } from './modules/employee/employee.routes';
import { shiftRoutes } from './modules/shift/shift.routes';
import { presenceRoutes } from './modules/presence/presence.routes';
import { sipRoutes } from './modules/sip/sip.routes';
import { teamRoutes } from './modules/team/team.routes';
import { publicRoutes } from './modules/public/public.routes';

export async function buildApp() {
  const app = Fastify({
    loggerInstance: logger,
    trustProxy: true,
    disableRequestLogging: false
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW,
    allowList: []
  });

  app.addHook('onRequest', serviceAuth);

  registerErrorHandler(app);

  await app.register(publicRoutes);

  await app.register(employeeRoutes);
  await app.register(shiftRoutes);
  await app.register(presenceRoutes);
  await app.register(sipRoutes);
  await app.register(teamRoutes);

  return app;
}
