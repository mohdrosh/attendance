import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { createRequest, createAttachment, getRequestsByEmployee } from '../db/queries/requests';
import { getManagersByEmployeeId, getUserWithTrainLines } from '../db/queries/users';
import { generateMessage } from '@attendance/shared';
import { emailService } from '../services/email/NodemailerService';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    cb(null, allowed.includes(file.mimetype));
  },
});

export const requestRouter = Router();
requestRouter.use(authMiddleware);
requestRouter.use(requireRole('applicant'));

requestRouter.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const requests = await getRequestsByEmployee(req.user!.id);
    res.json(requests);
  } catch (err) { next(err); }
});

requestRouter.post('/', upload.single('file'), async (req: AuthRequest, res: Response, next) => {
  try {
    const {
      requestType, startDate, endDate, timeFrom, timeTo,
      reasonCategory, reasonDetail, trainLineId, leaveType,
      adminMessage, inputLanguage,
    } = req.body;

    if (!requestType || !startDate || !reasonCategory || !inputLanguage) {
      throw new AppError(400, 'Missing required fields');
    }

    const client = await pool.connect();
    let requestId: string;
    try {
      await client.query('BEGIN');
      requestId = await createRequest({
        employeeId: req.user!.id,
        requestType, startDate, endDate, timeFrom, timeTo,
        reasonCategory, reasonDetail, trainLineId, leaveType,
        adminMessage, inputLanguage,
      });

      if (req.file) {
        await createAttachment(requestId, {
          originalFilename: req.file.originalname,
          storagePath: req.file.path,
          mimeType: req.file.mimetype,
          fileSize: req.file.size,
        });
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const user = await getUserWithTrainLines(req.user!.id);
    const managers = await getManagersByEmployeeId(req.user!.id);

    if (managers.length > 0 && user) {
      const trainLine = user.trainLines.find(l => l.id === trainLineId);
      const msgInput = {
        requestType, reasonCategory, reasonDetail, trainLineName: trainLine?.line_name_ja,
        startDate, endDate, timeFrom, timeTo, leaveType, adminMessage,
        employeeName: { ja: user.name_ja, en: user.name_en },
        inputLanguage,
      };
      const { japanese, english } = generateMessage(msgInput);
      const body = english ? `[English]\n${english}\n\n[日本語]\n${japanese}` : japanese;
      const subjects: Record<string, string> = {
        late: '【遅刻連絡】', early_departure: '【早退連絡】',
        absence: '【欠勤連絡】', other_request: '【その他連絡】',
      };
      await emailService.send({
        to: managers.map(m => m.email),
        subject: `${subjects[requestType]}${user.name_ja} ${startDate}`,
        body,
      });
    }

    res.status(201).json({ id: requestId });
  } catch (err) { next(err); }
});
