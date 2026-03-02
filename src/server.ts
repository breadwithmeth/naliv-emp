import { buildApp } from './app';
import { env } from './config/env';
import { prisma } from './prisma/client';
import { presenceService } from './modules/presence/presence.service';

async function bootstrap() {
  const app = await buildApp();

  const idleThresholdMs = env.PRESENCE_IDLE_MINUTES * 60_000;
  const sweepIntervalMs = env.PRESENCE_SWEEP_INTERVAL_MS;

  const runPresenceSweep = async () => {
    const cutoff = new Date(Date.now() - idleThresholdMs);

    try {
      const affected = await presenceService.autoOfflineStale(cutoff);
      if (affected > 0) {
        app.log.info({ affected }, 'Presence auto-offline sweep applied');
      }
    } catch (err) {
      app.log.error({ err }, 'Presence auto-offline sweep failed');
    }
  };

  const sweepTimer = setInterval(() => {
    void runPresenceSweep();
  }, sweepIntervalMs);

  app.addHook('onClose', async () => {
    clearInterval(sweepTimer);
  });

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
