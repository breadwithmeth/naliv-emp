#!/usr/bin/env node
// Batch-create Keycloak users with required CONFIGURE_TOTP action.
// Usage: node scripts/keycloak-batch-create.mjs users.csv
// CSV format: email,password (username will be email)

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const {
  KEYCLOAK_BASE_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  KEYCLOAK_CLIENT_SECRET,
  KEYCLOAK_SERVICE_ACCOUNT_ID,
  KEYCLOAK_SERVICE_ACCOUNT_SECRET
} = process.env;

const clientId = KEYCLOAK_SERVICE_ACCOUNT_ID || KEYCLOAK_CLIENT_ID;
const clientSecret = KEYCLOAK_SERVICE_ACCOUNT_SECRET || KEYCLOAK_CLIENT_SECRET;

if (!KEYCLOAK_BASE_URL || !KEYCLOAK_REALM || !clientId || !clientSecret) {
  console.error('Missing Keycloak env vars. Required: KEYCLOAK_BASE_URL, KEYCLOAK_REALM, and client id/secret (service account or main).');
  process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/keycloak-batch-create.mjs <users.csv>');
  process.exit(1);
}

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      const [email, password] = line.split(',').map((v) => v?.trim());
      if (!email || !password) {
        throw new Error(`Line ${idx + 1}: expected "email,password"`);
      }
      return { email, password };
    });
}

async function getAdminToken() {
  const url = `${KEYCLOAK_BASE_URL}/realms/${encodeURIComponent(KEYCLOAK_REALM)}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get admin token (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function findUserIdByUsername(token, username) {
  const url = `${KEYCLOAK_BASE_URL}/admin/realms/${encodeURIComponent(KEYCLOAK_REALM)}/users?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to search user (${res.status}): ${text}`);
  }
  const users = await res.json();
  const found = users.find((u) => u.username === username);
  return found?.id;
}

async function createUser(token, { email }) {
  const url = `${KEYCLOAK_BASE_URL}/admin/realms/${encodeURIComponent(KEYCLOAK_REALM)}/users`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      username: email,
      email,
      enabled: true,
      emailVerified: false,
      requiredActions: ['CONFIGURE_TOTP']
    })
  });

  if (res.status === 201) {
    const location = res.headers.get('location');
    if (location) {
      return path.posix.basename(location);
    }
    // Fallback: fetch by search
    return findUserIdByUsername(token, email);
  }

  if (res.status === 409) {
    // Already exists; fetch id
    return findUserIdByUsername(token, email);
  }

  const text = await res.text();
  throw new Error(`Failed to create user ${email} (${res.status}): ${text}`);
}

async function setPassword(token, userId, password) {
  const url = `${KEYCLOAK_BASE_URL}/admin/realms/${encodeURIComponent(KEYCLOAK_REALM)}/users/${userId}/reset-password`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'password',
      value: password,
      temporary: false
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set password for ${userId} (${res.status}): ${text}`);
  }
}

async function main() {
  const users = parseCsv(inputPath);
  console.log(`Loaded ${users.length} users from ${inputPath}`);

  const token = await getAdminToken();

  for (const user of users) {
    try {
      const userId = await createUser(token, user);
      if (!userId) {
        throw new Error('User ID not found after creation/search');
      }
      await setPassword(token, userId, user.password);
      console.log(`OK ${user.email}`);
    } catch (err) {
      console.error(`FAIL ${user.email}:`, err.message || err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
