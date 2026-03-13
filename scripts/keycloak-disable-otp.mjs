#!/usr/bin/env node
// Disable OTP requirement for users in Keycloak.
// Usage: node scripts/keycloak-disable-otp.mjs users.csv
// CSV format: email,password (password is ignored)

import fs from 'node:fs';
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
  console.error('Usage: node scripts/keycloak-disable-otp.mjs <users.csv>');
  process.exit(1);
}

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [email] = line.split(',').map((v) => v?.trim());
      if (!email) {
        throw new Error('Invalid CSV line: expected "email,password"');
      }
      return email;
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

function adminBaseUrl() {
  return `${KEYCLOAK_BASE_URL}/admin/realms/${encodeURIComponent(KEYCLOAK_REALM)}`;
}

async function findUserByUsername(token, username) {
  const url = `${adminBaseUrl()}/users?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to search user (${res.status}): ${text}`);
  }

  const users = await res.json();
  return users.find((u) => u.username === username) || null;
}

async function getUser(token, userId) {
  const res = await fetch(`${adminBaseUrl()}/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to load user ${userId} (${res.status}): ${text}`);
  }

  return res.json();
}

async function updateUserRequiredActionsWithoutOtp(token, userId) {
  const user = await getUser(token, userId);
  const requiredActions = Array.isArray(user.requiredActions)
    ? user.requiredActions.filter((a) => a !== 'CONFIGURE_TOTP')
    : [];

  const payload = {
    ...user,
    requiredActions
  };

  const res = await fetch(`${adminBaseUrl()}/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update user ${userId} (${res.status}): ${text}`);
  }
}

async function disableOtpCredentialType(token, userId) {
  const res = await fetch(`${adminBaseUrl()}/users/${userId}/disable-credential-types`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(['otp'])
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to disable OTP credential type for ${userId} (${res.status}): ${text}`);
  }
}

async function listCredentials(token, userId) {
  const res = await fetch(`${adminBaseUrl()}/users/${userId}/credentials`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to list credentials for ${userId} (${res.status}): ${text}`);
  }

  return res.json();
}

async function deleteCredential(token, userId, credentialId) {
  const res = await fetch(`${adminBaseUrl()}/users/${userId}/credentials/${credentialId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete credential ${credentialId} for ${userId} (${res.status}): ${text}`);
  }
}

async function removeOtpCredentials(token, userId) {
  const creds = await listCredentials(token, userId);
  const otpCreds = creds.filter((c) => c.type === 'otp');

  for (const cred of otpCreds) {
    await deleteCredential(token, userId, cred.id);
  }

  return otpCreds.length;
}

async function main() {
  const emails = parseCsv(inputPath);
  console.log(`Loaded ${emails.length} users from ${inputPath}`);

  const token = await getAdminToken();

  for (const email of emails) {
    try {
      const user = await findUserByUsername(token, email);
      if (!user?.id) {
        console.error(`NOT_FOUND ${email}`);
        continue;
      }

      await updateUserRequiredActionsWithoutOtp(token, user.id);
      await disableOtpCredentialType(token, user.id);
      const deletedOtpCount = await removeOtpCredentials(token, user.id);

      console.log(`OK ${email} otpCredentialsDeleted=${deletedOtpCount}`);
    } catch (err) {
      console.error(`FAIL ${email}:`, err.message || err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
