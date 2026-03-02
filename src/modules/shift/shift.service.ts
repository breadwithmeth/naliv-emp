import { PresenceStatus, ShiftStatus } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../lib/errors';

export class ShiftService {
  async startShift(employeeId: string) {
    return prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, isActive: true }
      });

      if (!employee) {
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
      }

      if (!employee.isActive) {
        throw new AppError(403, 'EMPLOYEE_INACTIVE', 'Employee is inactive');
      }

      const activeShift = await tx.shift.findFirst({
        where: {
          employeeId,
          status: ShiftStatus.ACTIVE
        },
        select: { id: true }
      });

      if (activeShift) {
        throw new AppError(409, 'ACTIVE_SHIFT_EXISTS', 'Active shift already exists');
      }

      const shift = await tx.shift.create({
        data: {
          employeeId,
          status: ShiftStatus.ACTIVE
        }
      });

      await tx.presence.upsert({
        where: { employeeId },
        create: {
          employeeId,
          status: PresenceStatus.ONLINE
        },
        update: {
          status: PresenceStatus.ONLINE
        }
      });

      return shift;
    });
  }

  async stopShift(employeeId: string) {
    return prisma.$transaction(async (tx) => {
      const activeShift = await tx.shift.findFirst({
        where: {
          employeeId,
          status: ShiftStatus.ACTIVE
        }
      });

      if (!activeShift) {
        throw new AppError(404, 'ACTIVE_SHIFT_NOT_FOUND', 'No active shift found');
      }

      const shift = await tx.shift.update({
        where: { id: activeShift.id },
        data: {
          status: ShiftStatus.CLOSED,
          endedAt: new Date()
        }
      });

      await tx.presence.upsert({
        where: { employeeId },
        create: {
          employeeId,
          status: PresenceStatus.OFFLINE
        },
        update: {
          status: PresenceStatus.OFFLINE
        }
      });

      return shift;
    });
  }

  async getEmployeeShifts(employeeId: string) {
    return prisma.shift.findMany({
      where: { employeeId },
      orderBy: { startedAt: 'desc' }
    });
  }
}

export const shiftService = new ShiftService();
