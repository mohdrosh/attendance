import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();
let adminToken: string;
let employeeId: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin')`,
    [hash]
  );
  const adminLogin = await request(app).post('/api/auth/login').send({ employee_number: 'ADM-001', password: 'Test1234!' });
  adminToken = adminLogin.body.accessToken;

  const { rows: [emp] } = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@test.com', $1, 'applicant') RETURNING id`,
    [hash]
  );
  employeeId = emp.id;
});

afterAll(async () => { await clearDatabase(); await closePool(); });

describe('POST /api/admin/employees', () => {
  it('creates a new employee and returns id', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employee_number: 'EMP-002',
        name_ja: '新入社員',
        name_en: 'New Employee',
        email: 'new@test.com',
        password: 'Pass1234!',
        role: 'applicant',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when required field is missing', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-003', name_ja: '太郎', name_en: 'Taro', email: 'x@test.com', role: 'applicant' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password fails validation', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-003', name_ja: '太郎', name_en: 'Taro', email: 'x@test.com', password: 'weak', role: 'applicant' });
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate employee_number', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-001', name_ja: '別', name_en: 'Other', email: 'other@test.com', password: 'Pass1234!', role: 'applicant' });
    expect(res.status).toBe(409);
  });

  it('returns 409 when email already exists', async () => {
    // Create a first employee with a unique email
    await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-010', name_ja: '最初', name_en: 'First', email: 'dup@test.com', password: 'Pass1234!', role: 'applicant' });

    // Attempt to create a second employee with the SAME email but different employee_number
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-011', name_ja: '二番目', name_en: 'Second', email: 'dup@test.com', password: 'Pass1234!', role: 'applicant' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/admin/employees', () => {
  it('returns list of all employees', async () => {
    const res = await request(app)
      .get('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/admin/employees/:id', () => {
  it('returns employee with train_lines and managers arrays', async () => {
    const res = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee_number).toBe('EMP-001');
    expect(Array.isArray(res.body.train_lines)).toBe(true);
    expect(Array.isArray(res.body.managers)).toBe(true);
  });

  it('returns 404 for non-existent id', async () => {
    const res = await request(app)
      .get('/api/admin/employees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/employees/:id', () => {
  it('updates employee name_en', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Updated Name' });
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.name_en).toBe('Updated Name');
  });

  it('returns 400 when role value is invalid', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superuser' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when patching a non-existent employee', async () => {
    const res = await request(app)
      .patch('/api/admin/employees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Ghost' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/employees/:id/managers', () => {
  it('assigns a manager to the employee', async () => {
    const { rows: [admin] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'ADM-001'`);
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/managers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: admin.id });
    expect(res.status).toBe(201);

    const getRes = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.managers).toHaveLength(1);
    expect(getRes.body.managers[0].id).toBe(admin.id);
  });

  it('returns 404 for non-existent manager', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/managers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/employees/:id/managers/:managerId', () => {
  it('removes a manager assignment', async () => {
    const { rows: [admin] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'ADM-001'`);
    await pool.query(
      `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2)`,
      [employeeId, admin.id]
    );
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/managers/${admin.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 when assignment does not exist', async () => {
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/managers/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/employees/:id/train-lines', () => {
  it('adds a train line to an employee', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/train-lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ line_name_ja: '山手線', line_name_en: 'Yamanote Line' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('returns 400 when line names are missing', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/train-lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ line_name_ja: '山手線' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/admin/employees/:id/train-lines/:lineId', () => {
  it('removes a train line', async () => {
    const { rows: [line] } = await pool.query(
      `INSERT INTO train_lines (employee_id, line_name_ja, line_name_en) VALUES ($1, '中央線', 'Chuo Line') RETURNING id`,
      [employeeId]
    );
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/train-lines/${line.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('returns 404 for non-existent train line', async () => {
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/train-lines/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
