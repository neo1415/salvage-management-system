#!/usr/bin/env ts-node
/**
 * Security Scanner - Detects exposed secrets in codebase
 * 
 * Run with: npx ts-node scripts/scan-for-secrets.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Patterns to detect various types of secrets
const SECRET_PATTERNS = [
  {
    name: 'Google API Key',
    pattern: /AIzaSy[A-Za-z0-9_-]{33}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Stripe Secret Key (Live)',
    pattern: /sk_live_[A-Za-z0-9]{24,}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Stripe Secret Key (Test)',
    pattern: /sk_test_[A-Za-z0-9]{24,}/g,
    severity: 'HIGH',
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-[A-Za-z0-9]{48}/g,
    severity: 'CRITICAL',
  },
  {
    name: 'PostgreSQL Connection String',
    pattern: /postgres:\/\/[^\s]+/g,
    severity: 'CRITICAL',
  },
  {
    name: 'MongoDB Connection String',
    pattern: /mongodb:\/\/[^\s]+/g,
    severity: 'CRITICAL',
  },
  {
    name: 'MySQL Connection String',
    pattern: /mysql:\/\/[^\s]+/g,
    severity: 'CRITICAL',
  },
  {
    name: 'Generic API Key Pattern',
    pattern: /api[_-]?key[_-]?[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/gi,
    severity: 'MEDIUM',
  },
  {
    name: 'Generic Secret Pattern',
    pattern: /secret[_-]?[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/gi,
    severity: 'MEDIUM',
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
    severity: 'CRITICAL',
  },
];

// Files and directories to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  '.env.example',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'scripts/scan-for-secrets.ts', // Ignore this file itself
];

interface Finding {
  file: string;
  line: number;
  column: number;
  secretType: string;
  severity: string;
  match: string;
  context: string;
}

const findings: Finding[] = [];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => filePath.includes(pattern));
}

function scanFile(filePath: string): void {
  if (shouldIgnore(filePath)) {
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    SECRET_PATTERNS.forEach(({ name, pattern, severity }) => {
      lines.forEach((line, lineIndex) => {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          const column = match.index || 0;
          
          // Get context (surrounding lines)
          const contextStart = Math.max(0, lineIndex - 1);
          const contextEnd = Math.min(lines.length, lineIndex + 2);
          const context = lines.slice(contextStart, contextEnd).join('\n');

          findings.push({
            file: filePath,
            line: lineIndex + 1,
            column: column + 1,
            secretType: name,
            severity,
            match: match[0],
            context,
          });
        }
      });
    });
  } catch (error) {
    // Ignore binary files or files that can't be read
  }
}

function scanDirectory(dirPath: string): void {
  if (shouldIgnore(dirPath)) {
    return;
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        scanFile(fullPath);
      }
    }
  } catch (error) {
    // Ignore directories we can't read
  }
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return '***';
  }
  return secret.substring(0, 4) + '***' + secret.substring(secret.length - 4);
}

function printFindings(): void {
  if (findings.length === 0) {
    console.log('✅ No secrets found! Your codebase looks clean.');
    return;
  }

  console.log(`\n🚨 Found ${findings.length} potential secret(s):\n`);

  // Group by severity
  const critical = findings.filter(f => f.severity === 'CRITICAL');
  const high = findings.filter(f => f.severity === 'HIGH');
  const medium = findings.filter(f => f.severity === 'MEDIUM');

  const printGroup = (title: string, items: Finding[]) => {
    if (items.length === 0) return;

    console.log(`\n${title} (${items.length}):`);
    console.log('='.repeat(80));

    items.forEach((finding, index) => {
      console.log(`\n${index + 1}. ${finding.secretType}`);
      console.log(`   File: ${finding.file}:${finding.line}:${finding.column}`);
      console.log(`   Match: ${maskSecret(finding.match)}`);
      console.log(`   Context:`);
      console.log(finding.context.split('\n').map(l => `     ${l}`).join('\n'));
    });
  };

  printGroup('🔴 CRITICAL SEVERITY', critical);
  printGroup('🟠 HIGH SEVERITY', high);
  printGroup('🟡 MEDIUM SEVERITY', medium);

  console.log('\n' + '='.repeat(80));
  console.log('\n⚠️  NEXT STEPS:');
  console.log('1. Review each finding above');
  console.log('2. For real secrets: REVOKE them immediately');
  console.log('3. Replace with environment variables');
  console.log('4. Add to .gitignore if needed');
  console.log('5. Remove from git history using BFG or git-filter-repo');
  console.log('\nSee SECURITY_BREACH_ACTION_PLAN.md for detailed instructions.\n');

  process.exit(1);
}

// Main execution
console.log('🔍 Scanning codebase for exposed secrets...\n');
scanDirectory('.');
printFindings();
