import { buildApp } from './app';
import { env } from './config/env';
import { prisma } from './prisma/client';
import { presenceService } from './modules/presence/presence.service';
import { traccarService } from './modules/traccar/traccar.service';

async function bootstrap() {
  const app = await buildApp();

  const idleThresholdMs = env.PRESENCE_IDLE_MINUTES * 60_000;
  const sweepIntervalMs = env.PRESENCE_SWEEP_INTERVAL_MS;
  const traccarSyncIntervalMs = env.TRACCAR_SYNC_INTERVAL_MS;

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

  const runTraccarSync = async () => {
    try {
      const results = await traccarService.syncDevicesForGeoEmployees();
      const created = results.filter((r) => r.created).length;
      const conflicts = results.filter((r) => r.conflict).length;
      const errors = results.filter((r) => r.error).length;

      app.log.info({ created, conflicts, errors }, 'Traccar sync executed');
    } catch (err) {
      app.log.error({ err }, 'Traccar sync failed');
    }
  };

  const traccarSyncTimer = setInterval(() => {
    void runTraccarSync();
  }, traccarSyncIntervalMs);

  app.addHook('onClose', async () => {
    clearInterval(sweepTimer);
    clearInterval(traccarSyncTimer);
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
