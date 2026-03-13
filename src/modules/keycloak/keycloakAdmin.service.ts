import { env } from '../../config/env';

export type KeycloakRealmUser = {
  id: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
};

function baseAdminUrl() {
  return `${env.KEYCLOAK_BASE_URL}/admin/realms/${encodeURIComponent(env.KEYCLOAK_REALM)}`;
}

async function getAdminToken() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.KEYCLOAK_SERVICE_ACCOUNT_ID || env.KEYCLOAK_CLIENT_ID,
    client_secret: env.KEYCLOAK_SERVICE_ACCOUNT_SECRET || env.KEYCLOAK_CLIENT_SECRET
  });

  const res = await fetch(`${env.KEYCLOAK_BASE_URL}/realms/${encodeURIComponent(env.KEYCLOAK_REALM)}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get admin token (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('Admin token missing in response');
  }

  return json.access_token;
}

async function findUserIdByUsername(token: string, username: string): Promise<string | null> {
  const res = await fetch(`${baseAdminUrl()}/users?username=${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to search user (${res.status}): ${text}`);
  }

  const users = (await res.json()) as Array<{ id?: string; username?: string }>;
  const found = users.find((u) => u.username === username);
  return found?.id ?? null;
}

async function createUser(
  token: string,
  params: { email: string; username?: string; name?: string },
  options: { requireOtp: boolean }
) {
  const payload = {
    username: params.username ?? params.email,
    email: params.email,
    enabled: true,
    emailVerified: false,
    requiredActions: options.requireOtp ? ['CONFIGURE_TOTP'] : [],
    firstName: params.name ?? undefined
  } as const;

  const res = await fetch(`${baseAdminUrl()}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (res.status === 201) {
    const location = res.headers.get('location');
    if (location) {
      const parts = location.split('/');
      return parts[parts.length - 1];
    }
    return findUserIdByUsername(token, payload.username);
  }

  if (res.status === 409) {
    return findUserIdByUsername(token, payload.username);
  }

  const text = await res.text();
  throw new Error(`Failed to create user ${payload.username} (${res.status}): ${text}`);
}

async function setPassword(token: string, userId: string, password: string) {
  const res = await fetch(`${baseAdminUrl()}/users/${userId}/reset-password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ type: 'password', value: password, temporary: false })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set password for ${userId} (${res.status}): ${text}`);
  }
}

export class KeycloakAdminService {
  async getUserById(userId: string): Promise<KeycloakRealmUser | null> {
    const token = await getAdminToken();
    const res = await fetch(`${baseAdminUrl()}/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get user ${userId} (${res.status}): ${text}`);
    }

    const user = (await res.json()) as {
      id?: string;
      email?: string;
      username?: string;
      firstName?: string;
      lastName?: string;
      enabled?: boolean;
    };

    if (!user.id) {
      return null;
    }

    return {
      id: String(user.id),
      email: user.email ?? null,
      username: user.username ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      enabled: user.enabled !== false
    };
  }

  async listRealmUsers(options?: { pageSize?: number; maxUsers?: number }) {
    const pageSize = options?.pageSize ?? 200;
    const maxUsers = options?.maxUsers;

    if (pageSize < 1 || pageSize > 1000) {
      throw new Error('pageSize must be between 1 and 1000');
    }

    const token = await getAdminToken();
    const users: KeycloakRealmUser[] = [];

    let first = 0;
    while (true) {
      const url = `${baseAdminUrl()}/users?first=${first}&max=${pageSize}&briefRepresentation=true`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to list users (${res.status}): ${text}`);
      }

      const batch = (await res.json()) as Array<{
        id?: string;
        email?: string;
        username?: string;
        firstName?: string;
        lastName?: string;
        enabled?: boolean;
      }>;

      const mapped = batch
        .filter((item) => Boolean(item.id))
        .map((item) => ({
          id: String(item.id),
          email: item.email ?? null,
          username: item.username ?? null,
          firstName: item.firstName ?? null,
          lastName: item.lastName ?? null,
          enabled: item.enabled !== false
        }));

      users.push(...mapped);

      if (maxUsers && users.length >= maxUsers) {
        return users.slice(0, maxUsers);
      }

      if (batch.length < pageSize) {
        return users;
      }

      first += pageSize;
    }
  }

  async createUserWithPassword(params: {
    email: string;
    password: string;
    username?: string;
    name?: string;
    requireOtp?: boolean;
  }) {
    const { requireOtp = true, ...user } = params;
    const token = await getAdminToken();
    const userId = await createUser(token, user, { requireOtp });
    if (!userId) {
      throw new Error('User ID not found after creation/search');
    }
    await setPassword(token, userId, params.password);
    return userId;
  }
}

export const keycloakAdminService = new KeycloakAdminService();
