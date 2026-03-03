import { PresenceStatus, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';

export type TraccarPayload = {
  id?: number | undefined;
  deviceId?: number | undefined;
  uniqueId?: string | undefined;
  fixTime?: string | undefined;
  serverTime?: string | undefined;
  deviceTime?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  accuracy?: number | undefined;
  speed?: number | undefined;
  attributes?: Record<string, unknown> | undefined;
};

export class TraccarService {
  async handlePing(payload: TraccarPayload) {
    const tid = payload.uniqueId;
    const lat = payload.latitude;
    const lon = payload.longitude;
    const fixTime = payload.fixTime;

    if (!tid || lat === undefined || lon === undefined || !fixTime) {
      return { stored: false, reason: 'missing_fields' };
    }

    const tracker = await prisma.employeeTracker.findUnique({ where: { tid }, select: { employeeId: true } });
    if (!tracker) {
      return { stored: false, reason: 'unknown_tid' };
    }

    const tst = new Date(fixTime);
    const acc = payload.accuracy ?? (payload.attributes?.accuracy as number | undefined) ?? null;

    await prisma.$transaction([
      prisma.locationPing.create({
        data: {
          employeeId: tracker.employeeId,
          tid,
          topic: null,
          lat,
          lon,
          acc,
          conn: null,
          event: null,
          tst,
          raw: payload as Prisma.InputJsonValue
        }
      }),
      prisma.presence.upsert({
        where: { employeeId: tracker.employeeId },
        create: { employeeId: tracker.employeeId, status: PresenceStatus.ONLINE },
        update: { status: PresenceStatus.ONLINE }
      }),
      prisma.presenceHistory.create({
        data: {
          employeeId: tracker.employeeId,
          status: PresenceStatus.ONLINE
        }
      })
    ]);

    return { stored: true, employeeId: tracker.employeeId };
  }
}

export const traccarService = new TraccarService();
