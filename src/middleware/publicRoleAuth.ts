import { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { prisma } from '../prisma/client';

const jwks = createRemoteJWKSet(new URL(env.KEYCLOAK_JWKS_URI));

function parseBearerToken(authHeader?: string): string {
  if (!authHeader) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authorization header is required');
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid authorization format');
  }

  return token;
}

export async function requireSupervisorOrAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = parseBearerToken(request.headers.authorization);

  let payloadSub: string;
  try {
    const verified = await jwtVerify(token, jwks, {
      issuer: env.KEYCLOAK_ISSUER
    });

    payloadSub = String(verified.payload.sub ?? '');
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid user token');
  }

  if (!payloadSub) {
    throw new AppError(401, 'UNAUTHORIZED', 'User token subject is missing');
  }

  const employee = await prisma.employee.findUnique({
    where: { keycloakId: payloadSub },
    select: {
      isActive: true,
      role: true
    }
  });

  if (!employee) {
    throw new AppError(403, 'FORBIDDEN', 'Employee profile is required');
  }

  if (!employee.isActive) {
    throw new AppError(403, 'EMPLOYEE_INACTIVE', 'Employee is inactive');
  }

  if (employee.role !== Role.ADMIN && employee.role !== Role.SUPERVISOR) {
    throw new AppError(403, 'FORBIDDEN', 'Insufficient role');
  }
}
