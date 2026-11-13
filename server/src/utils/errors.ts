export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface MysqlLikeError extends Error {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
}

export function isMysqlError(err: unknown): err is MysqlLikeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    ('errno' in err || 'sqlState' in err || 'code' in err)
  );
}

/**
 * Translates MySQL 8.0+ constraint, trigger SIGNAL (SQLSTATE 45000),
 * and duplicate key errors into deterministic HTTP AppErrors.
 */
export function mapMysqlError(err: MysqlLikeError): AppError | null {
  if (err.sqlState === '45000' || err.errno === 1644) {
    const msg = err.sqlMessage ?? err.message ?? 'Database rule rejected operation.';
    const lower = msg.toLowerCase();
    if (lower.includes('not found')) {
      return new AppError(404, 'DB_RESOURCE_NOT_FOUND', msg);
    }
    if (lower.includes('only student') || lower.includes('inactive')) {
      return new AppError(403, 'DB_ACCESS_DENIED', msg);
    }
    return new AppError(409, 'DB_RULE_VIOLATION', msg);
  }

  if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    return new AppError(409, 'DUPLICATE_RECORD', 'A record with this unique key already exists.');
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
    return new AppError(400, 'INVALID_REFERENCE', 'Referenced entity does not exist.');
  }

  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || err.errno === 3819) {
    return new AppError(400, 'CHECK_CONSTRAINT_FAILED', err.sqlMessage ?? 'Database check constraint violated.');
  }

  return null;
}

