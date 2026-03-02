import { buildApp } from './app';
import { env } from './config/env';
import { prisma } from './prisma/client';

async function bootstrap() {
  const app = await buildApp();

  const gracefulShutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down workforce service');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });

    app.log.info({ port: env.PORT, host: env.HOST }, 'Workforce service started');
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start service');
    await prisma.$disconnect();
    process.exit(1);
  }
}

void bootstrap();
