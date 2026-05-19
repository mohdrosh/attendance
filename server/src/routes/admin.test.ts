import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

jest.mock('../services/email/NodemailerService', () => ({
  emailService: { send: jest.fn().mockResolvedValue(undefined) },
}));

const app = createApp();
let adminToken: string;
let employeeToken: string;
let requestId: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);

  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin') RETURNING id`,
    [hash]
  );
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@test.com', $1, 'applicant') RETURNING id`,
    [hash]
  );

  const adminLogin = await request(app).post('/api/auth/login').send({ employee_number: 'ADM-001', password: 'Test1234!' });
  adminToken = adminLogin.body.accessToken;

  const empLogin = await request(app).post('/api/auth/login').send({ employee_number: 'EMP-001', password: 'Test1234!' });
  employeeToken = empLogin.body.accessToken;

  const reqRes = await request(app)
    .post('/api/requests')
    .set('Authorization', `Bearer ${employeeToken}`)
    .field('requestType', 'late')
    .field('startDate', '2024-01-15')
    .field('reasonCategory', 'oversleeping')
    .field('inputLanguage', 'ja');
  requestId = reqRes.body.id;
});

afterAll(async () => { await clearDatabase(); await closePool(); });

describe('GET /api/admin/requests', () => {
  it('returns all requests for admin', async () => {
    const res = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('filters by request type', async () => {
    const res = await request(app)
      .get('/api/admin/requests?type=absence')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns 403 for applicants', async () => {
    const res = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/admin/requests/:id/status', () => {
  it('approves a request', async () => {
    const res = await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(res.status).toBe(200);

    const listRes = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body[0].status).toBe('approved');
  });

  it('sends email to applicant on rejection', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected' });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['emp@test.com'] })
    );
  });

  it('does not send email on approval', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();
    await request(app)
      .patch(`/api/admin/requests/${requestId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(emailService.send).not.toHaveBeenCalled();
  });
});
