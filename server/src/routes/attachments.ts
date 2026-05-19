import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { pool } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

export const attachmentRouter = Router();
attachmentRouter.use(authMiddleware);
attachmentRouter.use(requireRole('admin'));

attachmentRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT storage_path, original_filename, mime_type, expires_at FROM attachments WHERE id = $1`,
      [req.params.id]
    );
    const attachment = rows[0];
    if (!attachment) throw new AppError(404, 'Attachment not found');
    if (new Date(attachment.expires_at) < new Date()) throw new AppError(410, 'Attachment expired');

    const filePath = path.resolve(attachment.storage_path);
    if (!fs.existsSync(filePath)) throw new AppError(404, 'File not found on disk');

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.original_filename}"`);
    res.setHeader('Content-Type', attachment.mime_type);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});
