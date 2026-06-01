import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import path from 'path';
import ExcelJS from 'exceljs';
import { pool } from './pool';

const EMPLOYEES = [
  { employee_number: '2407029', name_ja: 'ドンカナ　サイ　キラン',      name_en: 'Donkana SaiKiran',    dispatch_company: 'システム開発1課（新⻑⽥216）' },
  { employee_number: '2407032', name_ja: 'カニティ　ゴウタム',           name_en: 'Kanithi Gowtham',     dispatch_company: '受託開発室' },
  { employee_number: '2407036', name_ja: 'モハメド　ロシャン',           name_en: 'Mohammed Roshan',     dispatch_company: 'システム開発1課（神⼾）' },
  { employee_number: '2407039', name_ja: 'プラディオット',               name_en: 'Pradyot',             dispatch_company: '受託開発室' },
  { employee_number: '2407041', name_ja: 'マダン　リティック',           name_en: 'Madan Ritik',         dispatch_company: 'システム開発1課（神⼾）' },
  { employee_number: '2407048', name_ja: 'ソニ　ユーワン',               name_en: 'Soni Youwan',         dispatch_company: '受託開発室' },
  { employee_number: '2510004', name_ja: 'パスワン　ガウラヴ',           name_en: 'Paswan Gaurav',       dispatch_company: '受託開発室' },
  { employee_number: '2510006', name_ja: 'ベシュラ　アルハン　チャラン', name_en: 'Beshra Alhan Charan', dispatch_company: 'システム開発1課（神⼾）' },
];

function generatePassword(): string {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (s: string) => s[randomInt(0, s.length)];
  return pick(upper) + pick(lower) + pick(lower) + pick(lower)
       + pick(digits) + pick(digits) + pick(digits) + pick(digits) + '!';
}

async function seed() {
  // 1. Remove old test accounts and all their dependent data (cascades handle the rest)
  // Null out reviewed_by references first (FK has no ON DELETE SET NULL)
  const { rows: oldUsers } = await pool.query(
    `SELECT id FROM users WHERE employee_number IN ('ADMIN-001', 'EMP-001')`
  );
  if (oldUsers.length > 0) {
    const oldIds = oldUsers.map(u => u.id);
    await pool.query(`UPDATE requests SET reviewed_by = NULL WHERE reviewed_by = ANY($1::uuid[])`, [oldIds]);
  }
  await pool.query(`DELETE FROM users WHERE employee_number IN ('ADMIN-001', 'EMP-001')`);

  // 2. Upsert Chiiho as admin with a known password
  const CHIIHO_PASSWORD = 'Chiiho2407!';
  const chiihoHash = await bcrypt.hash(CHIIHO_PASSWORD, 12);
  await pool.query(`
    INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role)
    VALUES ($1, $2, $3, $4, $5, 'admin')
    ON CONFLICT (employee_number) DO UPDATE SET
      name_ja       = EXCLUDED.name_ja,
      name_en       = EXCLUDED.name_en,
      email         = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash
  `, ['0000208', '佐野　ちいほ', 'Chiiho Sano', 'c_sano@morabu.com', chiihoHash]);

  const { rows: [chiiho] } = await pool.query(
    `SELECT id FROM users WHERE employee_number = '0000208'`
  );

  // 3. Upsert each employee, generate password, assign Chiiho as manager
  const passwordMap: Record<string, string> = {};

  for (const emp of EMPLOYEES) {
    const plain = generatePassword();
    passwordMap[emp.employee_number] = plain;
    const hash = await bcrypt.hash(plain, 12);

    await pool.query(`
      INSERT INTO users (employee_number, name_ja, name_en, email, password_hash, role, dispatch_company)
      VALUES ($1, $2, $3, $4, $5, 'applicant', $6)
      ON CONFLICT (employee_number) DO UPDATE SET
        name_ja          = EXCLUDED.name_ja,
        name_en          = EXCLUDED.name_en,
        email            = EXCLUDED.email,
        password_hash    = EXCLUDED.password_hash,
        dispatch_company = EXCLUDED.dispatch_company
    `, [
      emp.employee_number,
      emp.name_ja,
      emp.name_en,
      `${emp.employee_number}@noemail.local`,
      hash,
      emp.dispatch_company,
    ]);

    const { rows: [empRow] } = await pool.query(
      `SELECT id FROM users WHERE employee_number = $1`, [emp.employee_number]
    );
    await pool.query(
      `INSERT INTO employee_managers (employee_id, manager_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [empRow.id, chiiho.id]
    );
  }

  // 4. Write passwords into column H of the spreadsheet
  const xlsxPath = path.join(__dirname, '../../../登録者リスト一覧.xlsx');
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsxPath);
    const ws = wb.worksheets[0];

    if (!ws.getCell('H1').value) {
      ws.getCell('H1').value = '仮パスワード';
    }

    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const empNum = String(row.getCell(1).value ?? '');
      if (passwordMap[empNum]) {
        row.getCell(8).value = passwordMap[empNum];
      }
    });

    await wb.xlsx.writeFile(xlsxPath);
    console.log('Spreadsheet updated: 登録者リスト一覧.xlsx column H\n');
  } catch (e) {
    console.warn('Could not update spreadsheet:', (e as Error).message, '\n');
  }

  // 5. Print all credentials
  console.log('=== GENERATED CREDENTIALS ===');
  console.log(`Admin   0000208  (佐野　ちいほ)  ${CHIIHO_PASSWORD}`);
  console.log('--- Employees ---');
  for (const emp of EMPLOYEES) {
    console.log(`${emp.employee_number}  ${emp.name_en.padEnd(24)}  ${passwordMap[emp.employee_number]}`);
  }
  console.log('=============================\n');
  console.log('Seed complete. Passwords also written to 登録者リスト一覧.xlsx column H.');

  await pool.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
