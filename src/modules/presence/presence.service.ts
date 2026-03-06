import { PresenceStatus } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../lib/errors';

export class PresenceService {
  async setPresence(employeeId: string, status: PresenceStatus) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, isActive: true }
    });

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }

    if (!employee.isActive) {
      throw new AppError(403, 'EMPLOYEE_INACTIVE', 'Employee is inactive');
    }

    const existingPresence = await prisma.presence.findUnique({
      where: { employeeId },
      select: { status: true }
    });

    if (existingPresence?.status === status) {
      // Touch record to refresh updatedAt for heartbeat, but skip history when status unchanged.
      return prisma.presence.update({
        where: { employeeId },
        data: { status }
      });
    }

    return prisma.$transaction(async (tx) => {
      const presence = await tx.presence.upsert({
        where: { employeeId },
        create: {
          employeeId,
          status
        },
        update: {
          status
        }
      });

      await tx.presenceHistory.create({
        data: {
          employeeId,
          status
        }
      });

      return presence;
    });
  }

  async autoOfflineStale(cutoff: Date) {
    const stale = await prisma.presence.findMany({
      where: {
        status: {
          not: PresenceStatus.OFFLINE
        },
        updatedAt: {
          lt: cutoff
        }
      },
      select: {
        employeeId: true
      }
    });

    if (stale.length === 0) {
      return 0;
    }

    await prisma.$transaction(
      stale.flatMap(({ employeeId }) => [
        prisma.presence.update({
          where: { employeeId },
          data: { status: PresenceStatus.OFFLINE }
        }),
        prisma.presenceHistory.create({
          data: {
            employeeId,
            status: PresenceStatus.OFFLINE
          }
        })
      ])
    );

    return stale.length;
  }

  async getHistory(employeeId: string, limit = 100, from?: Date, to?: Date) {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }

    return prisma.presenceHistory.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      ...(from || to
        ? {
            where: {
              employeeId,
              createdAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {})
              }
            }
          }
        : {}),
      take: limit
    });
  }
}

export const presenceService = new PresenceService();
