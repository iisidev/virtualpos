import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    // 32 bytes key from env or deterministic fallback for development
    const rawKey = process.env.SALARY_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef';
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Encrypts plaintext (such as sensitive salary) using AES-256-GCM.
   */
  encrypt(plainText: string): string {
    if (!plainText) return '';
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts AES-256-GCM ciphertext.
   */
  decrypt(cipherText: string): string {
    if (!cipherText || !cipherText.includes(':')) return '';
    try {
      const parts = cipherText.split(':');
      if (parts.length !== 3) return '';
      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return '';
    }
  }

  /**
   * Generates SHA-256 audit signature hash for financial ledger transactions:
   * SHA-256(clientId + amount + timestamp + authorizationCode)
   */
  generateTransactionSignature(
    clientId: string,
    amount: string | number,
    timestamp: Date | string,
    authorizationCode: string,
  ): string {
    const timeStr = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);
    const payload = `${clientId}|${Number(amount).toFixed(2)}|${timeStr}|${authorizationCode}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Verifies if a given transaction hash matches its attributes.
   */
  verifyTransactionSignature(
    hash: string,
    clientId: string,
    amount: string | number,
    timestamp: Date | string,
    authorizationCode: string,
  ): boolean {
    const expected = this.generateTransactionSignature(clientId, amount, timestamp, authorizationCode);
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
  }
}

