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

    if (!user.dispatch_company || !user.employee_number || !user.name_ja) {
      return res.status(400).json({ error: 'dispatch_company, employee_number, and name are required to generate a todoke' });
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

    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const rawFilename = `${user.name_ja}_${today}_C-2 届・設計開発（雛型）２４０９０９.xlsx`;
    const encodedFilename = encodeURIComponent(rawFilename);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.send(buf);
  } catch (err) { next(err); }
});
