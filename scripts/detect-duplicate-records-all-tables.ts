/**
 * Script: Detect Duplicate Records Across All Critical Tables
 * 
 * Purpose: Comprehensive duplicate detection system for:
 * - Payments table (same auctionId)
 * - Documents table (same auctionId + vendorId + documentType)
 * - Auctions table (same caseId - should only be one active auction per case)
 * - Wallet transactions (same reference)
 * 
 * This script provides a health check for database integrity.
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { walletTransactions } from '@/lib/db/schema/escrow';
import { sql } from 'drizzle-orm';

interface DuplicateReport {
  table: string;
  duplicateCount: number;
  affectedRecords: number;
  details: Array<{
    key: string;
    count: number;
    ids: string[];
  }>;
}

async function detectDuplicatePayments(): Promise<DuplicateReport> {
  console.log('🔍 Checking payments table for duplicates...\n');

  const duplicates = await db
    .select({
      auctionId: payments.auctionId,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .groupBy(payments.auctionId)
    .having(sql`count(*) > 1`);

  const details = [];
  let affectedRecords = 0;

  for (const dup of duplicates) {
    const records = await db
      .select({ id: payments.id })
      .from(payments)
      .where(sql`${payments.auctionId} = ${dup.auctionId}`);

    details.push({
      key: `auctionId: ${dup.auctionId}`,
      count: dup.count,
      ids: records.map(r => r.id),
    });

    affectedRecords += dup.count;
  }

  return {
    table: 'payments',
    duplicateCount: duplicates.length,
    affectedRecords,
    details,
  };
}

async function detectDuplicateDocuments(): Promise<DuplicateReport> {
  console.log('🔍 Checking documents table for duplicates...\n');

  const duplicates = await db
    .select({
      auctionId: releaseForms.auctionId,
      vendorId: releaseForms.vendorId,
      documentType: releaseForms.documentType,
      count: sql<number>`count(*)::int`,
    })
    .from(releaseForms)
    .groupBy(
      releaseForms.auctionId,
      releaseForms.vendorId,
      releaseForms.documentType
    )
    .having(sql`count(*) > 1`);

  const details = [];
  let affectedRecords = 0;

  for (const dup of duplicates) {
    const records = await db
      .select({ id: releaseForms.id })
      .from(releaseForms)
      .where(
        sql`${releaseForms.auctionId} = ${dup.auctionId} 
            AND ${releaseForms.vendorId} = ${dup.vendorId}
            AND ${releaseForms.documentType} = ${dup.documentType}`
      );

    details.push({
      key: `auction: ${dup.auctionId}, vendor: ${dup.vendorId}, type: ${dup.documentType}`,
      count: dup.count,
      ids: records.map(r => r.id),
    });

    affectedRecords += dup.count;
  }

  return {
    table: 'documents (release_forms)',
    duplicateCount: duplicates.length,
    affectedRecords,
    details,
  };
}

async function detectDuplicateAuctions(): Promise<DuplicateReport> {
  console.log('🔍 Checking auctions table for duplicates...\n');

  // Check for multiple active auctions for the same case
  const duplicates = await db
    .select({
      caseId: auctions.caseId,
      count: sql<number>`count(*)::int`,
    })
    .from(auctions)
    .where(sql`${auctions.status} IN ('active', 'extended')`)
    .groupBy(auctions.caseId)
    .having(sql`count(*) > 1`);

  const details = [];
  let affectedRecords = 0;

  for (const dup of duplicates) {
    const records = await db
      .select({ id: auctions.id, status: auctions.status })
      .from(auctions)
      .where(
        sql`${auctions.caseId} = ${dup.caseId} 
            AND ${auctions.status} IN ('active', 'extended')`
      );

    details.push({
      key: `caseId: ${dup.caseId}`,
      count: dup.count,
      ids: records.map(r => `${r.id} (${r.status})`),
    });

    affectedRecords += dup.count;
  }

  return {
    table: 'auctions (active/extended)',
    duplicateCount: duplicates.length,
    affectedRecords,
    details,
  };
}

async function detectDuplicateWalletTransactions(): Promise<DuplicateReport> {
  console.log('🔍 Checking wallet_transactions table for duplicates...\n');

  const duplicates = await db
    .select({
      reference: walletTransactions.reference,
      count: sql<number>`count(*)::int`,
    })
    .from(walletTransactions)
    .groupBy(walletTransactions.reference)
    .having(sql`count(*) > 1`);

  const details = [];
  let affectedRecords = 0;

  for (const dup of duplicates) {
    const records = await db
      .select({ id: walletTransactions.id, type: walletTransactions.type })
      .from(walletTransactions)
      .where(sql`${walletTransactions.reference} = ${dup.reference}`);

    details.push({
      key: `reference: ${dup.reference}`,
      count: dup.count,
      ids: records.map(r => `${r.id} (${r.type})`),
    });

    affectedRecords += dup.count;
  }

  return {
    table: 'wallet_transactions',
    duplicateCount: duplicates.length,
    affectedRecords,
    details,
  };
}

async function generateReport() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('DUPLICATE RECORDS DETECTION REPORT');
  console.log('═══════════════════════════════════════════════════════\n');

  const reports: DuplicateReport[] = [];

  try {
    // Check all tables
    reports.push(await detectDuplicatePayments());
    reports.push(await detectDuplicateDocuments());
    reports.push(await detectDuplicateAuctions());
    reports.push(await detectDuplicateWalletTransactions());

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');

    let totalIssues = 0;
    let totalAffectedRecords = 0;

    for (const report of reports) {
      const status = report.duplicateCount === 0 ? '✅' : '⚠️';
      console.log(`${status} ${report.table}:`);
      console.log(`   Duplicate groups: ${report.duplicateCount}`);
      console.log(`   Affected records: ${report.affectedRecords}`);
      
      if (report.duplicateCount > 0) {
        console.log(`   Details:`);
        for (const detail of report.details) {
          console.log(`     - ${detail.key}: ${detail.count} records`);
          console.log(`       IDs: ${detail.ids.slice(0, 3).join(', ')}${detail.ids.length > 3 ? '...' : ''}`);
        }
      }
      
      console.log('');

      totalIssues += report.duplicateCount;
      totalAffectedRecords += report.affectedRecords;
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log(`Total duplicate groups: ${totalIssues}`);
    console.log(`Total affected records: ${totalAffectedRecords}`);
    console.log('═══════════════════════════════════════════════════════\n');

    if (totalIssues === 0) {
      console.log('✅ No duplicates found! Database integrity is good.\n');
    } else {
      console.log('⚠️  Duplicates detected! Run cleanup scripts:\n');
      console.log('Payments:');
      console.log('  npm run script scripts/find-and-delete-duplicate-payments.ts --live\n');
      console.log('Documents:');
      console.log('  npm run script scripts/find-and-delete-duplicate-documents.ts --live\n');
      console.log('Auctions:');
      console.log('  Manual review required - check why multiple active auctions exist\n');
      console.log('Wallet Transactions:');
      console.log('  npm run script scripts/cleanup-duplicate-wallet-transactions.ts --live\n');
    }

    // Save report to file
    const fs = await import('fs/promises');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues,
        totalAffectedRecords,
      },
      reports,
    };

    const filename = `duplicate-detection-report-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(reportData, null, 2));
    console.log(`📝 Full report saved to: ${filename}\n`);

  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

// Main execution
generateReport();
