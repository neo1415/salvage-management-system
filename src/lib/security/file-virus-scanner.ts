import net from 'net';

export type VirusScanResult =
  | { status: 'clean'; scanner: string }
  | { status: 'skipped'; scanner: 'none'; reason: string }
  | { status: 'infected'; scanner: string; signature: string }
  | { status: 'error'; scanner: string; error: string };

const DEFAULT_CLAMAV_PORT = 3310;
const SCAN_TIMEOUT_MS = 15_000;
const CHUNK_SIZE = 8192;

function isVirusScanRequired(): boolean {
  return process.env.KYC_VIRUS_SCAN_REQUIRED === 'true';
}

function getClamAvConfig() {
  const host = process.env.CLAMAV_HOST || process.env.CLAMD_HOST;
  const port = Number(process.env.CLAMAV_PORT || process.env.CLAMD_PORT || DEFAULT_CLAMAV_PORT);

  if (!host) {
    return null;
  }

  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_CLAMAV_PORT,
  };
}

async function scanWithClamAv(buffer: Buffer): Promise<VirusScanResult> {
  const config = getClamAvConfig();

  if (!config) {
    return isVirusScanRequired()
      ? { status: 'error', scanner: 'clamav', error: 'ClamAV is required but CLAMAV_HOST is not configured.' }
      : { status: 'skipped', scanner: 'none', reason: 'ClamAV is not configured.' };
  }

  return new Promise((resolve) => {
    const socket = net.createConnection(config, () => {
      socket.write('zINSTREAM\0');

      for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
        const chunk = buffer.subarray(offset, offset + CHUNK_SIZE);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }

      socket.write(Buffer.alloc(4));
    });

    let response = '';
    let settled = false;

    const finish = (result: VirusScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(SCAN_TIMEOUT_MS, () => {
      finish({ status: 'error', scanner: 'clamav', error: 'ClamAV scan timed out.' });
    });

    socket.on('data', (data) => {
      response += data.toString('utf8');
    });

    socket.on('end', () => {
      const trimmed = response.trim();

      if (trimmed.endsWith('OK')) {
        finish({ status: 'clean', scanner: 'clamav' });
        return;
      }

      const match = trimmed.match(/: (.+) FOUND$/);
      if (match?.[1]) {
        finish({ status: 'infected', scanner: 'clamav', signature: match[1] });
        return;
      }

      finish({
        status: 'error',
        scanner: 'clamav',
        error: trimmed || 'ClamAV returned an empty response.',
      });
    });

    socket.on('error', (error) => {
      finish({ status: 'error', scanner: 'clamav', error: error.message });
    });
  });
}

export async function scanUploadedFile(buffer: Buffer): Promise<VirusScanResult> {
  return scanWithClamAv(buffer);
}
