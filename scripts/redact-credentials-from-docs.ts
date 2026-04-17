#!/usr/bin/env tsx
/**
 * Script to redact exposed credentials from documentation files
 * Run: npx tsx scripts/redact-credentials-from-docs.ts
 */

import fs from 'fs';
import path from 'path';

const REDACTIONS = [
  {
    pattern: /postgresql:\/\/postgres\.htdehmkqfrwjewzjingm:K%40tsur0u1415@aws-1-eu-central-1\.pooler\.supabase\.com:\d+\/postgres/g,
    replacement: 'postgresql://user:password@host:5432/database',
    name: 'Database URL',
  },
  {
    pattern: /fHsfOrcyQhnzwSRlWV7xYQMS0tnJKYjLBBCSAnMljCM/g,
    replacement: 'your-nextauth-secret-here',
    name: 'NextAuth Secret',
  },
  {
    pattern: /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/g,
    replacement: 'your-google-client-secret',
    name: 'Google Client Secret',
  },
  {
    pattern: /sk_test_45ca11545148bed4becda5de54198e677eecbcbf/g,
    replacement: 'sk_test_your-paystack-secret-key',
    name: 'Paystack Secret Key',
  },
  {
    pattern: /AIzaSyB_sUhe6VTP3Dz6_diIrgfFbgBqOeoUHpQ/g,
    replacement: 'your-gemini-api-key',
    name: 'Gemini API Key',
  },
  {
    pattern: /i89uqGTPhslWwuSHP3BfG9nXekQ/g,
    replacement: 'your-cloudinary-api-secret',
    name: 'Cloudinary API Secret',
  },
  {
    pattern: /ARWHAAImcDEwZThiNmFhZmM4MTc0MGI2YjIzYjAyMTEyNzY1YzUyN3AxNTUxMQ/g,
    replacement: 'your-kv-rest-api-token',
    name: 'Vercel KV Token',
  },
  {
    pattern: /cron_secret_a8f3b2e9c4d7f1a6b5e8c3d9f2a7b4e1c6d8f3a9b2e5c7d1f4a8b3e6c9d2f5a1/g,
    replacement: 'your-cron-secret',
    name: 'Cron Secret',
  },
];

const FILES_TO_REDACT = [
  'SECURITY_AUDIT_CRITICAL_VULNERABILITIES.md',
  'docs/CRITICAL_SECURITY_FIX_AUTHENTICATION.md',
  'docs/DATABASE_CONNECTION_FIX.md',
  'docs/POSTGRESQL_STATUS_AND_NEXT_STEPS.md',
  'docs/TASK_7_FINAL_SUMMARY.md',
  'backups/backup.sh',
  'backups/restore.sh',
];

async function redactFile(filePath: string): Promise<void> {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    const foundSecrets: string[] = [];

    for (const redaction of REDACTIONS) {
      if (redaction.pattern.test(content)) {
        content = content.replace(redaction.pattern, redaction.replacement);
        modified = true;
        foundSecrets.push(redaction.name);
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Redacted ${filePath}`);
      console.log(`   Found: ${foundSecrets.join(', ')}`);
    } else {
      console.log(`⏭️  Skipped ${filePath} (no secrets found)`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }
}

async function main() {
  console.log('🔒 Starting credential redaction...\n');

  for (const file of FILES_TO_REDACT) {
    const filePath = path.join(process.cwd(), file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${file}`);
      continue;
    }

    await redactFile(filePath);
  }

  console.log('\n✅ Redaction complete!');
  console.log('\n⚠️  IMPORTANT: Review the changes before committing.');
  console.log('   Run: git diff');
}

main().catch(console.error);
