import { PresenceStatus, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { presenceService } from '../presence/presence.service';

export type OwnTracksPayload = {
  _type: string;
  tid?: string | undefined;
  topic?: string | undefined;
  tst?: number | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  acc?: number | undefined;
  conn?: string | undefined;
  event?: string | undefined;
  username?: string | undefined;
};

export class OwnTracksService {
  async handlePing(payload: OwnTracksPayload) {
    const tid = payload.tid;
    const tst = payload.tst;
    const lat = payload.lat;
    const lon = payload.lon;

    if (!tid || lat === undefined || lon === undefined || tst === undefined) {
      return { stored: false, reason: 'missing_fields' };
    }

    const tracker = await prisma.employeeTracker.findUnique({
      where: { tid },
      select: { employeeId: true }
    });

    if (!tracker) {
      return { stored: false, reason: 'unknown_tid' };
    }

    const employeeId = tracker.employeeId;

    await prisma.$transaction([
      prisma.locationPing.create({
        data: {
          employeeId,
          tid,
          topic: payload.topic ?? null,
          lat,
          lon,
          acc: payload.acc ?? null,
          conn: payload.conn ?? null,
          event: payload.event ?? null,
          tst: new Date(tst * 1000),
          raw: payload as Prisma.InputJsonValue
        }
      }),
      // Update presence to ONLINE on ping
      prisma.presence.upsert({
        where: { employeeId },
        create: { employeeId, status: PresenceStatus.ONLINE },
        update: { status: PresenceStatus.ONLINE }
      }),
      prisma.presenceHistory.create({
        data: {
          employeeId,
          status: PresenceStatus.ONLINE
        }
      })
    ]);

    return { stored: true, employeeId };
  }
}

export const ownTracksService = new OwnTracksService();
