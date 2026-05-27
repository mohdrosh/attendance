import path from 'path';
import ExcelJS from 'exceljs';
import { generateHankoPng } from './hankoService';

const TEMPLATE_PATH = path.join(__dirname, '../../assets/todoke_template.xlsx');

export interface TodokeInput {
  requestType: string;      // 'late'|'early_departure'|'absence'|'other_request'|'chokko'|'chokki'|'kyujitsu_shukkin'
  startDate: string;        // 'YYYY-MM-DD'
  endDate: string;          // 'YYYY-MM-DD' or ''
  timeFrom: string;         // 'HH:MM' or ''
  timeTo: string;           // 'HH:MM' or ''
  reasonCategory: string;   // e.g. 'illness', 'personal', '' for none
  reasonDetail: string;     // free text or ''
  leaveType: string;        // 'paid'|'unpaid'|'substitute'|'special' or ''
  adminMessage: string;     // free text or ''
  employeeNameJa: string;   // e.g. 'カニティゴウタム'
  employeeNumber: string;   // 7-digit numeric string e.g. '2407032'
  dispatchCompany: string;  // e.g. 'システム設計開発部' or ''
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

const REASON_LABEL: Record<string, string> = {
  illness: '体調不良',
  family: '家庭の事情',
  personal: '私用',
  weather_transport: '天候・交通機関の影響',
  client_meeting: '顧客との打ち合わせ',
  different_office: '他オフィスへの出勤',
  work_event: '業務関連イベント',
  substitute_day: '振替出勤',
  other: '',
};

function buildReasonText(input: TodokeInput): string {
  const { requestType, reasonCategory, reasonDetail, adminMessage } = input;

  if (requestType === 'other_request') {
    return adminMessage;
  }

  if (requestType === 'chokko') {
    const suffix = reasonCategory
      ? `。${REASON_LABEL[reasonCategory] ?? reasonDetail}`
      : '';
    return '直行のため' + suffix;
  }

  if (requestType === 'chokki') {
    const suffix = reasonCategory
      ? `。${REASON_LABEL[reasonCategory] ?? reasonDetail}`
      : '';
    return '直帰のため' + suffix;
  }

  if (requestType === 'kyujitsu_shukkin') {
    return reasonCategory ? (REASON_LABEL[reasonCategory] ?? reasonDetail) : '';
  }

  // late, early_departure, absence
  if (reasonCategory === 'train_delay') {
    return reasonDetail ? `${reasonDetail}の遅延のため。` : '電車遅延のため。';
  }

  if (reasonCategory === 'oversleeping') {
    return '寝坊のため。';
  }

  let base = REASON_LABEL[reasonCategory] ?? '';
  if (reasonCategory === 'other') {
    base = reasonDetail;
  } else if (reasonDetail) {
    base = base + `（${reasonDetail}）`;
  }
  return base;
}

export async function generateTodoke(input: TodokeInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const ws = workbook.getWorksheet('届（設計開発）');
  if (!ws) throw new Error('Todoke template worksheet not found');

  // ── Creation date ──────────────────────────────────────────────────────────
  const now = new Date();
  ws.getCell('Z5').value = now.getFullYear();
  ws.getCell('AD5').value = now.getMonth() + 1;
  ws.getCell('AF5').value = now.getDate();

  // ── Employee info ──────────────────────────────────────────────────────────
  ws.getCell('V9').value = input.dispatchCompany || '';
  ws.getCell('V11').value = input.employeeNameJa;

  // Employee number — 7 digits, left-padded with zeros
  const digits = input.employeeNumber.padStart(7, '0').slice(0, 7);
  const digitCells = ['V13', 'W13', 'X13', 'Y13', 'Z13', 'AA13', 'AB13'];
  for (let i = 0; i < 7; i++) {
    ws.getCell(digitCells[i]).value = parseInt(digits[i], 10);
  }

  // ── Type checkboxes — reset all 8, then set the correct one ───────────────
  const checkboxCells = ['F18', 'K18', 'Q18', 'W18', 'F20', 'K20', 'Q20', 'W20'];
  for (const cell of checkboxCells) {
    ws.getCell(cell).value = '□';
  }

  const { requestType, leaveType } = input;
  let checkCell: string | null = null;

  if (requestType === 'late') {
    checkCell = 'F20';
  } else if (requestType === 'early_departure') {
    checkCell = 'K20';
  } else if (requestType === 'absence') {
    if (leaveType === 'unpaid') checkCell = 'F18';
    else if (leaveType === 'substitute') checkCell = 'K18';
    else if (leaveType === 'paid') checkCell = 'Q20';
    else if (leaveType === 'special') checkCell = 'W20';
  } else if (requestType === 'kyujitsu_shukkin') {
    checkCell = 'Q18';
  } else if (requestType === 'other_request' || requestType === 'chokko' || requestType === 'chokki') {
    checkCell = 'W18';
  }

  if (checkCell) {
    ws.getCell(checkCell).value = '☑';
  }

  // ── Period — dates ─────────────────────────────────────────────────────────
  const start = new Date(input.startDate + 'T00:00:00');
  const endDateStr = input.endDate || input.startDate;
  const end = new Date(endDateStr + 'T00:00:00');

  ws.getCell('J23').value = start.getFullYear();
  ws.getCell('O23').value = start.getMonth() + 1;
  ws.getCell('R23').value = start.getDate();
  ws.getCell('W23').value = DOW[start.getDay()];

  ws.getCell('J25').value = end.getFullYear();
  ws.getCell('O25').value = end.getMonth() + 1;
  ws.getCell('R25').value = end.getDate();
  ws.getCell('W25').value = DOW[end.getDay()];

  // ── Period — times ─────────────────────────────────────────────────────────
  const TYPES_WITH_TIME = ['late', 'early_departure', 'other_request', 'kyujitsu_shukkin'];
  const hasTime = TYPES_WITH_TIME.includes(requestType);

  let fromHour: string;
  let fromMin: string;
  let toHour: string;
  let toMin: string;

  if (hasTime && input.timeFrom) {
    const [h, m] = input.timeFrom.split(':');
    fromHour = String(parseInt(h, 10)); // strip leading zero
    fromMin = m;
  } else {
    fromHour = '9';
    fromMin = '00';
  }

  if (hasTime && input.timeTo) {
    const [h, m] = input.timeTo.split(':');
    toHour = String(parseInt(h, 10)); // strip leading zero
    toMin = m;
  } else {
    toHour = '17';
    toMin = '45';
  }

  ws.getCell('AA23').value = fromHour;
  ws.getCell('AD23').value = fromMin;
  ws.getCell('AA25').value = toHour;
  ws.getCell('AD25').value = toMin;

  // ── Reason text ────────────────────────────────────────────────────────────
  ws.getCell('F28').value = buildReasonText(input);

  // ── Embed hanko ────────────────────────────────────────────────────────────
  const hankoPng = await generateHankoPng(input.employeeNameJa);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const imageId = workbook.addImage({ buffer: hankoPng as any, extension: 'png' }); // cast needed: ExcelJS types expect node Buffer, but @resvg/resvg-js returns Buffer<ArrayBufferLike>
  ws.addImage(imageId, {
    tl: { col: 31, row: 8 },
    br: { col: 34, row: 11 },
    editAs: 'oneCell',
  } as any);

  // ── Return buffer ──────────────────────────────────────────────────────────
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
