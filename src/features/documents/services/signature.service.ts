/**
 * Signature Service
 * 
 * Handles digital signature validation and processing.
 */

/**
 * Validate signature data format
 * Signature should be a base64-encoded PNG data URL
 */
export function validateSignature(signatureData: string): boolean {
  try {
    // Check if it's a data URL
    if (!signatureData.startsWith('data:image/png;base64,')) {
      return false;
    }

    // Extract base64 part
    const base64Data = signatureData.split(',')[1];
    if (!base64Data || base64Data.length < 100) {
      // Signature too small to be valid
      return false;
    }

    // Try to decode base64
    Buffer.from(base64Data, 'base64');
    
    return true;
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
}

/**
 * Convert canvas signature to PNG buffer
 */
export function signatureToPNG(signatureData: string): Buffer {
  const base64Data = signatureData.replace(/^data:image\/png;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Verify signature authenticity
 * In a production system, this would check cryptographic signatures
 * For now, we just validate the format
 */
export async function verifySignature(
  documentId: string,
  signatureData: string
): Promise<boolean> {
  // Basic validation
  if (!validateSignature(signatureData)) {
    return false;
  }

  // In production, you would:
  // 1. Check signature against document hash
  // 2. Verify timestamp
  // 3. Check for tampering
  // 4. Validate against stored signature if re-signing

  return true;
}
