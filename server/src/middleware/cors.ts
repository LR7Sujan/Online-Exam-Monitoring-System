import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((o) => o.trim().replace(/\/$/, ''));
  const origin = req.headers.origin?.replace(/\/$/, '');

  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin as string);
  } else if (
    origin &&
    allowedOrigins.some((pattern) => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        return regex.test(origin);
      }
      return false;
    })
  ) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin as string);
  } else if (!origin && allowedOrigins.length > 0) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

