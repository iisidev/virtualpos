import { randomBytes } from 'crypto';
import { CryptoService } from './crypto.service';

describe('CryptoService (Financial Cryptography & Ledger Hashing)', () => {
  let service: CryptoService;

  beforeEach(() => {
    process.env.SALARY_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    service = new CryptoService();
  });

  it('should encrypt and decrypt employee salary using AES-256-GCM', () => {
    const rawSalary = '45000.00';
    const encrypted = service.encrypt(rawSalary);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(rawSalary);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toEqual(rawSalary);
  });

  it('should generate verifiable SHA-256 transaction signatures for ledger immutability', () => {
    const clientId = 'c1234567-0000-0000-0000-000000000001';
    const amount = 5000.0;
    const timestamp = new Date('2026-11-13T14:30:00.000Z');
    const authCode = 'AUTH-894210';

    const hash = service.generateTransactionSignature(clientId, amount, timestamp, authCode);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 hex is 64 chars

    const isValid = service.verifyTransactionSignature(hash, clientId, amount, timestamp, authCode);
    expect(isValid).toBe(true);

    const isTampered = service.verifyTransactionSignature(hash, clientId, 5000.01, timestamp, authCode);
    expect(isTampered).toBe(false);
  });
});

