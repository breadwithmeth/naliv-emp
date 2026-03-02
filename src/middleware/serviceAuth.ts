import { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify, JWTVerifyResult, JWTPayload } from 'jose';
import { env } from '../config/env';
import { AppError } from '../lib/errors';

const jwks = createRemoteJWKSet(new URL(env.KEYCLOAK_JWKS_URI));

type IntrospectionResponse = {
  active?: boolean;
  sub?: string;
  // aud?: string | string[];
  client_id?: string;
  realm_access?: {
    roles?: string[];
  };
};

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

function resolveClientId(payload: JWTPayload): string | null {
  const azp = payload.azp;
  const clientId = payload.client_id;

  if (typeof clientId === 'string') {
    return clientId;
  }

  if (typeof azp === 'string') {
    return azp;
  }

  return null;
}

async function verifyWithJwk(token: string): Promise<JWTVerifyResult | null> {
  try {
    return await jwtVerify(token, jwks, {
      issuer: env.KEYCLOAK_ISSUER,
    });
  } catch {
    return null;
  }
}

function hasRequiredRole(payload: JWTPayload | IntrospectionResponse): boolean {
  const roles = (payload as { realm_access?: { roles?: unknown } }).realm_access?.roles;
  if (!Array.isArray(roles)) {
    return false;
  }
  return roles.includes('employee-service-access');
}

async function introspectToken(token: string): Promise<IntrospectionResponse> {
  const basic = Buffer.from(`${env.KEYCLOAK_CLIENT_ID}:${env.KEYCLOAK_CLIENT_SECRET}`).toString('base64');

  const body = new URLSearchParams({ token });

  const response = await fetch(env.KEYCLOAK_INTROSPECTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw new AppError(401, 'UNAUTHORIZED', 'Token introspection failed');
  }

  const payload = (await response.json()) as IntrospectionResponse;
  return payload;
}

function assertServiceToken(clientId: string): void {
  if (!clientId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Service token client_id is missing');
  }
}

export async function serviceAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (request.url.startsWith('/public/')) {
    return;
  }

  const token = parseBearerToken(request.headers.authorization);

  const jwkResult = await verifyWithJwk(token);
  if (jwkResult) {
    const clientId = resolveClientId(jwkResult.payload);
    assertServiceToken(clientId ?? '');

    if (!hasRequiredRole(jwkResult.payload)) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing required role');
    }

    request.serviceAuth = {
      clientId: clientId ?? '',
      subject: String(jwkResult.payload.sub ?? clientId),
      token
    };

    return;
  }

  const introspection = await introspectToken(token);

  if (!introspection.active) {
    throw new AppError(401, 'UNAUTHORIZED', 'Inactive service token');
  }

  if (!hasRequiredRole(introspection)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing required role');
  }


  const clientId = introspection.client_id ?? '';
  assertServiceToken(clientId);

  request.serviceAuth = {
    clientId,
    subject: introspection.sub ?? clientId,
    token
  };
}
