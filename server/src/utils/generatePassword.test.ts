import { generateTempPassword } from './generatePassword';

describe('generateTempPassword', () => {
  it('returns a 12-character string', () => {
    expect(generateTempPassword()).toHaveLength(12);
  });

  it('always contains at least one uppercase letter', () => {
    for (let i = 0; i < 50; i++) {
      expect(/[A-Z]/.test(generateTempPassword())).toBe(true);
    }
  });

  it('always contains at least one lowercase letter', () => {
    for (let i = 0; i < 50; i++) {
      expect(/[a-z]/.test(generateTempPassword())).toBe(true);
    }
  });

  it('always contains at least one digit', () => {
    for (let i = 0; i < 50; i++) {
      expect(/[0-9]/.test(generateTempPassword())).toBe(true);
    }
  });

  it('always contains at least one special character from !@#$%', () => {
    for (let i = 0; i < 50; i++) {
      expect(/[!@#$%]/.test(generateTempPassword())).toBe(true);
    }
  });

  it('only uses allowed characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(/^[A-Za-z0-9!@#$%]+$/.test(generateTempPassword())).toBe(true);
    }
  });

  it('generates different passwords each time', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTempPassword()));
    expect(passwords.size).toBeGreaterThan(15);
  });
});
