import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { getUserWithTrainLines } from '../db/queries/users';
import { generateTodoke } from '../services/todoke/todokeService';

export const todokeRouter = Router();
todokeRouter.use(authMiddleware);

todokeRouter.post('/generate', async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.user!.role !== 'applicant') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      requestType,
      startDate,
      endDate,
      timeFrom,
      timeTo,
      reasonCategory,
      reasonDetail,
      leaveType,
      adminMessage,
    } = req.body;

    const user = await getUserWithTrainLines(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const buf = await generateTodoke({
      requestType: requestType ?? '',
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      timeFrom: timeFrom ?? '',
      timeTo: timeTo ?? '',
      reasonCategory: reasonCategory ?? '',
      reasonDetail: reasonDetail ?? '',
      leaveType: leaveType ?? '',
      adminMessage: adminMessage ?? '',
      employeeNameJa: user.name_ja,
      employeeNumber: user.employee_number,
      dispatchCompany: user.dispatch_company ?? '',
    });

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="todoke_${today}.xlsx"`);
    res.send(buf);
  } catch (err) { next(err); }
});
