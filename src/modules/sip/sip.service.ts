import bcrypt from 'bcrypt';
import { prisma } from '../../prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../lib/errors';

function assertNumericExtension(extension: string): void {
  if (!/^\d+$/.test(extension)) {
    throw new AppError(400, 'INVALID_EXTENSION', 'SIP extension must be numeric');
  }
}

function generateRandomSipPassword(length = 20): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_+-=';
  let result = '';

  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars[idx];
  }

  return result;
}

export class SipService {
  async enableSip(employeeId: string, extension: string, password: string) {
    assertNumericExtension(extension);

    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }

    const hashed = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    try {
      return await prisma.employee.update({
        where: { id: employeeId },
        data: {
          sipExtension: extension,
          sipUsername: extension,
          sipPassword: hashed,
          sipEnabled: true,
          failedSipAttempts: 0
        },
        select: {
          id: true,
          sipExtension: true,
          sipUsername: true,
          sipEnabled: true,
          updatedAt: true
        }
      });
    } catch {
      throw new AppError(409, 'SIP_CONFLICT', 'SIP extension or username already in use');
    }
  }

  async disableSip(employeeId: string) {
    try {
      return await prisma.employee.update({
        where: { id: employeeId },
        data: {
          sipEnabled: false,
          sipPassword: null,
          failedSipAttempts: 0
        },
        select: {
          id: true,
          sipExtension: true,
          sipUsername: true,
          sipEnabled: true,
          updatedAt: true
        }
      });
    } catch {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }
  }

  async rotateSipPassword(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        sipEnabled: true
      }
    });

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }

    if (!employee.sipEnabled) {
      throw new AppError(400, 'SIP_DISABLED', 'SIP is not enabled');
    }

    const rawPassword = generateRandomSipPassword();
    const hashed = await bcrypt.hash(rawPassword, env.BCRYPT_ROUNDS);

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        sipPassword: hashed,
        failedSipAttempts: 0,
        tokenVersion: {
          increment: 1
        }
      }
    });

    return {
      employeeId,
      rotated: true,
      password: rawPassword
    };
  }
}

export const sipService = new SipService();
