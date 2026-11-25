import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError, isDbConnectionError, isMysqlError, mapMysqlError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found.`);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed.', err.flatten());
    return;
  }

  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (isDbConnectionError(err)) {
    console.error(
      `MySQL is not reachable at ${env.DB_HOST}:${env.DB_PORT}. Start your MySQL service or check .env`
    );
    sendError(
      res,
      503,
      'DB_UNAVAILABLE',
      `MySQL is not reachable at ${env.DB_HOST}:${env.DB_PORT}. Start your MySQL service or check .env`
    );
    return;
  }

  if (isMysqlError(err)) {
    const mapped = mapMysqlError(err);
    if (mapped) {
      sendError(res, mapped.statusCode, mapped.code, mapped.message, mapped.details);
      return;
    }
  }

  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred.'
      : err instanceof Error
        ? err.message
        : 'Unknown server error';

  if (env.NODE_ENV !== 'test') {
    console.error('[ProctorIQ Server Error]', err);
  }

  sendError(res, 500, 'INTERNAL_SERVER_ERROR', message);
}

