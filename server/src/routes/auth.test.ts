import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5, 'applicant')`,
    ['EMP-001', 'テスト太郎', 'Test Taro', 'test@company.com', hash]
  );
});

afterAll(async () => {
  await clearDatabase();
  await closePool();
});

describe('POST /api/auth/login', () => {
  it('returns access token and user profile on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'EMP-001', password: 'Test1234!' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.employee_number).toBe('EMP-001');
    expect(res.body.user.role).toBe('applicant');
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'EMP-001', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 401 on unknown employee number', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'NOBODY', password: 'Test1234!' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns new access token using refresh cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'EMP-001', password: 'Test1234!' });

    const cookie = loginRes.headers['set-cookie'][0];

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('returns 401 with no cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('clears cookie and invalidates refresh token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'EMP-001', password: 'Test1234!' });

    const cookie = loginRes.headers['set-cookie'][0];

    await request(app).post('/api/auth/logout').set('Cookie', cookie);

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookie);

    expect(refreshRes.status).toBe(401);
  });
});
