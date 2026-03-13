import { PresenceStatus, ShiftStatus } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../lib/errors';
import { employeeService } from '../employee/employee.service';

export class ShiftService {
  private async resolveEmployeeRef(employeeRef: string) {
    let employee = await prisma.employee.findFirst({
      where: {
        OR: [{ id: employeeRef }, { keycloakId: employeeRef }]
      },
      select: { id: true, isActive: true }
    });

    if (!employee) {
      const ensured = await employeeService.ensureEmployeeByKeycloakId(employeeRef);
      employee = { id: ensured.id, isActive: ensured.isActive };
    }

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }

    return employee;
  }

  async startShift(employeeId: string) {
    return prisma.$transaction(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: {
          OR: [{ id: employeeId }, { keycloakId: employeeId }]
        },
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
          employeeId: employee.id,
          status: ShiftStatus.ACTIVE
        },
        select: { id: true }
      });

      if (activeShift) {
        throw new AppError(409, 'ACTIVE_SHIFT_EXISTS', 'Active shift already exists');
      }

      const shift = await tx.shift.create({
        data: {
          employeeId: employee.id,
          status: ShiftStatus.ACTIVE
        }
      });

      await tx.presence.upsert({
        where: { employeeId: employee.id },
        create: {
          employeeId: employee.id,
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
    const employee = await this.resolveEmployeeRef(employeeId);

    return prisma.$transaction(async (tx) => {
      const activeShift = await tx.shift.findFirst({
        where: {
          employeeId: employee.id,
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
        where: { employeeId: employee.id },
        create: {
          employeeId: employee.id,
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
    const employee = await this.resolveEmployeeRef(employeeId);

    return prisma.shift.findMany({
      where: { employeeId: employee.id },
      orderBy: { startedAt: 'desc' }
    });
  }
}

export const shiftService = new ShiftService();
