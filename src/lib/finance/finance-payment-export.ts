import { ExportService, type ExportColumn } from '@/features/export/services/export.service';
import { formatNgnAmount } from '@/lib/utils/format-ngn';

export type FinancePaymentExportRow = {
  paymentId: string;
  auctionId: string;
  paymentType: string;
  amount: string;
  effectiveSaleAmount: string;
  settledSaleAmount: string;
  paidVsSettledDelta: string;
  priceAdjusted: string;
  status: string;
  paymentMethod: string;
  paymentReference: string;
  autoVerified: string;
  escrowStatus: string;
  createdDate: string;
  paymentDeadline: string;
  vendorBusinessName: string;
  vendorContactName: string;
  vendorPhone: string;
  vendorEmail: string;
  vendorKycTier: string;
  vendorKycStatus: string;
  vendorBankName: string;
  vendorBankAccount: string;
  vendorBankAccountName: string;
  caseName: string;
  claimReference: string;
  assetType: string;
  branch: string;
  policyNumber: string;
  broker: string;
  insuranceClass: string;
  walletAvailableBalance: string;
  walletFrozenAmount: string;
  documentsSigned: string;
  documentsTotal: string;
};

type PaymentExportSource = {
  id: string;
  auctionId: string | null;
  amount: string;
  effectiveSaleAmount?: string | null;
  settlement?: {
    settledAmount: string;
    paidVsSettledDelta: string;
    hasPriceAdjustment: boolean;
  } | null;
  paymentMethod: string;
  paymentReference: string | null;
  status: string;
  autoVerified: boolean;
  paymentDeadline: string;
  createdAt: string;
  escrowStatus?: string | null;
  paymentType: string;
  walletBalance?: { availableBalance: number; frozenAmount: number } | null;
  documentProgress?: {
    signedDocuments: number;
    totalDocuments: number;
  } | null;
  vendor: {
    businessName: string | null;
    contactPersonName: string | null;
    phoneNumber: string | null;
    email: string | null;
    kycTier: string | null;
    kycStatus: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
  };
  case: {
    claimReference: string;
    assetType: string;
    branchName?: string | null;
    policyNumber?: string | null;
    brokerName?: string | null;
    agencyName?: string | null;
    insuranceClass?: string | null;
    caseName?: string;
  } | null;
};

function formatPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'paystack':
      return 'Paystack';
    case 'flutterwave':
      return 'Flutterwave';
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'escrow_wallet':
      return 'Escrow Wallet';
    default:
      return method;
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildFinancePaymentExportRow(
  payment: PaymentExportSource,
  getPaymentSourceLabel?: (method: string) => string
): FinancePaymentExportRow {
  const label = getPaymentSourceLabel ?? formatPaymentMethodLabel;
  const isRegistration = payment.paymentType === 'registration_fee' || !payment.case;

  return {
    paymentId: payment.id,
    auctionId: payment.auctionId || 'N/A',
    paymentType: isRegistration ? 'Registration Fee' : 'Auction Payment',
    amount: formatNgnAmount(payment.amount),
    effectiveSaleAmount: payment.effectiveSaleAmount
      ? formatNgnAmount(payment.effectiveSaleAmount)
      : formatNgnAmount(payment.amount),
    settledSaleAmount: payment.settlement?.settledAmount
      ? formatNgnAmount(payment.settlement.settledAmount)
      : 'N/A',
    paidVsSettledDelta: payment.settlement?.hasPriceAdjustment
      ? formatNgnAmount(payment.settlement.paidVsSettledDelta)
      : 'N/A',
    priceAdjusted: payment.settlement?.hasPriceAdjustment ? 'Yes' : 'No',
    status: payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
    paymentMethod: label(payment.paymentMethod),
    paymentReference: payment.paymentReference || 'N/A',
    autoVerified: payment.autoVerified ? 'Yes' : 'No',
    escrowStatus: payment.escrowStatus || 'N/A',
    createdDate: formatDate(payment.createdAt),
    paymentDeadline: formatDate(payment.paymentDeadline),
    vendorBusinessName: payment.vendor.businessName || 'N/A',
    vendorContactName: payment.vendor.contactPersonName || 'N/A',
    vendorPhone: payment.vendor.phoneNumber || 'N/A',
    vendorEmail: payment.vendor.email || 'N/A',
    vendorKycTier: payment.vendor.kycTier || 'N/A',
    vendorKycStatus: payment.vendor.kycStatus || 'N/A',
    vendorBankName: payment.vendor.bankName || 'N/A',
    vendorBankAccount: payment.vendor.bankAccountNumber || 'N/A',
    vendorBankAccountName: payment.vendor.bankAccountName || 'N/A',
    caseName: payment.case?.caseName || (isRegistration ? 'Registration Fee' : 'N/A'),
    claimReference: payment.case?.claimReference || 'N/A',
    assetType: payment.case?.assetType || 'N/A',
    branch: payment.case?.branchName || 'N/A',
    policyNumber: payment.case?.policyNumber || 'N/A',
    broker: payment.case?.brokerName || payment.case?.agencyName || 'N/A',
    insuranceClass: payment.case?.insuranceClass || 'N/A',
    walletAvailableBalance: payment.walletBalance
      ? formatNgnAmount(payment.walletBalance.availableBalance)
      : 'N/A',
    walletFrozenAmount: payment.walletBalance
      ? formatNgnAmount(payment.walletBalance.frozenAmount)
      : 'N/A',
    documentsSigned:
      payment.documentProgress != null
        ? String(payment.documentProgress.signedDocuments)
        : 'N/A',
    documentsTotal:
      payment.documentProgress != null
        ? String(payment.documentProgress.totalDocuments)
        : 'N/A',
  };
}

export const FINANCE_PAYMENT_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'paymentId', header: 'Payment ID' },
  { key: 'auctionId', header: 'Auction ID' },
  { key: 'paymentType', header: 'Payment Type' },
  { key: 'amount', header: 'Amount Collected' },
  { key: 'effectiveSaleAmount', header: 'Effective Sale Amount' },
  { key: 'settledSaleAmount', header: 'Settled Sale Amount' },
  { key: 'paidVsSettledDelta', header: 'Collected vs Settled Gap' },
  { key: 'priceAdjusted', header: 'Pickup Price Adjusted' },
  { key: 'status', header: 'Status' },
  { key: 'paymentMethod', header: 'Payment Method' },
  { key: 'paymentReference', header: 'Transaction Reference' },
  { key: 'autoVerified', header: 'Auto-Verified' },
  { key: 'escrowStatus', header: 'Escrow Status' },
  { key: 'createdDate', header: 'Submitted' },
  { key: 'paymentDeadline', header: 'Deadline' },
  { key: 'vendorBusinessName', header: 'Vendor Business Name' },
  { key: 'vendorContactName', header: 'Vendor Contact' },
  { key: 'vendorPhone', header: 'Vendor Phone' },
  { key: 'vendorEmail', header: 'Vendor Email' },
  { key: 'vendorKycTier', header: 'KYC Tier' },
  { key: 'vendorKycStatus', header: 'KYC Status' },
  { key: 'vendorBankName', header: 'Bank Name' },
  { key: 'vendorBankAccount', header: 'Bank Account' },
  { key: 'vendorBankAccountName', header: 'Bank Account Name' },
  { key: 'caseName', header: 'Case / Asset' },
  { key: 'claimReference', header: 'Claim Reference' },
  { key: 'assetType', header: 'Asset Type' },
  { key: 'branch', header: 'Branch' },
  { key: 'policyNumber', header: 'Policy Number' },
  { key: 'broker', header: 'Broker / Agency' },
  { key: 'insuranceClass', header: 'Insurance Class' },
  { key: 'walletAvailableBalance', header: 'Wallet Available Balance' },
  { key: 'walletFrozenAmount', header: 'Wallet Frozen Amount' },
  { key: 'documentsSigned', header: 'Documents Signed' },
  { key: 'documentsTotal', header: 'Documents Total' },
];

export function generateFinancePaymentsCsv(
  payments: PaymentExportSource[],
  getPaymentSourceLabel?: (method: string) => string
): string {
  const data = payments.map((p) =>
    buildFinancePaymentExportRow(p, getPaymentSourceLabel)
  );
  return ExportService.generateCSV({
    filename: ExportService.generateFilename('finance-payments', 'csv'),
    columns: FINANCE_PAYMENT_EXPORT_COLUMNS,
    data,
  });
}

export function downloadFinancePaymentsCsv(
  csvContent: string,
  filename = ExportService.generateFilename('finance-payments', 'csv')
): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
