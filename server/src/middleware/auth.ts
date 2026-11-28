import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2/promise';
import { queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import type { JwtUserPayload, UserRole } from '../types/api.js';
import { AppError } from '../utils/errors.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

interface UserAuthRow extends RowDataPacket {
  password_changed_at_ts: number | null;
  is_active: number;
}

export function verifyJwtToken(token: string): JwtUserPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== 'object' || decoded === null || !('sub' in decoded)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Malformed authentication token.');
  }
  const payload = decoded as unknown as JwtUserPayload & { iat?: number };
  return {
    sub: Number(payload.sub),
    email: String(payload.email),
    fullName: String(payload.fullName),
    role: payload.role,
  };
}

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
    token = req.query.token.trim();
  }

  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header or token query parameter.'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded !== 'object' || decoded === null || !('sub' in decoded)) {
      throw new AppError(401, 'INVALID_TOKEN', 'Malformed authentication token.');
    }
    const payload = decoded as unknown as JwtUserPayload & { iat?: number };

    // Query user state and password_changed_at (as epoch seconds) to reject revoked tokens
    const userRows = await queryRows<UserAuthRow[]>(
      'SELECT UNIX_TIMESTAMP(password_changed_at) AS password_changed_at_ts, is_active FROM Users WHERE id = ? LIMIT 1',
      [payload.sub]
    );
    const user = userRows[0];

    if (!user || !user.is_active) {
      throw new AppError(401, 'UNAUTHORIZED', 'User not found or account is deactivated.');
    }

    if (user.password_changed_at_ts && payload.iat) {
      if (payload.iat < user.password_changed_at_ts) {
        throw new AppError(401, 'TOKEN_REVOKED', 'Session expired due to a recent password reset. Please sign in again.');
      }
    }

    req.user = {
      sub: Number(payload.sub),
      email: String(payload.email),
      fullName: String(payload.fullName),
      role: payload.role,
    };
    next();
  } catch (err: unknown) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(new AppError(401, 'INVALID_TOKEN', 'Session token is expired or invalid.'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required.'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(
        new AppError(
          403,
          'FORBIDDEN',
          `Access requires one of the following roles: ${roles.join(', ')}.`
        )
      );
      return;
    }
    next();
  };
}
