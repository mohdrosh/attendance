import { describe, it, expect } from 'vitest';
import { generateMessage, generateApprovalNotification, generateRejectionNotification } from './messageGenerator';

const empName = { ja: '山田太郎', en: 'Taro Yamada' };

describe('generateMessage', () => {
  describe('Late Arrival', () => {
    it('generates Japanese-only output', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'weather_transport',
        startDate: '2024-01-15',
        timeFrom: '09:00',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.english).toBeUndefined();
      expect(result.japanese).toContain('【遅刻連絡】');
      expect(result.japanese).toContain('山田太郎');
    });

    it('generates both languages for English input', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'weather_transport',
        startDate: '2024-01-15',
        timeFrom: '09:00',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('[Late Arrival Notice]');
      expect(result.japanese).toContain('【遅刻連絡】');
    });

    it('includes arrival time', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'illness',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('10:00');
    });
  });

  describe('Early Departure', () => {
    it('generates early departure subject and includes reason detail', () => {
      const result = generateMessage({
        requestType: 'early_departure',
        reasonCategory: 'illness',
        reasonDetail: '発熱',
        startDate: '2024-01-15',
        timeFrom: '14:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【早退連絡】');
      expect(result.japanese).toContain('発熱');
    });
  });

  describe('Absence', () => {
    it('generates absence subject', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        leaveType: 'paid',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【欠勤連絡】');
    });

    it('includes date range with ～ for multi-day absence', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'illness',
        reasonDetail: '発熱',
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        leaveType: 'paid',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('～');
    });

    it('uses em dash in English for multi-day absence', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'illness',
        reasonDetail: 'Fever',
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        leaveType: 'paid',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('–');
    });

    it('includes special leave type label in Japanese body', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        leaveType: 'special',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('特別休暇（慶弔）');
    });

    it('includes special leave type label in English body', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        leaveType: 'special',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('special leave');
    });
  });

  describe('New reasons', () => {
    it('family reason appears in Japanese body', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'family',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('家庭の事情');
    });

    it('weather_transport reason appears in Japanese body', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'weather_transport',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('天候・交通機関');
    });

    it('weather_transport reason appears in English body', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'weather_transport',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('weather or transportation');
    });

    it('personal reason appears in Japanese body', () => {
      const result = generateMessage({
        requestType: 'early_departure',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        timeFrom: '15:00',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('私用');
    });
  });

  describe('Chokko (Direct to Client)', () => {
    it('generates chokko subject in Japanese', () => {
      const result = generateMessage({
        requestType: 'chokko',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【直行連絡】');
      expect(result.japanese).toContain('直行');
    });

    it('generates chokko notice in English', () => {
      const result = generateMessage({
        requestType: 'chokko',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('[Direct to Client Notice]');
      expect(result.english).toContain('going directly to the client');
    });

    it('includes reason phrase when reason provided', () => {
      const result = generateMessage({
        requestType: 'chokko',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('私用');
    });

    it('omits reason phrase when no reason provided', () => {
      const result = generateMessage({
        requestType: 'chokko',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).not.toContain('のため');
    });
  });

  describe('Chokki (Going Directly Home)', () => {
    it('generates chokki subject in Japanese', () => {
      const result = generateMessage({
        requestType: 'chokki',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【直帰連絡】');
      expect(result.japanese).toContain('直帰');
    });

    it('generates chokki notice in English', () => {
      const result = generateMessage({
        requestType: 'chokki',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('[Going Directly Home Notice]');
      expect(result.english).toContain('going directly home');
    });
  });

  describe('Kyujitsu Shukkin (Holiday Work)', () => {
    it('generates holiday work subject in Japanese', () => {
      const result = generateMessage({
        requestType: 'kyujitsu_shukkin',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【休日出勤連絡】');
      expect(result.japanese).toContain('出社');
    });

    it('generates holiday work notice in English', () => {
      const result = generateMessage({
        requestType: 'kyujitsu_shukkin',
        startDate: '2024-01-15',
        employeeName: empName,
        inputLanguage: 'en',
      });
      expect(result.english).toContain('[Holiday Work Notice]');
      expect(result.english).toContain('holiday');
    });
  });

  describe('Other Request', () => {
    it('generates other request subject', () => {
      const result = generateMessage({
        requestType: 'other_request',
        startDate: '2024-01-15',
        adminMessage: '詳細はご確認ください',
        employeeName: empName,
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【その他連絡】');
    });
  });

  describe('admin_message', () => {
    it('appends admin message to Japanese output', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'illness',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'ja',
        adminMessage: '追加のメモ',
      });
      expect(result.japanese).toContain('追加のメモ');
    });

    it('appends admin message to English output when bilingual', () => {
      const result = generateMessage({
        requestType: 'late',
        reasonCategory: 'illness',
        startDate: '2024-01-15',
        timeTo: '10:00',
        employeeName: empName,
        inputLanguage: 'en',
        adminMessage: 'Extra note',
      });
      expect(result.english).toContain('Extra note');
    });
  });
});

const baseNotif = {
  requestType: 'late' as const,
  startDate: '2024-01-15',
  timeFrom: '09:00',
  timeTo: '10:00',
  employeeName: empName,
};

describe('generateApprovalNotification', () => {
  it('returns japanese and english bodies', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toBeDefined();
    expect(result.english).toBeDefined();
  });

  it('includes 【承認】 in japanese subject', () => {
    expect(generateApprovalNotification(baseNotif).japanese).toContain('【承認】');
  });

  it('includes [Approved] in english subject', () => {
    expect(generateApprovalNotification(baseNotif).english).toContain('[Approved]');
  });

  it('includes employee name in both languages', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toContain('山田太郎');
    expect(result.english).toContain('Taro Yamada');
  });

  it('includes time range when provided', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toContain('09:00');
    expect(result.english).toContain('10:00');
  });

  it('omits time when not provided', () => {
    const { timeFrom: _tf, timeTo: _tt, ...noTime } = baseNotif;
    const result = generateApprovalNotification(noTime);
    expect(result.japanese).not.toContain('時間');
    expect(result.english).not.toContain('Time:');
  });

  it('shows 直行 / Chokko for chokko type', () => {
    const result = generateApprovalNotification({ ...baseNotif, requestType: 'chokko' });
    expect(result.japanese).toContain('直行');
    expect(result.english).toContain('Chokko');
  });

  it('shows 直帰 / Chokki for chokki type', () => {
    const result = generateApprovalNotification({ ...baseNotif, requestType: 'chokki' });
    expect(result.japanese).toContain('直帰');
    expect(result.english).toContain('Chokki');
  });

  it('shows 休日出勤 / Kyujitsu Shukkin for kyujitsu_shukkin type', () => {
    const result = generateApprovalNotification({ ...baseNotif, requestType: 'kyujitsu_shukkin' });
    expect(result.japanese).toContain('休日出勤');
    expect(result.english).toContain('Kyujitsu Shukkin');
  });
});

describe('generateRejectionNotification', () => {
  it('returns japanese and english bodies', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.japanese).toBeDefined();
    expect(result.english).toBeDefined();
  });

  it('includes 【否認】 in japanese subject', () => {
    expect(generateRejectionNotification(baseNotif).japanese).toContain('【否認】');
  });

  it('includes [Not Approved] in english subject', () => {
    expect(generateRejectionNotification(baseNotif).english).toContain('[Not Approved]');
  });

  it('includes rejection reason when provided', () => {
    const result = generateRejectionNotification({ ...baseNotif, rejectionReason: 'Missing documentation' });
    expect(result.japanese).toContain('Missing documentation');
    expect(result.english).toContain('Missing documentation');
  });

  it('omits rejection reason line when not provided', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.japanese).not.toContain('理由：');
    expect(result.english).not.toContain('Reason:');
  });

  it('shows 直行 / Chokko for chokko type in rejection', () => {
    const result = generateRejectionNotification({ ...baseNotif, requestType: 'chokko' });
    expect(result.japanese).toContain('直行');
    expect(result.english).toContain('Chokko');
  });
});
