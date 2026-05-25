import { describe, it, expect } from 'vitest';
import { generateMessage } from './messageGenerator';

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
