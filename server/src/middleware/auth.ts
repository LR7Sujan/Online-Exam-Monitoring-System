import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { JwtUserPayload, UserRole } from '../types/api.js';
import { AppError } from '../utils/errors.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

export function verifyJwtToken(token: string): JwtUserPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded !== 'object' || decoded === null || !('sub' in decoded)) {
    throw new AppError(401, 'INVALID_TOKEN', 'Malformed authentication token.');
  }
  const payload = decoded as unknown as JwtUserPayload;
  return {
    sub: Number(payload.sub),
    email: String(payload.email),
    fullName: String(payload.fullName),
    role: payload.role,
  };
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
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
    req.user = verifyJwtToken(token);
    next();
  } catch {
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

