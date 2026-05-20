import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/users';
import { requestRouter } from './routes/requests';
import { adminRouter } from './routes/admin';
import { attachmentRouter } from './routes/attachments';
import { employeesRouter } from './routes/employees';

const isProd = process.env.NODE_ENV === 'production';
const clientDist = path.join(__dirname, '../../client/dist');

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));

  if (!isProd) {
    app.use(cors({
      origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
      credentials: true,
    }));
  }

  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/requests', requestRouter);
  app.use('/api/admin/employees', employeesRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/attachments', attachmentRouter);

  if (isProd && fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
