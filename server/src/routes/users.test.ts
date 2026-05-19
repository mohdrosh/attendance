import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();
let accessToken: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);

  const adminRes = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('MGR-001', '管理者', 'Manager', 'mgr@company.com', $1, 'admin') RETURNING id`,
    [hash]
  );
  const managerId = adminRes.rows[0].id;

  const empRes = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@company.com', $1, 'applicant') RETURNING id`,
    [hash]
  );
  const employeeId = empRes.rows[0].id;

  await pool.query(
    `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2)`,
    [employeeId, managerId]
  );

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ employee_number: 'EMP-001', password: 'Test1234!' });
  accessToken = loginRes.body.accessToken;
});

afterAll(async () => { await clearDatabase(); await closePool(); });

describe('GET /api/users/me', () => {
  it('returns user profile', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee_number).toBe('EMP-001');
    expect(Array.isArray(res.body.trainLines)).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/me/managers', () => {
  it('returns only managers assigned to this user', async () => {
    const res = await request(app)
      .get('/api/users/me/managers')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].employee_number).toBe('MGR-001');
  });
});
