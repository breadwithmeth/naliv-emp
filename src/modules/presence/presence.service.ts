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

    return prisma.presence.upsert({
      where: { employeeId },
      create: {
        employeeId,
        status
      },
      update: {
        status
      }
    });
  }
}

export const presenceService = new PresenceService();
