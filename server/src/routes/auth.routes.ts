import bcrypt from 'bcrypt';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { executeSql, queryRows } from '../config/db.js';
import { env } from '../config/env.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { JwtUserPayload, UserRow } from '../types/api.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const authRouter = Router();

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190).toLowerCase(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(190).toLowerCase(),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().trim().min(10),
});

function signToken(payload: JwtUserPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

function signRefreshToken(payload: JwtUserPayload): string {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

// POST /api/auth/register — always creates a STUDENT account
authRouter.post('/register', authRateLimiter, validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body as z.infer<typeof registerSchema>;
    const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const result = await executeSql(
      `INSERT INTO Users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'STUDENT', TRUE)`,
      [fullName, email, passwordHash]
    );

    const userPayload: JwtUserPayload = {
      sub: result.insertId,
      email,
      fullName,
      role: 'STUDENT',
    };
    const token = signToken(userPayload);
    const refreshToken = signRefreshToken(userPayload);

    sendSuccess(
      res,
      {
        token,
        refreshToken,
        user: {
          id: userPayload.sub,
          fullName: userPayload.fullName,
          email: userPayload.email,
          role: userPayload.role,
        },
      },
      201
    );
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
authRouter.post('/login', authRateLimiter, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const rows = await queryRows<UserRow[]>(
      `SELECT id, full_name, email, password_hash, role, is_active
         FROM Users
        WHERE email = ?
        LIMIT 1`,
      [email]
    );

    const user = rows[0];
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (!user.is_active) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been deactivated.');
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const userPayload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };
    const token = signToken(userPayload);
    const refreshToken = signRefreshToken(userPayload);

    sendSuccess(res, {
      token,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh — issues fresh access token from refresh token
authRouter.post('/refresh', authRateLimiter, validate({ body: refreshSchema }), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as z.infer<typeof refreshSchema>;
    const decoded = jwt.verify(refreshToken, env.JWT_SECRET) as unknown as JwtUserPayload & {
      tokenType?: string;
    };

    if (decoded.tokenType !== 'refresh') {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Supplied token is not a valid refresh token.');
    }

    const rows = await queryRows<UserRow[]>(
      'SELECT id, full_name, email, role, is_active FROM Users WHERE id = ? LIMIT 1',
      [decoded.sub]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      throw new AppError(401, 'USER_INACTIVE', 'User associated with refresh token is disabled or deleted.');
    }

    const userPayload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };

    const newAccessToken = signToken(userPayload);
    const newRefreshToken = signRefreshToken(userPayload);

    sendSuccess(res, {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    if (err?.name === 'TokenExpiredError') {
      next(new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token has expired. Please sign in again.'));
      return;
    }
    if (err?.name === 'JsonWebTokenError') {
      next(new AppError(401, 'INVALID_REFRESH_TOKEN', 'Malformed or invalid refresh token signature.'));
      return;
    }
    next(err);
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const rows = await queryRows<UserRow[]>(
      'SELECT id, full_name, email, role, is_active, created_at FROM Users WHERE id = ? LIMIT 1',
      [req.user!.sub]
    );
    const user = rows[0];
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Authenticated user no longer exists.');
    }
    sendSuccess(res, {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      isActive: Boolean(user.is_active),
      createdAt: user.created_at,
    });
  } catch (err) {
    next(err);
  }
});

