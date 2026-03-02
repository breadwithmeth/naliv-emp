import { prisma } from '../../prisma/client';
import { AppError } from '../../lib/errors';

export class DepartmentService {
  async createDepartment(name: string) {
    const normalized = name.trim();

    if (!normalized) {
      throw new AppError(400, 'INVALID_DEPARTMENT_NAME', 'Department name cannot be empty');
    }

    const existing = await prisma.department.findFirst({
      where: {
        name: {
          equals: normalized,
          mode: 'insensitive'
        }
      },
      select: { id: true }
    });

    if (existing) {
      throw new AppError(409, 'DEPARTMENT_ALREADY_EXISTS', 'Department already exists');
    }

    return prisma.department.create({
      data: { name: normalized }
    });
  }

  async listDepartments() {
    return prisma.department.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            Employees: true
          }
        }
      }
    });
  }
}

export const departmentService = new DepartmentService();
