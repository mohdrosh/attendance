import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { UserRole } from '@attendance/shared';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
