import { and, eq, gte, isNotNull, lte, or, type SQL } from 'drizzle-orm';
import { payments } from '@/lib/db/schema/payments';
import { salvageCases } from '@/lib/db/schema/cases';

export type FinancePaymentFilters = {
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
  broker?: string;
  insuranceClass?: string;
};

export type FinanceFilterOptions = {
  branches: string[];
  brokers: string[];
  insuranceClasses: string[];
};

export function parseFinancePaymentFilters(searchParams: URLSearchParams): FinancePaymentFilters {
  return {
    dateFrom: searchParams.get('dateFrom')?.trim() || undefined,
    dateTo: searchParams.get('dateTo')?.trim() || undefined,
    branch: searchParams.get('branch')?.trim() || undefined,
    broker: searchParams.get('broker')?.trim() || undefined,
    insuranceClass: searchParams.get('insuranceClass')?.trim() || undefined,
  };
}

export function hasCaseDimensionFilters(filters: FinancePaymentFilters): boolean {
  return Boolean(filters.branch || filters.broker || filters.insuranceClass);
}

export function appendPaymentDateFilters(conditions: SQL[], filters: FinancePaymentFilters): void {
  if (filters.dateFrom) {
    const fromDate = new Date(filters.dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    conditions.push(gte(payments.createdAt, fromDate));
  }
  if (filters.dateTo) {
    const toDate = new Date(filters.dateTo);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(payments.createdAt, toDate));
  }
}

export function appendCaseDimensionFilters(conditions: SQL[], filters: FinancePaymentFilters): void {
  if (filters.branch) {
    conditions.push(isNotNull(payments.auctionId));
    conditions.push(eq(salvageCases.branchName, filters.branch));
  }
  if (filters.broker) {
    conditions.push(isNotNull(payments.auctionId));
    conditions.push(
      or(eq(salvageCases.brokerName, filters.broker), eq(salvageCases.agencyName, filters.broker))!
    );
  }
  if (filters.insuranceClass) {
    conditions.push(isNotNull(payments.auctionId));
    conditions.push(eq(salvageCases.insuranceClass, filters.insuranceClass));
  }
}

export function buildFinancePaymentFilterWhere(filters: FinancePaymentFilters): SQL | undefined {
  const conditions: SQL[] = [];
  appendPaymentDateFilters(conditions, filters);
  appendCaseDimensionFilters(conditions, filters);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function financeFilterCacheSuffix(filters: FinancePaymentFilters): string {
  return [
    filters.dateFrom ?? '',
    filters.dateTo ?? '',
    filters.branch ?? '',
    filters.broker ?? '',
    filters.insuranceClass ?? '',
  ].join('|');
}
