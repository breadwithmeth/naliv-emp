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

type TraccarDevice = {
  id: number;
  uniqueId: string;
};

type TraccarPosition = {
  deviceId: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  fixTime?: string;
  serverTime?: string;
  deviceTime?: string;
  attributes?: Record<string, unknown>;
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
        // Even if device already exists (409), we still bind tracker locally.
        await prisma.employeeTracker.upsert({
          where: { employeeId: emp.id },
          create: { employeeId: emp.id, tid: uniqueId },
          update: { tid: uniqueId }
        });
        results.push({ employeeId: emp.id, created: created.created, conflict: created.conflict ?? undefined });
      } catch (err) {
        results.push({ employeeId: emp.id, created: false, error: (err as Error).message });
      }
    }

    return results;
  }

  private async fetchDevices(): Promise<TraccarDevice[]> {
    const res = await fetch(`${env.TRACCAR_BASE_URL}/api/devices`, {
      method: 'GET',
      headers: this.authHeaders()
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch traccar devices (${res.status}): ${text}`);
    }

    return (await res.json()) as TraccarDevice[];
  }

  private async fetchLatestPosition(deviceId: number): Promise<TraccarPosition | null> {
    const res = await fetch(`${env.TRACCAR_BASE_URL}/api/positions?deviceId=${deviceId}`, {
      method: 'GET',
      headers: this.authHeaders()
    });

    if (res.status === 204) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch traccar positions (${res.status}): ${text}`);
    }

    const items = (await res.json()) as TraccarPosition[];
    if (!Array.isArray(items) || items.length === 0) {
      return null;
    }

    const first = items[0];
    if (!first) {
      return null;
    }

    return first;
  }

  private pickTimestamp(position: TraccarPosition): Date {
    const source = position.deviceTime || position.fixTime || position.serverTime || new Date().toISOString();
    return new Date(source);
  }

  async pollPositionsAndStore() {
    const devices = await this.fetchDevices();
    if (!devices.length) {
      return [] as { deviceId: number; tid: string; stored: boolean; reason?: string; error?: string }[];
    }

    const tids = devices.map((d) => d.uniqueId).filter(Boolean);
    const trackers = await prisma.employeeTracker.findMany({
      where: { tid: { in: tids } },
      select: { employeeId: true, tid: true }
    });

    const trackerMap = new Map(trackers.map((t) => [t.tid, t.employeeId]));

    const results: { deviceId: number; tid: string; stored: boolean; reason?: string; error?: string }[] = [];

    for (const device of devices) {
      const employeeId = trackerMap.get(device.uniqueId);
      if (!employeeId) {
        results.push({ deviceId: device.id, tid: device.uniqueId, stored: false, reason: 'no_employee_tracker' });
        continue;
      }

      try {
        const pos = await this.fetchLatestPosition(device.id);
        if (!pos || pos.latitude === undefined || pos.longitude === undefined) {
          results.push({ deviceId: device.id, tid: device.uniqueId, stored: false, reason: 'no_position' });
          continue;
        }

        const tst = this.pickTimestamp(pos);
        const acc = pos.accuracy ?? (pos.attributes?.accuracy as number | undefined) ?? null;

        const last = await prisma.locationPing.findFirst({
          where: { employeeId },
          orderBy: { tst: 'desc' },
          select: { lat: true, lon: true, tst: true }
        });

        if (last && last.lat === pos.latitude && last.lon === pos.longitude && Math.abs(last.tst.getTime() - tst.getTime()) < 1000) {
          results.push({ deviceId: device.id, tid: device.uniqueId, stored: false, reason: 'unchanged' });
          continue;
        }

        await prisma.$transaction([
          prisma.locationPing.create({
            data: {
              employeeId,
              tid: device.uniqueId,
              topic: null,
              lat: pos.latitude,
              lon: pos.longitude,
              acc,
              conn: null,
              event: null,
              tst,
              raw: pos as Prisma.InputJsonValue
            }
          }),
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

        results.push({ deviceId: device.id, tid: device.uniqueId, stored: true });
      } catch (err) {
        results.push({ deviceId: device.id, tid: device.uniqueId, stored: false, error: (err as Error).message });
      }
    }

    return results;
  }
}

export const traccarService = new TraccarService();
