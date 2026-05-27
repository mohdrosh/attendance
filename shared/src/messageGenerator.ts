import { MessageInput, MessageOutput } from './types';

function formatDateJa(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDateEn(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const subjectJa: Record<string, string> = {
  late:             '【遅刻連絡】',
  early_departure:  '【早退連絡】',
  absence:          '【欠勤連絡】',
  other_request:    '【その他連絡】',
  chokko:           '【直行連絡】',
  chokki:           '【直帰連絡】',
  kyujitsu_shukkin: '【休日出勤連絡】',
};

const subjectEn: Record<string, string> = {
  late:             '[Late Arrival Notice]',
  early_departure:  '[Early Departure Notice]',
  absence:          '[Absence Notice]',
  other_request:    '[Other Request]',
  chokko:           '[Direct to Client Notice]',
  chokki:           '[Going Directly Home Notice]',
  kyujitsu_shukkin: '[Holiday Work Notice]',
};

function reasonBodyJa(input: MessageInput): string {
  if (!input.reasonCategory) return '';
  switch (input.reasonCategory) {
    case 'illness':
      return `体調不良${input.reasonDetail ? `（${input.reasonDetail}）` : ''}のため`;
    case 'family':
      return '家庭の事情のため';
    case 'personal':
      return '私用のため';
    case 'weather_transport':
      return '天候・交通機関の影響のため';
    case 'client_meeting':
      return '顧客との打ち合わせのため';
    case 'different_office':
      return '他オフィスへの出勤のため';
    case 'work_event':
      return '業務関連イベントのため';
    case 'substitute_day':
      return '振替出勤のため';
    case 'train_delay':
      return `${input.trainLineName ? input.trainLineName + 'の遅延' : '電車遅延'}のため`;
    case 'oversleeping':
      return '寝坊のため';
    case 'other':
      return `${input.reasonDetail ?? 'その他の理由'}のため`;
    default:
      return '';
  }
}

function reasonBodyEn(input: MessageInput): string {
  if (!input.reasonCategory) return '';
  switch (input.reasonCategory) {
    case 'illness':
      return `illness${input.reasonDetail ? ` (${input.reasonDetail})` : ''}`;
    case 'family':
      return 'family circumstances';
    case 'personal':
      return 'personal reasons';
    case 'weather_transport':
      return 'weather or transportation issues';
    case 'client_meeting':
      return 'a client meeting';
    case 'different_office':
      return 'going to a different office';
    case 'work_event':
      return 'a work-related event';
    case 'substitute_day':
      return 'a substitute working day';
    case 'train_delay':
      return input.trainLineName ? `train delay on ${input.trainLineName}` : 'train delay';
    case 'oversleeping':
      return 'oversleeping';
    case 'other':
      return input.reasonDetail ?? 'other reasons';
    default:
      return '';
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
    const leaveMap: Record<string, string> = {
      paid: '有給休暇', unpaid: '欠勤', substitute: '振替休日', special: '特別休暇（慶弔）',
    };
    const leaveStr = input.leaveType ? `（${leaveMap[input.leaveType]}）` : '';
    body = `${dateStr}${leaveStr}、${reason}お休みをいただきます。`;
  } else if (input.requestType === 'chokko') {
    body = reason
      ? `${dateStr}、${reason}直行いたします。`
      : `${dateStr}、直行いたします。`;
  } else if (input.requestType === 'chokki') {
    body = reason
      ? `${dateStr}、${reason}直帰いたします。`
      : `${dateStr}、直帰いたします。`;
  } else if (input.requestType === 'kyujitsu_shukkin') {
    body = reason
      ? `${dateStr}、出社いたします。（${reason}）`
      : `${dateStr}、出社いたします。`;
  } else {
    // other_request: admin message carries the substantive content
    body = `${dateStr}、ご連絡いたします。`;
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
    const leaveMap: Record<string, string> = {
      paid: 'paid leave', unpaid: 'unpaid leave', substitute: 'substitute holiday', special: 'special leave',
    };
    const leaveStr = input.leaveType ? ` (${leaveMap[input.leaveType]})` : '';
    body = `I will be absent on ${dateStr}${leaveStr} due to ${reason}.`;
  } else if (input.requestType === 'chokko') {
    body = reason
      ? `I will be going directly to the client on ${dateStr} due to ${reason}.`
      : `I will be going directly to the client on ${dateStr}.`;
  } else if (input.requestType === 'chokki') {
    body = reason
      ? `I will be going directly home from the client on ${dateStr} due to ${reason}.`
      : `I will be going directly home from the client on ${dateStr}.`;
  } else if (input.requestType === 'kyujitsu_shukkin') {
    body = reason
      ? `I will be working on ${dateStr} (holiday) due to ${reason}.`
      : `I will be working on ${dateStr} (holiday).`;
  } else {
    // other_request: admin message carries the substantive content
    body = `I have a notice regarding ${dateStr}.`;
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
