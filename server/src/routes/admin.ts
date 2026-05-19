import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { getAllRequests, updateRequestStatus, getEmployeeEmailById } from '../db/queries/admin';
import { emailService } from '../services/email/NodemailerService';
import { AppError } from '../middleware/errorHandler';
import { RequestType, RequestStatus } from '@attendance/shared';

export const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(requireRole('admin'));

adminRouter.get('/requests', async (req: AuthRequest, res: Response, next) => {
  try {
    const { name, type, from, to, status } = req.query;
    const requests = await getAllRequests({
      name: name as string | undefined,
      type: type as RequestType | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      status: status as RequestStatus | undefined,
    });
    res.json(requests);
  } catch (err) { next(err); }
});

adminRouter.patch('/requests/:id/status', async (req: AuthRequest, res: Response, next) => {
  try {
    const { status } = req.body;
    if (status !== 'approved' && status !== 'rejected') {
      throw new AppError(400, 'status must be "approved" or "rejected"');
    }

    const result = await updateRequestStatus(req.params.id, status, req.user!.id);
    if (!result) throw new AppError(404, 'Request not found');

    if (status === 'rejected') {
      const email = await getEmployeeEmailById(result.employee_id);
      if (email) {
        await emailService.send({
          to: [email],
          subject: 'Your attendance request was not approved',
          body: 'Your attendance request has been reviewed and was not approved. Please contact your manager for more details.',
        });
      }
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});
