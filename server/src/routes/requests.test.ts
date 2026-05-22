import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../app';
import { pool } from '../db/pool';
import { clearDatabase, closePool } from '../db/testHelpers';

jest.mock('../services/email/NodemailerService', () => ({
  emailService: { send: jest.fn().mockResolvedValue(undefined) },
}));

const app = createApp();
let token: string;

beforeEach(async () => {
  await clearDatabase();
  const hash = await bcrypt.hash('Test1234!', 10);
  await pool.query(
    `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
     VALUES ('EMP-001', 'テスト太郎', 'Test Taro', 'emp@test.com', $1, 'applicant')`,
    [hash]
  );
  const res = await request(app).post('/api/auth/login').send({ employee_number: 'EMP-001', password: 'Test1234!' });
  token = res.body.accessToken;
});

afterAll(async () => { await clearDatabase(); await closePool(); });

describe('GET /api/requests', () => {
  it('returns empty array when no requests', async () => {
    const res = await request(app).get('/api/requests').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/requests');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/requests', () => {
  it('creates a request and returns id', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'late')
      .field('startDate', '2024-01-15')
      .field('timeFrom', '09:00')
      .field('timeTo', '10:00')
      .field('reasonCategory', 'weather_transport')
      .field('inputLanguage', 'ja');

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('request appears in GET /api/requests after creation', async () => {
    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'absence')
      .field('startDate', '2024-01-15')
      .field('reasonCategory', 'personal')
      .field('leaveType', 'paid')
      .field('inputLanguage', 'ja');

    const res = await request(app).get('/api/requests').set('Authorization', `Bearer ${token}`);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].request_type).toBe('absence');
    expect(res.body[0].status).toBe('pending');
  });

  it('returns 403 for admin users', async () => {
    const hash = await bcrypt.hash('Test1234!', 10);
    await pool.query(
      `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
       VALUES ('ADM-001', '管理者', 'Admin', 'adm@test.com', $1, 'admin')`,
      [hash]
    );
    const adminLogin = await request(app).post('/api/auth/login').send({ employee_number: 'ADM-001', password: 'Test1234!' });
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${adminLogin.body.accessToken}`)
      .field('requestType', 'late')
      .field('startDate', '2024-01-15')
      .field('reasonCategory', 'weather_transport')
      .field('inputLanguage', 'ja');
    expect(res.status).toBe(403);
  });

  it('sends email to selected manager when managerId is provided', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();

    const hash = await bcrypt.hash('Test1234!', 10);
    const { rows: [manager] } = await pool.query(
      `INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
       VALUES ('MGR-001', '田中部長', 'Manager Tanaka', 'mgr@test.com', $1, 'admin') RETURNING id`,
      [hash]
    );
    const { rows: [emp] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'EMP-001'`);
    await pool.query(
      `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2)`,
      [emp.id, manager.id]
    );

    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'late')
      .field('startDate', '2024-01-15')
      .field('reasonCategory', 'weather_transport')
      .field('inputLanguage', 'ja')
      .field('managerId', manager.id);

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['mgr@test.com'] })
    );
  });

  it('does not send email when managerId is not provided', async () => {
    const { emailService } = require('../services/email/NodemailerService');
    (emailService.send as jest.Mock).mockClear();

    await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'late')
      .field('startDate', '2024-01-15')
      .field('reasonCategory', 'weather_transport')
      .field('inputLanguage', 'ja');

    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('creates a chokko request without reasonCategory', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'chokko')
      .field('startDate', '2024-01-15')
      .field('inputLanguage', 'ja');
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('creates a kyujitsu_shukkin request without reasonCategory', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'kyujitsu_shukkin')
      .field('startDate', '2024-01-15')
      .field('inputLanguage', 'ja');
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });

  it('creates a chokki request without reasonCategory', async () => {
    const res = await request(app)
      .post('/api/requests')
      .set('Authorization', `Bearer ${token}`)
      .field('requestType', 'chokki')
      .field('startDate', '2024-01-15')
      .field('inputLanguage', 'ja');
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });
});
