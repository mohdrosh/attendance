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

describe('POST /api/auth/login — deactivated account', () => {
  it('returns 401 with account_deactivated when is_active is false', async () => {
    const hash = await bcrypt.hash('Test1234!', 10);
    await pool.query(
      `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role, is_active)
       VALUES ('DEACT-001', '無効太郎', 'Deactivated User', 'deact@test.com', $1, 'applicant', false)`,
      [hash]
    );
    const res = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'DEACT-001', password: 'Test1234!' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('account_deactivated');
  });
});

describe('POST /api/auth/forgot-password', () => {
  const MSG = 'If the details match, a new password has been sent.';

  it('returns 200 with standard message when employee_number + email match', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ employee_number: 'EMP-001', email: 'test@company.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(MSG);
  });

  it('returns 200 with standard message when email does not match', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ employee_number: 'EMP-001', email: 'wrong@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(MSG);
  });

  it('returns 200 with standard message for unknown employee number', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ employee_number: 'NOBODY', email: 'any@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(MSG);
  });

  it('returns 400 when employee_number is missing', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@company.com' });
    expect(res.status).toBe(400);
  });

  it('changes the password so the old password no longer works after a match', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ employee_number: 'EMP-001', email: 'test@company.com' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ employee_number: 'EMP-001', password: 'Test1234!' });
    expect(loginRes.status).toBe(401);
  });
});
