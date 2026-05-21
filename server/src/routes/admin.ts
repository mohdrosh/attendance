import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { getAllRequests, updateRequestStatus } from '../db/queries/admin';
import { emailService } from '../services/email/NodemailerService';
import { AppError } from '../middleware/errorHandler';
import { RequestType, RequestStatus, generateApprovalNotification, generateRejectionNotification } from '@attendance/shared';

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
    const { status, rejectionReason, sendNotification } = req.body;
    if (status !== 'approved' && status !== 'rejected') {
      throw new AppError(400, 'status must be "approved" or "rejected"');
    }

    const result = await updateRequestStatus(req.params.id, status, req.user!.id);
    if (!result) throw new AppError(404, 'Request not found');

    if (sendNotification === true) {
      const notifInput = {
        requestType: result.request_type as RequestType,
        startDate: result.start_date,
        endDate: result.end_date ?? undefined,
        timeFrom: result.time_from ?? undefined,
        timeTo: result.time_to ?? undefined,
        employeeName: { ja: result.name_ja, en: result.name_en },
      };

      const { japanese, english } = status === 'approved'
        ? generateApprovalNotification(notifInput)
        : generateRejectionNotification({ ...notifInput, rejectionReason: rejectionReason ?? undefined });

      const body = english ? `[English]\n${english}\n\n[日本語]\n${japanese}` : japanese;
      const subjectPrefix = status === 'approved' ? '【承認】' : '【否認】';

      emailService.send({
        to: [result.email],
        subject: `${subjectPrefix}${result.name_ja} ${result.start_date}`,
        body,
      }).catch(err => console.error('[email] notification failed:', err?.message));
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});
