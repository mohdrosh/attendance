import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/users';
import { requestRouter } from './routes/requests';
import { adminRouter } from './routes/admin';
import { attachmentRouter } from './routes/attachments';
import { employeesRouter } from './routes/employees';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:5173',
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/requests', requestRouter);
  app.use('/api/admin/employees', employeesRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/attachments', attachmentRouter);

  app.use(errorHandler);
  return app;
}
