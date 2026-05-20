import { MessageInput, MessageOutput, NotificationInput, RejectionNotificationInput } from './types';

function formatDateJa(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateEn(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const subjectJa: Record<string, string> = {
  late: '【遅刻連絡】',
  early_departure: '【早退連絡】',
  absence: '【欠勤連絡】',
  other_request: '【その他連絡】',
};

const subjectEn: Record<string, string> = {
  late: '[Late Arrival Notice]',
  early_departure: '[Early Departure Notice]',
  absence: '[Absence Notice]',
  other_request: '[Other Request]',
};

function reasonBodyJa(input: MessageInput): string {
  switch (input.reasonCategory) {
    case 'train_delay':
      return `電車遅延（${input.trainLineName ?? ''}）のため`;
    case 'oversleeping':
      return '寝過ごしのため';
    case 'child_dropoff':
      return '保育園・学校の送りのため';
    case 'illness':
      return `体調不良${input.reasonDetail ? `（${input.reasonDetail}）` : ''}のため`;
    case 'personal':
      return '私用のため';
    case 'work_appointment':
      return '業務上のアポイントのため';
    case 'other_appointment':
      return `アポイント${input.reasonDetail ? `（${input.reasonDetail}）` : ''}のため`;
    case 'direct_home':
      return '客先から直帰のため';
    case 'other':
      return `${input.reasonDetail ?? 'その他の理由'}のため`;
  }
}

function reasonBodyEn(input: MessageInput): string {
  switch (input.reasonCategory) {
    case 'train_delay':
      return `train delay (${input.trainLineName ?? ''})`;
    case 'oversleeping':
      return 'oversleeping';
    case 'child_dropoff':
      return 'dropping my child at school/daycare';
    case 'illness':
      return `illness${input.reasonDetail ? ` (${input.reasonDetail})` : ''}`;
    case 'personal':
      return 'personal reasons';
    case 'work_appointment':
      return 'a work-related appointment';
    case 'other_appointment':
      return `an appointment${input.reasonDetail ? ` (${input.reasonDetail})` : ''}`;
    case 'direct_home':
      return 'going home directly from a client meeting';
    case 'other':
      return input.reasonDetail ?? 'other reasons';
  }
}

function buildJapanese(input: MessageInput): string {
  const dateStr = input.endDate
    ? `${formatDateJa(input.startDate)}～${formatDateJa(input.endDate)}`
    : formatDateJa(input.startDate);

  const subject = `件名：${subjectJa[input.requestType]}${input.employeeName.ja}　${dateStr}`;
  const greeting = `${input.employeeName.ja}です。`;
  const reason = reasonBodyJa(input);

  let body = '';
  if (input.requestType === 'late') {
    body = `本日、${reason}、\n出社が${input.timeTo}頃になります。`;
  } else if (input.requestType === 'early_departure') {
    body = `本日、${reason}、\n${input.timeFrom}頃に早退させていただきます。`;
  } else if (input.requestType === 'absence') {
    const leaveMap: Record<string, string> = { paid: '有給休暇', unpaid: '欠勤', substitute: '振替休日', other: 'その他' };
    const leaveStr = input.leaveType ? `（${leaveMap[input.leaveType]}）` : '';
    body = `${dateStr}${leaveStr}、${reason}お休みをいただきます。`;
  } else {
    body = `${dateStr}、${reason}直帰いたします。`;
  }

  const apology = 'ご迷惑をおかけし、申し訳ございません。';
  const parts = [subject, '', greeting, body, apology];
  if (input.adminMessage) parts.push('', input.adminMessage);
  return parts.join('\n');
}

function buildEnglish(input: MessageInput): string {
  const dateStr = input.endDate
    ? `${formatDateEn(input.startDate)} – ${formatDateEn(input.endDate)}`
    : formatDateEn(input.startDate);

  const subject = `Subject: ${subjectEn[input.requestType]} ${input.employeeName.en} - ${dateStr}`;
  const greeting = `This is ${input.employeeName.en}.`;
  const reason = reasonBodyEn(input);

  let body = '';
  if (input.requestType === 'late') {
    body = `I will be arriving late today due to ${reason}.\nI expect to arrive at around ${input.timeTo}.`;
  } else if (input.requestType === 'early_departure') {
    body = `I will be leaving early today due to ${reason}.\nI expect to leave at around ${input.timeFrom}.`;
  } else if (input.requestType === 'absence') {
    const leaveMap: Record<string, string> = { paid: 'paid leave', unpaid: 'unpaid leave', substitute: 'substitute holiday', other: 'leave' };
    const leaveStr = input.leaveType ? ` (${leaveMap[input.leaveType]})` : '';
    body = `I will be absent on ${dateStr}${leaveStr} due to ${reason}.`;
  } else {
    body = `I will be going home directly from a client meeting on ${dateStr}.`;
  }

  const apology = 'I sincerely apologize for the inconvenience.';
  const parts = [subject, '', greeting, body, apology];
  if (input.adminMessage) parts.push('', input.adminMessage);
  return parts.join('\n');
}

export function generateMessage(input: MessageInput): MessageOutput {
  const japanese = buildJapanese(input);
  if (input.inputLanguage === 'en') {
    return { japanese, english: buildEnglish(input) };
  }
  return { japanese };
}

const requestTypeJa: Record<string, string> = {
  late: '遅刻',
  early_departure: '早退',
  absence: '欠勤',
  other_request: 'その他',
};

const requestTypeEn: Record<string, string> = {
  late: 'Late Arrival',
  early_departure: 'Early Departure',
  absence: 'Absence',
  other_request: 'Other Request',
};

export function generateApprovalNotification(input: NotificationInput): MessageOutput {
  const dateJa = input.endDate
    ? `${formatDateJa(input.startDate)}～${formatDateJa(input.endDate)}`
    : formatDateJa(input.startDate);
  const dateEn = input.endDate
    ? `${formatDateEn(input.startDate)} – ${formatDateEn(input.endDate)}`
    : formatDateEn(input.startDate);

  const timeJa = input.timeFrom
    ? `\n時間：${input.timeFrom}${input.timeTo ? ` 〜 ${input.timeTo}` : ''}`
    : '';
  const timeEn = input.timeFrom
    ? `\nTime: ${input.timeFrom}${input.timeTo ? ` – ${input.timeTo}` : ''}`
    : '';

  const japanese = [
    `件名：【承認】${input.employeeName.ja}　${dateJa}`,
    '',
    `${input.employeeName.ja} さん`,
    '',
    `申請種別：${requestTypeJa[input.requestType]}`,
    `対象日：${dateJa}${timeJa}`,
    '',
    'ご申請の内容を承認しました。',
  ].join('\n');

  const english = [
    `Subject: [Approved] ${input.employeeName.en} – ${dateEn}`,
    '',
    `Dear ${input.employeeName.en},`,
    '',
    `Type: ${requestTypeEn[input.requestType]}`,
    `Date: ${dateEn}${timeEn}`,
    '',
    'Your attendance request has been approved.',
  ].join('\n');

  return { japanese, english };
}

export function generateRejectionNotification(input: RejectionNotificationInput): MessageOutput {
  const dateJa = input.endDate
    ? `${formatDateJa(input.startDate)}～${formatDateJa(input.endDate)}`
    : formatDateJa(input.startDate);
  const dateEn = input.endDate
    ? `${formatDateEn(input.startDate)} – ${formatDateEn(input.endDate)}`
    : formatDateEn(input.startDate);

  const timeJa = input.timeFrom
    ? `\n時間：${input.timeFrom}${input.timeTo ? ` 〜 ${input.timeTo}` : ''}`
    : '';
  const timeEn = input.timeFrom
    ? `\nTime: ${input.timeFrom}${input.timeTo ? ` – ${input.timeTo}` : ''}`
    : '';

  const jaLines = [
    `件名：【否認】${input.employeeName.ja}　${dateJa}`,
    '',
    `${input.employeeName.ja} さん`,
    '',
    `申請種別：${requestTypeJa[input.requestType]}`,
    `対象日：${dateJa}${timeJa}`,
    '',
    '申し訳ありませんが、ご申請の内容を承認することができませんでした。',
  ];
  if (input.rejectionReason) {
    jaLines.push('', `理由：${input.rejectionReason}`);
  }
  jaLines.push('', '詳細については、担当者にお問い合わせください。');

  const enLines = [
    `Subject: [Not Approved] ${input.employeeName.en} – ${dateEn}`,
    '',
    `Dear ${input.employeeName.en},`,
    '',
    `Type: ${requestTypeEn[input.requestType]}`,
    `Date: ${dateEn}${timeEn}`,
    '',
    'We regret to inform you that your attendance request has not been approved.',
  ];
  if (input.rejectionReason) {
    enLines.push('', `Reason: ${input.rejectionReason}`);
  }
  enLines.push('', 'Please contact your manager for further details.');

  return {
    japanese: jaLines.join('\n'),
    english: enLines.join('\n'),
  };
}
