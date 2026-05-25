import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

const app = createApp();
let adminToken: string;
let adminId: string;
let employeeId: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);
  const { rows: [adm] } = await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin') RETURNING id`,
    [hash]
  );
  adminId = adm.id;
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
  it('creates employee, auto-generates password, returns id and tempPassword', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-002', name_ja: '新入社員', name_en: 'New Employee', email: 'new@test.com', role: 'applicant' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword).toHaveLength(12);
  });

  it('returns 400 when required field is missing', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-003', name_ja: '太郎', name_en: 'Taro', email: 'x@test.com' }); // missing role
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate employee_number', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-001', name_ja: '別', name_en: 'Other', email: 'other@test.com', role: 'applicant' });
    expect(res.status).toBe(409);
  });

  it('returns 409 when email already exists', async () => {
    await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-010', name_ja: '最初', name_en: 'First', email: 'dup@test.com', role: 'applicant' });
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-011', name_ja: '二番目', name_en: 'Second', email: 'dup@test.com', role: 'applicant' });
    expect(res.status).toBe(409);
  });

  it('writes a created audit log entry', async () => {
    const res = await request(app)
      .post('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-099', name_ja: '監査', name_en: 'Audit Test', email: 'audit@test.com', role: 'applicant' });
    const newId = res.body.id;
    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [newId]
    );
    expect(rows[0]?.action).toBe('created');
  });
});

describe('GET /api/admin/employees', () => {
  it('returns list of all employees including is_active', async () => {
    const res = await request(app)
      .get('/api/admin/employees')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(typeof res.body[0].is_active).toBe('boolean');
  });
});

describe('GET /api/admin/employees/:id', () => {
  it('returns employee with is_active, train_lines and managers', async () => {
    const res = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee_number).toBe('EMP-001');
    expect(typeof res.body.is_active).toBe('boolean');
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
  it('updates employee name_en and writes updated audit log', async () => {
    await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Updated Name' });
    const getRes = await request(app)
      .get(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.body.name_en).toBe('Updated Name');

    const { rows } = await pool.query(
      `SELECT action, changes FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('updated');
    expect(rows[0]?.changes?.name_en?.to).toBe('Updated Name');
  });

  it('updates employee_number', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employee_number: 'EMP-999' });
    expect(res.status).toBe(200);
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

describe('POST /api/admin/employees/:id/reset-password', () => {
  it('resets password and returns tempPassword', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.tempPassword).toBe('string');
    expect(res.body.tempPassword).toHaveLength(12);
  });

  it('writes password_reset audit log', async () => {
    await request(app)
      .post(`/api/admin/employees/${employeeId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);
    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('password_reset');
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .post('/api/admin/employees/00000000-0000-0000-0000-000000000000/reset-password')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/employees/:id/deactivate', () => {
  it('deactivates an active account', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [employeeId]);
    expect(rows[0].is_active).toBe(false);
  });

  it('writes deactivated audit log', async () => {
    await request(app)
      .patch(`/api/admin/employees/${employeeId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('deactivated');
  });

  it('returns 400 when trying to deactivate yourself', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${adminId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 409 when account is already deactivated', async () => {
    await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [employeeId]);
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .patch('/api/admin/employees/00000000-0000-0000-0000-000000000000/deactivate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/admin/employees/:id/reactivate', () => {
  it('reactivates a deactivated account', async () => {
    await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [employeeId]);
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT is_active FROM users WHERE id = $1`, [employeeId]);
    expect(rows[0].is_active).toBe(true);
  });

  it('writes reactivated audit log', async () => {
    await pool.query(`UPDATE users SET is_active = false WHERE id = $1`, [employeeId]);
    await request(app)
      .patch(`/api/admin/employees/${employeeId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('reactivated');
  });

  it('returns 409 when account is already active', async () => {
    const res = await request(app)
      .patch(`/api/admin/employees/${employeeId}/reactivate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .patch('/api/admin/employees/00000000-0000-0000-0000-000000000000/reactivate')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admin/employees/:id', () => {
  it('hard deletes employee and audit log employee_id becomes null', async () => {
    await request(app)
      .delete(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    const { rows: userRows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [employeeId]);
    expect(userRows).toHaveLength(0);

    const { rows: auditRows } = await pool.query(
      `SELECT action, snapshot, employee_id FROM employee_audit_log WHERE employee_id IS NULL AND changed_by = $1`,
      [adminId]
    );
    expect(auditRows[0]?.action).toBe('deleted');
    expect(auditRows[0]?.snapshot?.employee_number).toBe('EMP-001');
    expect(auditRows[0]?.employee_id).toBeNull();
  });

  it('returns 400 when trying to delete yourself', async () => {
    const res = await request(app)
      .delete(`/api/admin/employees/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .delete('/api/admin/employees/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/admin/employees/:id/audit-log', () => {
  it('returns audit log entries newest first', async () => {
    await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'First Change' });
    await request(app)
      .patch(`/api/admin/employees/${employeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name_en: 'Second Change' });

    const res = await request(app)
      .get(`/api/admin/employees/${employeeId}/audit-log`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].action).toBe('updated');
    expect(new Date(res.body[0].changed_at) >= new Date(res.body[1].changed_at)).toBe(true);
  });

  it('returns 404 for non-existent employee', async () => {
    const res = await request(app)
      .get('/api/admin/employees/00000000-0000-0000-0000-000000000000/audit-log')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/employees/:id/managers', () => {
  it('assigns a manager and writes manager_assigned audit log', async () => {
    const res = await request(app)
      .post(`/api/admin/employees/${employeeId}/managers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ managerId: adminId });
    expect(res.status).toBe(201);

    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('manager_assigned');
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
  it('removes manager and writes manager_removed audit log', async () => {
    await pool.query(
      `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2)`,
      [employeeId, adminId]
    );
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/managers/${adminId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT action FROM employee_audit_log WHERE employee_id = $1`, [employeeId]
    );
    expect(rows[0]?.action).toBe('manager_removed');
  });

  it('returns 404 when assignment does not exist', async () => {
    const res = await request(app)
      .delete(`/api/admin/employees/${employeeId}/managers/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
