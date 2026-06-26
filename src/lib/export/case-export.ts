import type { ExportColumn } from '@/features/export/services/export.service';
import { formatNgnAmount } from '@/lib/utils/format-ngn';

type CaseAssetDetails = {
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  propertyType?: string;
  propertyUse?: string;
  damageArea?: string;
  brand?: string;
  serialNumber?: string;
  storage?: string;
  color?: string;
  type?: string;
  description?: string;
  quantity?: string;
  unitOfMeasure?: string;
  packagingType?: string;
  batchOrSerial?: string;
  consignmentReference?: string;
  serialOrReference?: string;
  declaredCondition?: string;
  condition?: string;
};

type CaseAiAssessment = {
  confidenceScore?: number;
  damagePercentage?: number;
  recommendation?: string;
  analysisMethod?: string;
  manualReviewRequired?: boolean;
};

type CaseAiEstimates = {
  marketValue?: number;
  repairCost?: number;
  salvageValue?: number;
  reservePrice?: number;
  confidence?: number;
};

type CaseManagerOverrides = {
  marketValue?: number;
  repairCost?: number;
  salvageValue?: number;
  reservePrice?: number;
  reason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
};

export type CaseExportSource = {
  id: string;
  claimReference: string;
  policyNumber: string | null;
  insuranceClass: string | null;
  brokerName: string | null;
  agencyName: string | null;
  branchName: string | null;
  assetType: string;
  assetDetails: CaseAssetDetails | null;
  marketValue: string | number;
  estimatedSalvageValue: string | number | null;
  reservePrice: string | number | null;
  damageSeverity: string | null;
  gpsLocation: { x: number; y: number } | [number, number] | null;
  locationName: string;
  locationAccuracyMeters: string | number | null;
  locationSource: string | null;
  locationCapturedAt: Date | null;
  locationManualOverride: boolean;
  photos: string[] | null;
  voiceNotes: string[] | null;
  status: string;
  createdBy: string;
  approvedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  vehicleMileage: number | null;
  vehicleCondition: string | null;
  aiAssessment: CaseAiAssessment | null;
  aiEstimates: CaseAiEstimates | null;
  managerOverrides: CaseManagerOverrides | null;
  createdByName?: string | null;
  approvedByName?: string | null;
};

export type CaseExportRow = Record<string, string>;

function formatStatus(value: string): string {
  const statusMap: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    active_auction: 'Active Auction',
    sold: 'Sold',
    cancelled: 'Cancelled',
  };
  return statusMap[value] || value;
}

function formatDamageSeverity(value: string | null): string {
  if (!value || value === 'none') return 'Not Assessed';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function formatDisplayDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function yesNo(value: boolean | null | undefined): string {
  return value ? 'Yes' : 'No';
}

export function mapCaseToExportRow(row: CaseExportSource): CaseExportRow {
  const details = row.assetDetails ?? {};
  const ai = row.aiAssessment;
  const estimates = row.aiEstimates;
  const overrides = row.managerOverrides;
  const gps = row.gpsLocation;
  const gpsLng = Array.isArray(gps) ? gps[0] : gps?.x;
  const gpsLat = Array.isArray(gps) ? gps[1] : gps?.y;

  return {
    caseId: row.id,
    claimReference: row.claimReference,
    policyNumber: row.policyNumber ?? '',
    insuranceClass: row.insuranceClass ?? '',
    brokerName: row.brokerName ?? '',
    agencyName: row.agencyName ?? '',
    branchName: row.branchName ?? '',
    assetType: row.assetType.charAt(0).toUpperCase() + row.assetType.slice(1),
    assetMake: details.make ?? details.brand ?? '',
    assetModel: details.model ?? '',
    assetYear: details.year != null ? String(details.year) : '',
    vin: details.vin ?? '',
    propertyType: details.propertyType ?? '',
    propertyUse: details.propertyUse ?? '',
    damageArea: details.damageArea ?? '',
    brand: details.brand ?? '',
    serialNumber: details.serialNumber ?? '',
    storage: details.storage ?? '',
    color: details.color ?? '',
    itemType: details.type ?? '',
    description: details.description ?? '',
    quantity: details.quantity ?? '',
    unitOfMeasure: details.unitOfMeasure ?? '',
    packagingType: details.packagingType ?? '',
    batchOrSerial: details.batchOrSerial ?? '',
    consignmentReference: details.consignmentReference ?? '',
    serialOrReference: details.serialOrReference ?? '',
    declaredCondition: details.declaredCondition ?? '',
    condition: details.condition ?? '',
    marketValue: formatNgnAmount(row.marketValue),
    estimatedSalvageValue: formatNgnAmount(row.estimatedSalvageValue, { empty: 'N/A' }),
    reservePrice: formatNgnAmount(row.reservePrice, { empty: 'N/A' }),
    damageSeverity: formatDamageSeverity(row.damageSeverity),
    locationName: row.locationName,
    gpsLongitude: gpsLng != null ? String(gpsLng) : '',
    gpsLatitude: gpsLat != null ? String(gpsLat) : '',
    locationAccuracyMeters: row.locationAccuracyMeters != null ? String(row.locationAccuracyMeters) : '',
    locationSource: row.locationSource ?? '',
    locationCapturedAt: formatDate(row.locationCapturedAt),
    locationManualOverride: yesNo(row.locationManualOverride),
    photoCount: String(row.photos?.length ?? 0),
    photoUrls: (row.photos ?? []).join('|'),
    voiceNoteCount: String(row.voiceNotes?.length ?? 0),
    voiceNoteUrls: (row.voiceNotes ?? []).join('|'),
    status: formatStatus(row.status),
    createdById: row.createdBy,
    createdByName: row.createdByName ?? '',
    approvedById: row.approvedBy ?? '',
    approvedByName: row.approvedByName ?? '',
    createdAt: formatDate(row.createdAt),
    createdDate: formatDisplayDate(row.createdAt),
    updatedAt: formatDate(row.updatedAt),
    approvedAt: formatDate(row.approvedAt),
    vehicleMileage: row.vehicleMileage != null ? String(row.vehicleMileage) : '',
    vehicleCondition: row.vehicleCondition ?? '',
    aiConfidenceScore: ai?.confidenceScore != null ? String(ai.confidenceScore) : '',
    aiDamagePercentage: ai?.damagePercentage != null ? String(ai.damagePercentage) : '',
    aiRecommendation: ai?.recommendation ?? '',
    aiAnalysisMethod: ai?.analysisMethod ?? '',
    aiManualReviewRequired: yesNo(ai?.manualReviewRequired),
    aiEstMarketValue: formatNgnAmount(estimates?.marketValue, { empty: 'N/A' }),
    aiEstRepairCost: formatNgnAmount(estimates?.repairCost, { empty: 'N/A' }),
    aiEstSalvageValue: formatNgnAmount(estimates?.salvageValue, { empty: 'N/A' }),
    aiEstReservePrice: formatNgnAmount(estimates?.reservePrice, { empty: 'N/A' }),
    aiEstConfidence: estimates?.confidence != null ? String(estimates.confidence) : '',
    overrideMarketValue: formatNgnAmount(overrides?.marketValue, { empty: 'N/A' }),
    overrideRepairCost: formatNgnAmount(overrides?.repairCost, { empty: 'N/A' }),
    overrideSalvageValue: formatNgnAmount(overrides?.salvageValue, { empty: 'N/A' }),
    overrideReservePrice: formatNgnAmount(overrides?.reservePrice, { empty: 'N/A' }),
    overrideReason: overrides?.reason ?? '',
    overriddenBy: overrides?.overriddenBy ?? '',
    overriddenAt: overrides?.overriddenAt ?? '',
  };
}

export const CASE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'caseId', header: 'Case ID' },
  { key: 'claimReference', header: 'Claim Reference' },
  { key: 'policyNumber', header: 'Policy Number' },
  { key: 'insuranceClass', header: 'Insurance Class' },
  { key: 'brokerName', header: 'Broker Name' },
  { key: 'agencyName', header: 'Agency Name' },
  { key: 'branchName', header: 'Branch Name' },
  { key: 'assetType', header: 'Asset Type' },
  { key: 'assetMake', header: 'Asset Make' },
  { key: 'assetModel', header: 'Asset Model' },
  { key: 'assetYear', header: 'Asset Year' },
  { key: 'vin', header: 'VIN' },
  { key: 'propertyType', header: 'Property Type' },
  { key: 'propertyUse', header: 'Property Use' },
  { key: 'damageArea', header: 'Damage Area' },
  { key: 'brand', header: 'Brand' },
  { key: 'serialNumber', header: 'Serial Number' },
  { key: 'storage', header: 'Storage' },
  { key: 'color', header: 'Color' },
  { key: 'itemType', header: 'Item Type' },
  { key: 'description', header: 'Description' },
  { key: 'quantity', header: 'Quantity' },
  { key: 'unitOfMeasure', header: 'Unit of Measure' },
  { key: 'packagingType', header: 'Packaging Type' },
  { key: 'batchOrSerial', header: 'Batch/Serial' },
  { key: 'consignmentReference', header: 'Consignment Reference' },
  { key: 'serialOrReference', header: 'Serial/Reference' },
  { key: 'declaredCondition', header: 'Declared Condition' },
  { key: 'condition', header: 'Condition' },
  { key: 'marketValue', header: 'Market Value' },
  { key: 'estimatedSalvageValue', header: 'Estimated Salvage Value' },
  { key: 'reservePrice', header: 'Reserve Price' },
  { key: 'damageSeverity', header: 'Damage Severity' },
  { key: 'locationName', header: 'Location Name' },
  { key: 'gpsLongitude', header: 'GPS Longitude' },
  { key: 'gpsLatitude', header: 'GPS Latitude' },
  { key: 'locationAccuracyMeters', header: 'Location Accuracy (m)' },
  { key: 'locationSource', header: 'Location Source' },
  { key: 'locationCapturedAt', header: 'Location Captured At' },
  { key: 'locationManualOverride', header: 'Location Manual Override' },
  { key: 'photoCount', header: 'Photo Count' },
  { key: 'photoUrls', header: 'Photo URLs' },
  { key: 'voiceNoteCount', header: 'Voice Note Count' },
  { key: 'voiceNoteUrls', header: 'Voice Note URLs' },
  { key: 'status', header: 'Status' },
  { key: 'createdById', header: 'Created By (User ID)' },
  { key: 'createdByName', header: 'Created By Name' },
  { key: 'approvedById', header: 'Approved By (User ID)' },
  { key: 'approvedByName', header: 'Approved By Name' },
  { key: 'createdAt', header: 'Created At (ISO)' },
  { key: 'createdDate', header: 'Created Date' },
  { key: 'updatedAt', header: 'Updated At (ISO)' },
  { key: 'approvedAt', header: 'Approved At (ISO)' },
  { key: 'vehicleMileage', header: 'Vehicle Mileage' },
  { key: 'vehicleCondition', header: 'Vehicle Condition' },
  { key: 'aiConfidenceScore', header: 'AI Confidence Score' },
  { key: 'aiDamagePercentage', header: 'AI Damage Percentage' },
  { key: 'aiRecommendation', header: 'AI Recommendation' },
  { key: 'aiAnalysisMethod', header: 'AI Analysis Method' },
  { key: 'aiManualReviewRequired', header: 'AI Manual Review Required' },
  { key: 'aiEstMarketValue', header: 'AI Est. Market Value' },
  { key: 'aiEstRepairCost', header: 'AI Est. Repair Cost' },
  { key: 'aiEstSalvageValue', header: 'AI Est. Salvage Value' },
  { key: 'aiEstReservePrice', header: 'AI Est. Reserve Price' },
  { key: 'aiEstConfidence', header: 'AI Est. Confidence' },
  { key: 'overrideMarketValue', header: 'Override Market Value' },
  { key: 'overrideRepairCost', header: 'Override Repair Cost' },
  { key: 'overrideSalvageValue', header: 'Override Salvage Value' },
  { key: 'overrideReservePrice', header: 'Override Reserve Price' },
  { key: 'overrideReason', header: 'Override Reason' },
  { key: 'overriddenBy', header: 'Overridden By' },
  { key: 'overriddenAt', header: 'Overridden At' },
];
