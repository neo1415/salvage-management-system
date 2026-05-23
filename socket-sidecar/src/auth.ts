import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import type { Socket } from 'socket.io';
import type { AuthenticatedSocketUser, UserRole } from './types.js';

const jwtSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
const databaseUrl = process.env.DATABASE_URL;
const requireDbUserCheck = process.env.REQUIRE_DB_USER_CHECK === 'true';
const sql = databaseUrl ? neon(databaseUrl) : null;

function getBearerToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim();
  }

  const authorization = socket.handshake.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return null;
}

function normalizeRole(role: unknown): UserRole {
  const allowed = new Set([
    'system_admin',
    'salvage_manager',
    'finance_officer',
    'claims_adjuster',
    'vendor'
  ]);

  return typeof role === 'string' && allowed.has(role)
    ? (role as UserRole)
    : 'vendor';
}

async function loadUserFromDatabase(userId: string): Promise<AuthenticatedSocketUser | null> {
  if (!sql) {
    return null;
  }

  const rows = await sql`
    SELECT
      u.id,
      u.email,
      u.role,
      u.status,
      v.id AS vendor_id
    FROM users u
    LEFT JOIN vendors v ON v.user_id = u.id
    WHERE u.id = ${userId}
    LIMIT 1
  `;

  const row = rows[0] as
    | {
        id: string;
        email?: string;
        role?: string;
        status?: string;
        vendor_id?: string;
      }
    | undefined;

  if (!row) {
    return null;
  }

  if (row.status === 'suspended' || row.status === 'deleted' || row.status === 'blocked') {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    role: normalizeRole(row.role),
    vendorId: row.vendor_id
  };
}

export async function authenticateSocket(socket: Socket): Promise<AuthenticatedSocketUser> {
  if (!jwtSecret) {
    throw new Error('Socket authentication is not configured');
  }

  const token = getBearerToken(socket);
  if (!token) {
    throw new Error('Authentication token required');
  }

  const decoded = jwt.verify(token, jwtSecret) as {
    userId?: string;
    id?: string;
    sub?: string;
    email?: string;
    role?: string;
    vendorId?: string;
  };

  const userId = decoded.userId || decoded.id || decoded.sub;
  if (!userId) {
    throw new Error('Invalid authentication token');
  }

  const dbUser = await loadUserFromDatabase(userId);
  if (dbUser) {
    return dbUser;
  }

  if (requireDbUserCheck) {
    throw new Error('User is not active');
  }

  return {
    id: userId,
    email: decoded.email,
    role: normalizeRole(decoded.role),
    vendorId: decoded.vendorId
  };
}

