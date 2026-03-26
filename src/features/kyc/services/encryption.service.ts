import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * EncryptionService
 *
 * AES-256-CBC encryption for sensitive KYC data (NIN, BVN).
 * Stores ciphertext as "{hex_iv}:{hex_ciphertext}".
 *
 * Requires env var ENCRYPTION_KEY — a 64-character hex string (32 bytes).
 */
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    if (raw.length !== 64) {
      throw new Error(
        `ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes), got ${raw.length}`
      );
    }
    this.key = Buffer.from(raw, 'hex');
  }

  /**
   * Encrypt plaintext using AES-256-CBC.
   * Returns "{hex_iv}:{hex_ciphertext}"
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt a value produced by encrypt().
   * Expects "{hex_iv}:{hex_ciphertext}"
   */
  decrypt(ciphertext: string): string {
    const [ivHex, dataHex] = ciphertext.split(':');
    if (!ivHex || !dataHex) {
      throw new Error('Invalid ciphertext format — expected "{hex_iv}:{hex_ciphertext}"');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', this.key, iv);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Mask all but the last 4 characters of a sensitive value.
   * e.g. "12345678901" → "*******8901"
   */
  mask(value: string): string {
    if (value.length <= 4) return value;
    return '*'.repeat(value.length - 4) + value.slice(-4);
  }
}

/** Singleton instance — lazily created so tests can set env vars first */
let _instance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!_instance) {
    _instance = new EncryptionService();
  }
  return _instance;
}
