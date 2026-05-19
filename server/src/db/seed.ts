import bcrypt from 'bcryptjs';
import { pool } from './pool';

async function seed() {
  const passwordHash = await bcrypt.hash('Admin1234!', 12);

  await pool.query(`
    INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
    VALUES ($1, $2, $3, $4, $5, 'admin')
    ON CONFLICT (employee_number) DO NOTHING
  `, ['ADMIN-001', '管理者', 'Admin User', 'admin@company.com', passwordHash]);

  const empHash = await bcrypt.hash('Emp1234!', 12);
  await pool.query(`
    INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
    VALUES ($1, $2, $3, $4, $5, 'applicant')
    ON CONFLICT (employee_number) DO NOTHING
  `, ['EMP-001', 'テスト太郎', 'Taro Test', 'emp@company.com', empHash]);

  const { rows: [admin] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'ADMIN-001'`);
  const { rows: [emp] } = await pool.query(`SELECT id FROM users WHERE employee_number = 'EMP-001'`);
  await pool.query(
    `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [emp.id, admin.id]
  );

  console.log('Seed complete. Admin login: ADMIN-001 / Admin1234!');
  console.log('Seed complete. Employee login: EMP-001 / Emp1234!');
  await pool.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
