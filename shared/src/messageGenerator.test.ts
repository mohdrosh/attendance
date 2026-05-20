import { describe, it, expect } from 'vitest';
import { generateMessage, generateApprovalNotification, generateRejectionNotification } from './messageGenerator';

const baseLate = {
  requestType: 'late' as const,
  reasonCategory: 'train_delay' as const,
  trainLineName: '山手線',
  startDate: '2024-01-15',
  timeFrom: '09:00',
  timeTo: '10:00',
  employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
  inputLanguage: 'ja' as const,
};

describe('generateMessage', () => {
  describe('Late Arrival — Japanese input', () => {
    it('generates Japanese-only output', () => {
      const result = generateMessage(baseLate);
      expect(result.english).toBeUndefined();
      expect(result.japanese).toContain('【遅刻連絡】');
      expect(result.japanese).toContain('山田太郎');
    });

    it('includes train line name in body', () => {
      const result = generateMessage(baseLate);
      expect(result.japanese).toContain('山手線');
    });

    it('includes arrival time', () => {
      const result = generateMessage(baseLate);
      expect(result.japanese).toContain('10:00');
    });
  });

  describe('Late Arrival — English input', () => {
    it('generates both English and Japanese', () => {
      const result = generateMessage({ ...baseLate, inputLanguage: 'en', trainLineName: 'Yamanote Line' });
      expect(result.english).toBeDefined();
      expect(result.japanese).toBeDefined();
      expect(result.english).toContain('[Late Arrival Notice]');
      expect(result.english).toContain('Taro Yamada');
    });
  });

  describe('Late Arrival — oversleeping', () => {
    it('does not mention train line', () => {
      const result = generateMessage({ ...baseLate, reasonCategory: 'oversleeping', trainLineName: undefined });
      expect(result.japanese).not.toContain('電車');
    });
  });

  describe('Late Arrival — child dropoff', () => {
    it('includes child dropoff phrase', () => {
      const result = generateMessage({ ...baseLate, reasonCategory: 'child_dropoff', trainLineName: undefined });
      expect(result.japanese).toContain('保育園');
    });
  });

  describe('Early Departure', () => {
    it('generates early departure subject', () => {
      const result = generateMessage({
        requestType: 'early_departure',
        reasonCategory: 'illness',
        reasonDetail: '発熱',
        startDate: '2024-01-15',
        timeFrom: '14:00',
        timeTo: '18:00',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【早退連絡】');
      expect(result.japanese).toContain('発熱');
    });
  });

  describe('Absence — single day', () => {
    it('generates absence subject without date range', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'personal',
        startDate: '2024-01-15',
        leaveType: 'paid',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【欠勤連絡】');
      expect(result.japanese).not.toContain('〜');
    });
  });

  describe('Absence — multi-day', () => {
    it('includes date range with ～', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'illness',
        reasonDetail: '発熱',
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        leaveType: 'paid',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('～');
    });

    it('uses em dash in English version', () => {
      const result = generateMessage({
        requestType: 'absence',
        reasonCategory: 'illness',
        reasonDetail: 'Fever',
        startDate: '2024-01-15',
        endDate: '2024-01-17',
        leaveType: 'paid',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'en',
      });
      expect(result.english).toContain('–');
    });
  });

  describe('Other Request', () => {
    it('generates other request subject', () => {
      const result = generateMessage({
        requestType: 'other_request',
        reasonCategory: 'direct_home',
        startDate: '2024-01-15',
        employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
        inputLanguage: 'ja',
      });
      expect(result.japanese).toContain('【その他連絡】');
    });
  });

  describe('admin_message', () => {
    it('appends admin message to Japanese output', () => {
      const result = generateMessage({ ...baseLate, adminMessage: '追加のメモ' });
      expect(result.japanese).toContain('追加のメモ');
    });

    it('appends admin message to English output when bilingual', () => {
      const result = generateMessage({ ...baseLate, inputLanguage: 'en', trainLineName: 'Yamanote Line', adminMessage: 'Extra note' });
      expect(result.english).toContain('Extra note');
    });
  });
});

const baseNotif = {
  requestType: 'late' as const,
  startDate: '2024-01-15',
  timeFrom: '09:00',
  timeTo: '10:00',
  employeeName: { ja: '山田太郎', en: 'Taro Yamada' },
};

describe('generateApprovalNotification', () => {
  it('returns japanese and english bodies', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toBeDefined();
    expect(result.english).toBeDefined();
  });

  it('includes 【承認】 in japanese subject', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.japanese).toContain('【承認】');
  });

  it('includes [Approved] in english subject', () => {
    const result = generateApprovalNotification(baseNotif);
    expect(result.english).toContain('[Approved]');
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
    const { timeFrom, timeTo, ...noTime } = baseNotif;
    const result = generateApprovalNotification(noTime);
    expect(result.japanese).not.toContain('時間');
    expect(result.english).not.toContain('Time:');
  });
});

describe('generateRejectionNotification', () => {
  it('returns japanese and english bodies', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.japanese).toBeDefined();
    expect(result.english).toBeDefined();
  });

  it('includes 【否認】 in japanese subject', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.japanese).toContain('【否認】');
  });

  it('includes [Not Approved] in english subject', () => {
    const result = generateRejectionNotification(baseNotif);
    expect(result.english).toContain('[Not Approved]');
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
});
