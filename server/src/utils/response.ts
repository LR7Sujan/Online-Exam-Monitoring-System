import type { Response } from 'express';
import type { ApiResponse } from '../types/api.js';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    error: null,
  };
  res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): void {
  const payload: ApiResponse<null> = {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  res.status(statusCode).json(payload);
}

