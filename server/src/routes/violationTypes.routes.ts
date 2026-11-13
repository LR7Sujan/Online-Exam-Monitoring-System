import { Router } from 'express';
import { z } from 'zod';
import { executeSql, queryRows } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import type { ViolationTypeRow } from '../types/api.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/response.js';

export const violationTypesRouter = Router();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createViolationTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[A-Z0-9_]+$/, 'Code must be UPPER_SNAKE_CASE'),
  label: z.string().trim().min(2).max(100),
  description: z.string().trim().max(255).optional().nullable(),
  penaltyPoints: z.coerce.number().int().min(1).max(100).optional(),
  penalty_points: z.coerce.number().int().min(1).max(100).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

const updateViolationTypeSchema = createViolationTypeSchema.partial();

// GET /api/violation-types
violationTypesRouter.get('/', requireAuth, async (_req, res, next) => {
  try {
    const rows = await queryRows<ViolationTypeRow[]>(
      'SELECT id, code, label, description, penalty_points, severity FROM Violation_Types ORDER BY penalty_points ASC'
    );
    sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/violation-types (ADMIN)
violationTypesRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: createViolationTypeSchema }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createViolationTypeSchema>;
      const penalty = body.penaltyPoints ?? body.penalty_points ?? 10;
      const result = await executeSql(
        `INSERT INTO Violation_Types (code, label, description, penalty_points, severity)
         VALUES (?, ?, ?, ?, ?)`,
        [body.code, body.label, body.description ?? null, penalty, body.severity]
      );
      const created = await queryRows<ViolationTypeRow[]>(
        'SELECT * FROM Violation_Types WHERE id = ? LIMIT 1',
        [result.insertId]
      );
      sendSuccess(res, created[0], 201);
    } catch (err) {
      next(err);
    }
  }
);

async function handleUpdateViolationType(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof sendSuccess>[0],
  next: (e?: unknown) => void
) {
  try {
    const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
    const body = req.body as z.infer<typeof updateViolationTypeSchema>;

    const rows = await queryRows<ViolationTypeRow[]>(
      'SELECT * FROM Violation_Types WHERE id = ? LIMIT 1',
      [id]
    );
    const existing = rows[0];
    if (!existing) {
      throw new AppError(404, 'VIOLATION_TYPE_NOT_FOUND', 'Violation type not found.');
    }

    const nextPenalty =
      body.penaltyPoints !== undefined
        ? body.penaltyPoints
        : body.penalty_points !== undefined
          ? body.penalty_points
          : existing.penalty_points;

    await executeSql(
      `UPDATE Violation_Types
          SET code = ?,
              label = ?,
              description = ?,
              penalty_points = ?,
              severity = ?
        WHERE id = ?`,
      [
        body.code ?? existing.code,
        body.label ?? existing.label,
        body.description !== undefined ? body.description : existing.description,
        nextPenalty,
        body.severity ?? existing.severity,
        id,
      ]
    );

    const updated = await queryRows<ViolationTypeRow[]>(
      'SELECT * FROM Violation_Types WHERE id = ? LIMIT 1',
      [id]
    );
    sendSuccess(res, updated[0]);
  } catch (err) {
    next(err);
  }
}

violationTypesRouter.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: updateViolationTypeSchema }),
  handleUpdateViolationType
);

violationTypesRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: idParamSchema, body: updateViolationTypeSchema }),
  handleUpdateViolationType
);

// DELETE /api/violation-types/:id (ADMIN)
violationTypesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: idParamSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as z.infer<typeof idParamSchema>;
      const result = await executeSql('DELETE FROM Violation_Types WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        throw new AppError(404, 'VIOLATION_TYPE_NOT_FOUND', 'Violation type not found.');
      }
      sendSuccess(res, { deleted: true, id });
    } catch (err) {
      next(err);
    }
  }
);

