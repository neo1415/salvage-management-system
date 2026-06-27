import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const CURRENT_VERSION = 'v2';
const GCM_ALGORITHM = 'aes-256-gcm';
const GCM_IV_BYTES = 12;
const GCM_AUTH_TAG_BYTES = 16;
const LEGACY_ALGORITHM = 'aes-256-cbc';

/**
 * Authenticated encryption for sensitive KYC data.
 *
 * New values use "v2:{iv}:{authTag}:{ciphertext}". Legacy CBC values remain
 * decryptable so existing NIN/BVN records can be migrated without data loss.
 */
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }
    if (!/^[a-f0-9]{64}$/i.test(raw)) {
      throw new Error('ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)');
    }
    this.key = Buffer.from(raw, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(GCM_IV_BYTES);
    const cipher = createCipheriv(GCM_ALGORITHM, this.key, iv, {
      authTagLength: GCM_AUTH_TAG_BYTES,
    });
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${CURRENT_VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    return ciphertext.startsWith(`${CURRENT_VERSION}:`)
      ? this.decryptCurrent(ciphertext)
      : this.decryptLegacy(ciphertext);
  }

  isLegacyCiphertext(ciphertext: string): boolean {
    return !ciphertext.startsWith(`${CURRENT_VERSION}:`);
  }

  reencryptIfLegacy(ciphertext: string): string {
    return this.isLegacyCiphertext(ciphertext)
      ? this.encrypt(this.decryptLegacy(ciphertext))
      : ciphertext;
  }

  mask(value: string): string {
    if (value.length <= 4) return value;
    return '*'.repeat(value.length - 4) + value.slice(-4);
  }

  private decryptCurrent(ciphertext: string): string {
    const [version, ivHex, authTagHex, dataHex, ...extra] = ciphertext.split(':');
    if (
      extra.length > 0 ||
      version !== CURRENT_VERSION ||
      !isHexOfBytes(ivHex, GCM_IV_BYTES) ||
      !isHexOfBytes(authTagHex, GCM_AUTH_TAG_BYTES) ||
      !isEvenHex(dataHex)
    ) {
      throw new Error('Invalid v2 ciphertext format');
    }

    const decipher = createDecipheriv(
      GCM_ALGORITHM,
      this.key,
      Buffer.from(ivHex, 'hex'),
      { authTagLength: GCM_AUTH_TAG_BYTES }
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private decryptLegacy(ciphertext: string): string {
    const [ivHex, dataHex, ...extra] = ciphertext.split(':');
    if (extra.length > 0 || !isHexOfBytes(ivHex, 16) || !isEvenHex(dataHex)) {
      throw new Error('Invalid legacy ciphertext format');
    }
    const decipher = createDecipheriv(
      LEGACY_ALGORITHM,
      this.key,
      Buffer.from(ivHex, 'hex')
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}

function isEvenHex(value: string | undefined): value is string {
  return Boolean(value && value.length % 2 === 0 && /^[a-f0-9]+$/i.test(value));
}

function isHexOfBytes(value: string | undefined, bytes: number): value is string {
  return Boolean(value && value.length === bytes * 2 && /^[a-f0-9]+$/i.test(value));
}

let instance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!instance) instance = new EncryptionService();
  return instance;
}
