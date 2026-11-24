import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { executeSql, queryRows } from '../config/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess } from '../utils/response.js';

export const settingsRouter = Router();

const updateSettingsSchema = z.object({
  phoneConfidenceThreshold: z.coerce.number().min(0.40, 'Minimum threshold is 0.40').max(0.90, 'Maximum threshold is 0.90').optional(),
  phone_confidence_threshold: z.coerce.number().min(0.40, 'Minimum threshold is 0.40').max(0.90, 'Maximum threshold is 0.90').optional(),
});

// GET /api/settings - Public or authenticated
settingsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await queryRows<(RowDataPacket & { setting_key: string; setting_value: string })[]>(
      'SELECT setting_key, setting_value FROM System_Settings'
    );
    const settings: Record<string, unknown> = {
      phoneConfidenceThreshold: 0.60,
      phone_confidence_threshold: 0.60,
    };
    for (const r of rows) {
      if (r.setting_key === 'phone_confidence_threshold') {
        const val = parseFloat(r.setting_value) || 0.60;
        settings.phoneConfidenceThreshold = val;
        settings.phone_confidence_threshold = val;
      } else {
        settings[r.setting_key] = r.setting_value;
      }
    }
    sendSuccess(res, settings);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/settings - ADMIN only
settingsRouter.patch(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateSettingsSchema }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof updateSettingsSchema>;
      const phoneThreshold = body.phoneConfidenceThreshold ?? body.phone_confidence_threshold;

      if (phoneThreshold !== undefined) {
        await executeSql(
          `INSERT INTO System_Settings (setting_key, setting_value)
           VALUES ('phone_confidence_threshold', ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [phoneThreshold.toFixed(2)]
        );
      }

      sendSuccess(res, {
        phoneConfidenceThreshold: phoneThreshold ?? 0.60,
        phone_confidence_threshold: phoneThreshold ?? 0.60,
      });
    } catch (err) {
      next(err);
    }
  }
);
