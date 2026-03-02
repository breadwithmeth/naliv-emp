import { prisma } from '../../prisma/client';
import { AppError } from '../../lib/errors';

export class TeamService {
  async createTeam(name: string) {
    const normalized = name.trim();

    if (!normalized) {
      throw new AppError(400, 'INVALID_TEAM_NAME', 'Team name cannot be empty');
    }

    const existing = await prisma.team.findFirst({
      where: {
        name: {
          equals: normalized,
          mode: 'insensitive'
        }
      },
      select: { id: true }
    });

    if (existing) {
      throw new AppError(409, 'TEAM_ALREADY_EXISTS', 'Team already exists');
    }

    return prisma.team.create({
      data: { name: normalized }
    });
  }

  async listTeams() {
    return prisma.team.findMany({
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

export const teamService = new TeamService();
