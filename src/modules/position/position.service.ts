import { prisma } from '../../prisma/client';
import { AppError } from '../../lib/errors';

export class PositionService {
  async createPosition(input: {
    name: string;
    description?: string | null;
    requiresGeolocation?: boolean;
    requiresPhoto?: boolean;
  }) {
    const name = input.name.trim();
    if (!name) {
      throw new AppError(400, 'INVALID_POSITION_NAME', 'Position name cannot be empty');
    }

    const exists = await prisma.position.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        }
      },
      select: { id: true }
    });

    if (exists) {
      throw new AppError(409, 'POSITION_ALREADY_EXISTS', 'Position already exists');
    }

    return prisma.position.create({
      data: {
        name,
        description: input.description ?? null,
        requiresGeolocation: input.requiresGeolocation ?? false,
        requiresPhoto: input.requiresPhoto ?? false
      }
    });
  }

  async listPositions() {
    return prisma.position.findMany({
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

export const positionService = new PositionService();
