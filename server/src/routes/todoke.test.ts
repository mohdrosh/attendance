import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();
let adminToken: string;
let employeeToken: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);

  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin')`,
    [hash]
  );
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role, dispatch_company)
     VALUES ('2407032', 'テスト太郎', 'Test Taro', 'emp@test.com', $1, 'applicant', 'テスト株式会社')`,
    [hash]
  );

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ employee_number: 'ADM-001', password: 'Test1234!' });
  adminToken = adminLogin.body.accessToken;

  const empLogin = await request(app)
    .post('/api/auth/login')
    .send({ employee_number: '2407032', password: 'Test1234!' });
  employeeToken = empLogin.body.accessToken;
});

afterAll(async () => {
  await clearDatabase();
  await closePool();
});

describe('POST /api/todoke/generate', () => {
  it('returns 401 with no auth', async () => {
    const res = await request(app)
      .post('/api/todoke/generate')
      .send({ requestType: 'late', startDate: '2026-05-27' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for admin JWT', async () => {
    const res = await request(app)
      .post('/api/todoke/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requestType: 'late', startDate: '2026-05-27', reasonCategory: 'illness' });
    expect(res.status).toBe(403);
  });

  it('returns 200 xlsx buffer for a late request', async () => {
    const res = await request(app)
      .post('/api/todoke/generate')
      .set('Authorization', `Bearer ${employeeToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .send({
        requestType: 'late',
        startDate: '2026-05-27',
        endDate: '',
        timeFrom: '09:30',
        timeTo: '10:00',
        reasonCategory: 'illness',
        reasonDetail: '',
        leaveType: '',
        adminMessage: '',
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch('spreadsheetml.sheet');
    expect((res.body as Buffer).length).toBeGreaterThan(0);
  });

  it('returns 200 xlsx buffer for an absence request', async () => {
    const res = await request(app)
      .post('/api/todoke/generate')
      .set('Authorization', `Bearer ${employeeToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .send({
        requestType: 'absence',
        startDate: '2026-05-27',
        endDate: '2026-05-28',
        timeFrom: '',
        timeTo: '',
        reasonCategory: 'personal',
        reasonDetail: '',
        leaveType: 'paid',
        adminMessage: '',
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch('spreadsheetml.sheet');
    expect((res.body as Buffer).length).toBeGreaterThan(0);
  });
});
