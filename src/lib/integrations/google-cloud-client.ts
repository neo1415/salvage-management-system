import fs from 'fs';
import path from 'path';

type GoogleClientOptions = {
  credentials?: Record<string, unknown>;
  keyFilename?: string;
};

let warnedMissingCredentialsFile = false;

function resolveCredentialsPath(keyFile: string): string | null {
  if (fs.existsSync(keyFile)) return keyFile;
  const resolved = path.resolve(/*turbopackIgnore: true*/ process.cwd(), keyFile);
  if (fs.existsSync(resolved)) return resolved;
  return null;
}

/**
 * Returns Google Cloud client options when credentials are configured.
 * Supports GOOGLE_APPLICATION_CREDENTIALS_JSON (serverless) or a credentials file path.
 */
export function getGoogleCloudClientOptions(): GoogleClientOptions | null {
  const jsonEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  if (jsonEnv) {
    try {
      const credentials = JSON.parse(jsonEnv) as Record<string, unknown>;
      return { credentials };
    } catch {
      console.warn('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON — could not parse JSON');
      return null;
    }
  }

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!keyFile) return null;

  const resolvedPath = resolveCredentialsPath(keyFile);
  if (!resolvedPath) {
    if (!warnedMissingCredentialsFile) {
      console.warn(`Google Cloud credentials file not found: ${keyFile}. Google integrations will stay disabled until GOOGLE_APPLICATION_CREDENTIALS_JSON or a valid file path is configured.`);
      warnedMissingCredentialsFile = true;
    }
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return null;
  }

  return { keyFilename: resolvedPath };
}

export function isGoogleCloudConfigured(): boolean {
  return getGoogleCloudClientOptions() !== null;
}
