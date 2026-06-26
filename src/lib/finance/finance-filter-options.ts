import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { sql } from 'drizzle-orm';
import type { FinanceFilterOptions } from './payment-case-filters';

export async function fetchFinanceFilterOptions(): Promise<FinanceFilterOptions> {
  const [branchRows, brokerRows, agencyRows, classRows] = await Promise.all([
    db
      .selectDistinct({ value: salvageCases.branchName })
      .from(salvageCases)
      .where(sql`${salvageCases.branchName} IS NOT NULL AND trim(${salvageCases.branchName}) <> ''`)
      .orderBy(salvageCases.branchName),
    db
      .selectDistinct({ value: salvageCases.brokerName })
      .from(salvageCases)
      .where(sql`${salvageCases.brokerName} IS NOT NULL AND trim(${salvageCases.brokerName}) <> ''`)
      .orderBy(salvageCases.brokerName),
    db
      .selectDistinct({ value: salvageCases.agencyName })
      .from(salvageCases)
      .where(sql`${salvageCases.agencyName} IS NOT NULL AND trim(${salvageCases.agencyName}) <> ''`)
      .orderBy(salvageCases.agencyName),
    db
      .selectDistinct({ value: salvageCases.insuranceClass })
      .from(salvageCases)
      .where(sql`${salvageCases.insuranceClass} IS NOT NULL AND trim(${salvageCases.insuranceClass}) <> ''`)
      .orderBy(salvageCases.insuranceClass),
  ]);

  const brokers = [...new Set([
    ...brokerRows.map((row) => row.value).filter(Boolean) as string[],
    ...agencyRows.map((row) => row.value).filter(Boolean) as string[],
  ])].sort((a, b) => a.localeCompare(b));

  return {
    branches: branchRows.map((row) => row.value).filter(Boolean) as string[],
    brokers,
    insuranceClasses: classRows.map((row) => row.value).filter(Boolean) as string[],
  };
}
