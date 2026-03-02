import { Role } from '@prisma/client';
import { prisma } from '../../prisma/client';
import { AppError } from '../../lib/errors';

const employeePublicSelect = {
  id: true,
  keycloakId: true,
  email: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  teamId: true,
  sipExtension: true,
  sipUsername: true,
  sipEnabled: true,
  tokenVersion: true,
  failedSipAttempts: true,
  lastLoginAt: true,
  lastIp: true,
  createdAt: true,
  updatedAt: true,
  Team: {
    select: {
      id: true,
      name: true,
      createdAt: true
    }
  },
  Presence: {
    select: {
      id: true,
      status: true,
      updatedAt: true
    }
  }
} as const;

export type SyncEmployeeInput = {
  keycloakId: string;
  email?: string | undefined;
  username?: string | undefined;
  ip?: string | undefined;
};

export type CreateEmployeeInput = {
  keycloakId: string;
  email?: string | undefined;
  username?: string | undefined;
  name?: string | undefined;
  role?: Role | undefined;
  isActive?: boolean | undefined;
  teamId?: string | undefined;
};

export class EmployeeService {
  async createEmployee(input: CreateEmployeeInput) {
    if (input.teamId) {
      const team = await prisma.team.findUnique({ where: { id: input.teamId }, select: { id: true } });
      if (!team) {
        throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
      }
    }

    const data: {
      keycloakId: string;
      email?: string | null;
      username?: string | null;
      name?: string | null;
      role?: Role;
      isActive?: boolean;
      teamId?: string | null;
      lastLoginAt: Date;
    } = {
      keycloakId: input.keycloakId,
      lastLoginAt: new Date()
    };

    if (input.email !== undefined) {
      data.email = input.email;
    }

    if (input.username !== undefined) {
      data.username = input.username;
    }

    if (input.name !== undefined) {
      data.name = input.name;
    }

    if (input.role !== undefined) {
      data.role = input.role;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    if (input.teamId !== undefined) {
      data.teamId = input.teamId;
    }

    try {
      return await prisma.employee.create({
        data,
        select: employeePublicSelect
      });
    } catch {
      throw new AppError(409, 'EMPLOYEE_ALREADY_EXISTS', 'Employee already exists');
    }
  }

  async syncEmployee(input: SyncEmployeeInput) {
    const existing = await prisma.employee.findUnique({
      where: { keycloakId: input.keycloakId },
      select: {
        id: true,
        isActive: true,
        email: true,
        username: true
      }
    });

    if (existing && !existing.isActive) {
      throw new AppError(403, 'EMPLOYEE_INACTIVE', 'Employee is inactive');
    }

    const now = new Date();

    if (existing) {
      const updateData: {
        lastLoginAt: Date;
        email?: string | null;
        username?: string | null;
        lastIp?: string | null;
      } = {
        lastLoginAt: now
      };

      if (input.email !== undefined) {
        updateData.email = input.email;
      }

      if (input.username !== undefined) {
        updateData.username = input.username;
      }

      if (input.ip !== undefined) {
        updateData.lastIp = input.ip;
      }

      return prisma.employee.update({
        where: { keycloakId: input.keycloakId },
        data: updateData,
        select: employeePublicSelect
      });
    }

    const createData: {
      keycloakId: string;
      lastLoginAt: Date;
      email?: string | null;
      username?: string | null;
      lastIp?: string | null;
    } = {
      keycloakId: input.keycloakId,
      lastLoginAt: now
    };

    if (input.email !== undefined) {
      createData.email = input.email;
    }

    if (input.username !== undefined) {
      createData.username = input.username;
    }

    if (input.ip !== undefined) {
      createData.lastIp = input.ip;
    }

    return prisma.employee.create({
      data: createData,
      select: employeePublicSelect
    });
  }

  async getEmployeeByKeycloakId(keycloakId: string) {
    const employee = await prisma.employee.findUnique({
      where: { keycloakId },
      select: employeePublicSelect
    });

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }

    return employee;
  }

  async getEmployeeById(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: employeePublicSelect
    });

    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }

    return employee;
  }

  async listEmployees() {
    return prisma.employee.findMany({
      orderBy: { createdAt: 'desc' },
      select: employeePublicSelect
    });
  }

  async updateRole(employeeId: string, role: Role) {
    try {
      return await prisma.employee.update({
        where: { id: employeeId },
        data: { role },
        select: employeePublicSelect
      });
    } catch {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }
  }

  async activateEmployee(employeeId: string) {
    try {
      return await prisma.employee.update({
        where: { id: employeeId },
        data: { isActive: true },
        select: employeePublicSelect
      });
    } catch {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }
  }

  async deactivateEmployee(employeeId: string) {
    try {
      return await prisma.employee.update({
        where: { id: employeeId },
        data: { isActive: false },
        select: employeePublicSelect
      });
    } catch {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }
  }

  async assignEmployeeToTeam(employeeId: string, teamId: string) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true } });
    if (!team) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found');
    }

    try {
      return await prisma.employee.update({
        where: { id: employeeId },
        data: { teamId },
        select: employeePublicSelect
      });
    } catch {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found');
    }
  }
}

export const employeeService = new EmployeeService();
