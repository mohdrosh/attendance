import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { getAllRequests, markRequestRead, markRequestUnread, deleteRequest } from '../db/queries/admin';
import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { RequestType, RequestStatus } from '@attendance/shared';

export const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(requireRole('admin'));

adminRouter.get('/requests', async (req: AuthRequest, res: Response, next) => {
  try {
    const { name, type, from, to, status } = req.query;
    const requests = await getAllRequests(
      {
        name: name as string | undefined,
        type: type as RequestType | undefined,
        from: from as string | undefined,
        to: to as string | undefined,
        status: status as RequestStatus | undefined,
      },
      req.user!.id
    );
    res.json(requests);
  } catch (err) { next(err); }
});

adminRouter.post('/requests/:id/read', async (req: AuthRequest, res: Response, next) => {
  try {
    const { rows } = await pool.query('SELECT id FROM requests WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw new AppError(404, 'Request not found');
    await markRequestRead(req.params.id, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

adminRouter.post('/requests/:id/unread', async (req: AuthRequest, res: Response, next) => {
  try {
    await markRequestUnread(req.params.id, req.user!.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

adminRouter.delete('/requests/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.storage_path FROM attachments a
       JOIN requests r ON a.request_id = r.id
       WHERE r.id = $1`,
      [req.params.id]
    );

    const deleted = await deleteRequest(req.params.id);
    if (!deleted) throw new AppError(404, 'Request not found');

    if (rows[0]?.storage_path) {
      const filePath = path.resolve(rows[0].storage_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});
