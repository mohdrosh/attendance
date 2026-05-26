import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();
let adminToken: string;
let employeeToken: string;
let requestId: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);

  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin')`,
    [hash]
  );
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@test.com', $1, 'applicant')`,
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
    .field('reasonCategory', 'weather_transport')
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

describe('GET /api/admin/requests — is_read field', () => {
  it('includes is_read boolean in each request (false by default)', async () => {
    const res = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body[0].is_read).toBe('boolean');
    expect(res.body[0].is_read).toBe(false);
  });
});

describe('POST /api/admin/requests/:id/read', () => {
  it('marks request as read and reflects in GET', async () => {
    const readRes = await request(app)
      .post(`/api/admin/requests/${requestId}/read`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body).toEqual({ ok: true });

    const listRes = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body[0].is_read).toBe(true);
  });

  it('is idempotent — calling twice does not error', async () => {
    await request(app).post(`/api/admin/requests/${requestId}/read`).set('Authorization', `Bearer ${adminToken}`);
    const res = await request(app).post(`/api/admin/requests/${requestId}/read`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 403 for applicants', async () => {
    const res = await request(app)
      .post(`/api/admin/requests/${requestId}/read`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/requests/:id/unread', () => {
  it('marks request as unread after being read', async () => {
    await request(app).post(`/api/admin/requests/${requestId}/read`).set('Authorization', `Bearer ${adminToken}`);

    const unreadRes = await request(app)
      .post(`/api/admin/requests/${requestId}/unread`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body).toEqual({ ok: true });

    const listRes = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body[0].is_read).toBe(false);
  });

  it('returns 403 for applicants', async () => {
    const res = await request(app)
      .post(`/api/admin/requests/${requestId}/unread`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/admin/requests/:id', () => {
  it('deletes the request and removes it from GET', async () => {
    const delRes = await request(app)
      .delete(`/api/admin/requests/${requestId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body).toEqual({ ok: true });

    const listRes = await request(app).get('/api/admin/requests').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body).toHaveLength(0);
  });

  it('returns 404 for non-existent request', async () => {
    const res = await request(app)
      .delete('/api/admin/requests/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 for applicants', async () => {
    const res = await request(app)
      .delete(`/api/admin/requests/${requestId}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});
