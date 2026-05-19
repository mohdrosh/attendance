import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { findUserByEmployeeNumber, getUserWithTrainLines, saveRefreshToken, findAndDeleteRefreshToken } from '../db/queries/users';
import { AppError } from '../middleware/errorHandler';

export const authRouter = Router();

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

function generateAccessToken(userId: string, role: string) {
  return jwt.sign({ id: userId, role }, config.jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

authRouter.post('/login', async (req: Request, res: Response, next) => {
  try {
    const { employee_number, password } = req.body;
    if (!employee_number || !password) throw new AppError(400, 'employee_number and password required');

    const user = await findUserByEmployeeNumber(employee_number);
    if (!user) throw new AppError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    const profile = await getUserWithTrainLines(user.id);
    const accessToken = generateAccessToken(user.id, user.role);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await saveRefreshToken(user.id, refreshTokenHash, expiresAt);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
    });

    res.json({ accessToken, user: profile });
  } catch (err) { next(err); }
});

authRouter.post('/refresh', async (req: Request, res: Response, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) throw new AppError(401, 'No refresh token');

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const row = await findAndDeleteRefreshToken(tokenHash);
    if (!row) throw new AppError(401, 'Invalid or expired refresh token');

    const profile = await getUserWithTrainLines(row.user_id);
    if (!profile) throw new AppError(401, 'User not found');

    const accessToken = generateAccessToken(profile.id, profile.role);
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await saveRefreshToken(profile.id, newHash, expiresAt);
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
    });

    res.json({ accessToken, user: profile });
  } catch (err) { next(err); }
});

authRouter.post('/logout', async (req: Request, res: Response, next) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      await findAndDeleteRefreshToken(hash);
    }
    res.clearCookie('refreshToken');
    res.json({ ok: true });
  } catch (err) { next(err); }
});
