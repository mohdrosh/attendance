import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { getUserWithTrainLines, getManagersByEmployeeId } from '../db/queries/users';
import { AppError } from '../middleware/errorHandler';

export const userRouter = Router();
userRouter.use(authMiddleware);

userRouter.get('/me', async (req: AuthRequest, res: Response, next) => {
  try {
    const profile = await getUserWithTrainLines(req.user!.id);
    if (!profile) throw new AppError(404, 'User not found');
    res.json(profile);
  } catch (err) { next(err); }
});

userRouter.get('/me/managers', async (req: AuthRequest, res: Response, next) => {
  try {
    const managers = await getManagersByEmployeeId(req.user!.id);
    res.json(managers);
  } catch (err) { next(err); }
});
