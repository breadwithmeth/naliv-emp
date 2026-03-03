import { PresenceStatus, Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { env } from '../../config/env';

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
  private authHeaders() {
    const basic = Buffer.from(`${env.TRACCAR_BASIC_USER}:${env.TRACCAR_BASIC_PASS}`).toString('base64');
    return {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json'
    } as const;
  }

  private deviceNameForEmployee(emp: { name: string | null; email: string | null; username: string | null }) {
    return emp.name || emp.email || emp.username || 'Employee device';
  }

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

  async createDevice(name: string, uniqueId: string) {
    const res = await fetch(`${env.TRACCAR_BASE_URL}/api/devices`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: JSON.stringify({ name, uniqueId })
    });

    if (res.status === 409) {
      // Already exists
      return { created: false, conflict: true };
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create traccar device (${res.status}): ${text}`);
    }

    return { created: true };
  }

  async syncDevicesForGeoEmployees() {
    const employees = await prisma.employee.findMany({
      where: {
        positionId: { not: null },
        Position: { requiresGeolocation: true },
        Tracker: null
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true
      }
    });

    const results: { employeeId: string; created: boolean; conflict?: boolean | undefined; error?: string }[] = [];

    for (const emp of employees) {
      const uniqueId = emp.id; // Use employee id as device uniqueId
      const name = this.deviceNameForEmployee(emp);
      try {
        const created = await this.createDevice(name, uniqueId);
        if (!created.conflict) {
          await prisma.employeeTracker.upsert({
            where: { employeeId: emp.id },
            create: { employeeId: emp.id, tid: uniqueId },
            update: { tid: uniqueId }
          });
        }
        results.push({ employeeId: emp.id, created: created.created, conflict: created.conflict ?? undefined });
      } catch (err) {
        results.push({ employeeId: emp.id, created: false, error: (err as Error).message });
      }
    }

    return results;
  }
}

export const traccarService = new TraccarService();
