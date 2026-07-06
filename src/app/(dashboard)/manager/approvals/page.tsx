/**
 * Mobile Case Approval Page for Salvage Manager
 * 
 * Mobile-optimized interface for reviewing and approving/rejecting salvage cases.
 * Features:
 * - Mobile-optimized card layout for approval queue
 * - Swipeable photo gallery
 * - AI assessment results display
 * - GPS location on map
 * - Approve/reject with comment field
 * - Push notifications for new cases
 * 
 * Requirements: 15, NFR5.3, Enterprise Standards Section 9.1
 */

'use client';

import { useState, useEffect } from 'react';
import { SwipeTabsBody } from '@/components/ui/swipe-tabs-body';

const APPROVAL_TABS = ['pending', 'approved', 'rejected', 'all'] as const;
import { StatCard, StatGrid } from '@/components/ui/stat-card';
import { useAppRouter } from '@/hooks/use-app-router';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { PriceField } from '@/components/manager/price-field';
import { validatePriceOverrides as validatePrices, type PriceOverrides } from '@/lib/validation/price-validation';
import { formatConditionForDisplay } from '@/features/valuations/services/condition-mapping.service';
import { AuctionScheduleSelector, type AuctionScheduleValue } from '@/components/ui/auction-schedule-selector';
import { CasePhotoGallery } from '@/components/ui/case-photo-gallery';
import { DataLoadingState } from '@/components/ui/loading-states';
import { resolveCaseDisplayStatus } from '@/lib/metrics/case-display-status';
import { LocationMap } from '@/components/ui/location-map';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { ResultModal } from '@/components/ui/result-modal';
import { Star, Check, X, CheckCircle, Banknote, Loader2, Save, RotateCcw } from 'lucide-react';
import { OfflineAwareButton } from '@/components/ui/offline-aware-button';
import { formatStaffReviewNotes } from '@/features/cases/services/ai-warning-sanitization';
import { usePublicBusinessPolicy } from '@/hooks/use-public-business-policy';
import { GeminiDamageDisplay } from '@/components/ai-assessment/gemini-damage-display';
import { formatNairaOrPending } from '@/lib/utils/currency-formatter';
import { normalizeDamageEvidence } from '@/lib/ai/damage-evidence';

const AI_ANALYSIS_STEPS = ['Reading photos', 'Detecting damage', 'Valuing salvage'] as const;

const INTERNAL_DAMAGE_LABELS = new Set(['assessment unavailable']);

function formatSeverityLabel(severity?: string | null): string {
  if (!severity || severity === 'unknown' || severity === 'none') return 'Pending';
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function getDisplayableDamageLabels(labels?: string[]): string[] {
  if (!labels?.length) return [];
  return labels.filter((label) => !INTERNAL_DAMAGE_LABELS.has(label.toLowerCase().trim()));
}

type DisplayDamagedPart = {
  part: string;
  damageType?: string;
  description?: string;
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;
};

/**
 * Case data structure
 */
interface CaseData {
  id: string;
  claimReference: string;
  policyNumber?: string | null;
  assetType: string;
  insuranceClass?: string | null;
  brokerName?: string | null;
  agencyName?: string | null;
  branchName?: string | null;
  assetDetails: Record<string, string | number | undefined>;
  marketValue: string;
  estimatedSalvageValue: string;
  reservePrice: string;
  damageSeverity: 'minor' | 'moderate' | 'severe';
  aiAssessment: {
    labels: string[];
    confidenceScore: number;
    damagePercentage: number;
    processedAt: string;
    warnings?: string[];
    reviewReasons?: string[];
    confidence?: {
      overall: number;
      vehicleDetection: number;
      damageDetection: number;
      valuationAccuracy: number;
      photoQuality: number;
      reasons: string[];
    };
    itemDetails?: {
      detectedMake?: string;
      detectedModel?: string;
      detectedYear?: string;
      color?: string;
      trim?: string;
      bodyStyle?: string;
      storage?: string;
      overallCondition?: string;
      notes?: string;
    };
    damagedParts?: Array<{
      part: string;
      damageType?: string;
      description?: string;
      severity: 'minor' | 'moderate' | 'severe';
      confidence: number;
    }>;
    damageBreakdown?: Array<{
      component: string;
      damageLevel: string;
      repairCost?: number;
      deductionPercent?: number;
      deductionAmount?: number;
    }>;
    recommendation?: string;
    summary?: string;
  } | null;
  gpsLocation?: {
    x: number; // longitude
    y: number; // latitude
  };
  locationName?: string;
  photos: string[];
  voiceNotes: string[];
  status: string;
  createdBy: string;
  createdAt: string;
  adjusterName?: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  vehicleMileage?: number;
  vehicleCondition?: 'excellent' | 'good' | 'fair' | 'poor';
  auctionId?: string | null;
  auctionStatus?: string | null;
  auctionEndTime?: string | null;
  paymentId?: string | null;
  paymentStatus?: string | null;
}

/**
 * Approval action type
 */
type ApprovalAction = 'approve' | 'reject' | null;

/**
 * Check if a photo URL is valid
 */
const NEXT_IMAGE_REMOTE_HOSTS = new Set([
  'res.cloudinary.com',
  'identity.dojah.io',
  'widget.dojah.io',
  'maps.googleapis.com',
  'www.googleapis.com',
]);

function isConfiguredNextImageHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return NEXT_IMAGE_REMOTE_HOSTS.has(normalizedHostname) || normalizedHostname.endsWith('.cloudinary.com');
}

function isCloudinaryImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === 'res.cloudinary.com' || parsed.hostname.toLowerCase().endsWith('.cloudinary.com');
  } catch {
    return false;
  }
}

const isValidPhotoUrl = (url: unknown): url is string => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;

  try {
    const parsed = new URL(trimmed);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return isConfiguredNextImageHost(parsed.hostname);
  } catch {
    return false;
  }
};

const CURRENCY_DETAIL_KEYS = new Set([
  'marketValue',
  'estimatedValue',
  'purchasePrice',
  'replacementValue',
  'claimAmount',
  'claimsPaid',
  'assetValue',
  'insuredValue',
  'reservePrice',
  'estimatedSalvageValue',
]);

const INSURANCE_CLASS_LABELS: Record<string, string> = {
  motor: 'Motor',
  goods_in_transit: 'Goods in Transit (GIT)',
  fire: 'Fire and Special Perils',
  burglary: 'Burglary/Theft',
  marine: 'Marine',
  engineering: 'Engineering/Plant',
  agriculture: 'Agriculture',
  liability: 'Liability',
  other: 'Other',
};

function formatInsuranceClass(value?: string | null): string {
  if (!value) return 'Not set';
  return INSURANCE_CLASS_LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function parseNumberLike(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeDamagedParts(assessment: CaseData['aiAssessment']): DisplayDamagedPart[] {
  if (!assessment) return [];

  if (Array.isArray(assessment.damagedParts) && assessment.damagedParts.length > 0) {
    return assessment.damagedParts
      .filter((part) => typeof part?.part === 'string' && part.part.trim().length > 0)
      .map((part) => normalizeDamageEvidence({
        part: part.part.trim(),
        damageType: part.damageType,
        description: part.description,
        severity: part.severity,
        confidence: Number.isFinite(part.confidence) ? part.confidence : 75,
      }));
  }

  if (Array.isArray(assessment.damageBreakdown) && assessment.damageBreakdown.length > 0) {
    return assessment.damageBreakdown
      .filter((part) => typeof part?.component === 'string' && part.component.trim().length > 0)
      .map((part) => {
        const normalizedSeverity = String(part.damageLevel || '').toLowerCase();
        const severity: DisplayDamagedPart['severity'] =
          normalizedSeverity === 'minor' || normalizedSeverity === 'moderate' || normalizedSeverity === 'severe'
            ? normalizedSeverity
            : 'moderate';

        return normalizeDamageEvidence({
          part: part.component.trim(),
          severity,
          confidence: 70,
        });
      });
  }

  return [];
}

function parseFiniteNumber(value: unknown): number | undefined {
  const parsed = parseNumberLike(value);
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
}

function formatPendingCurrency(
  value: unknown,
  pendingLabel = 'Pending Analysis',
  options: { treatZeroAsPending?: boolean } = {}
): string {
  return formatNairaOrPending(value as string | number | null | undefined, pendingLabel, {
    treatZeroAsPending: options.treatZeroAsPending ?? false,
  });
}

function buildCasePatchPayload(input: {
  locationName?: string;
}): Record<string, string> {
  const payload: Record<string, string> = {};
  const locationName = input.locationName?.trim();
  if (locationName) payload.locationName = locationName;
  return payload;
}

function normalizeCondition(value: unknown): CaseData['vehicleCondition'] | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().trim();
  if (normalized.includes('excellent')) return 'excellent';
  if (normalized.includes('poor') || normalized.includes('bad')) return 'poor';
  if (normalized.includes('fair') || normalized.includes('average')) return 'fair';
  if (normalized.includes('good') || normalized.includes('foreign') || normalized.includes('tokunbo')) return 'good';
  return undefined;
}

function getVehicleMileage(caseData: CaseData): number | undefined {
  return caseData.vehicleMileage
    ?? parseNumberLike(caseData.assetDetails?.mileage)
    ?? parseNumberLike(caseData.assetDetails?.odometer);
}

function getVehicleCondition(caseData: CaseData): CaseData['vehicleCondition'] | undefined {
  return caseData.vehicleCondition
    ?? normalizeCondition(caseData.assetDetails?.condition)
    ?? normalizeCondition(caseData.aiAssessment?.itemDetails?.overallCondition);
}

function formatAssetDetailValue(key: string, value: string | number): string {
  if (typeof value === 'string') return value;
  const normalizedKey = key.toLowerCase();

  if (normalizedKey.includes('year')) {
    return String(value);
  }

  if (normalizedKey.includes('mileage') || normalizedKey.includes('odometer')) {
    return `${value.toLocaleString()} km`;
  }

  if (CURRENCY_DETAIL_KEYS.has(key) || normalizedKey.includes('price') || normalizedKey.includes('amount') || normalizedKey.includes('value')) {
    return `₦${value.toLocaleString()}`;
  }

  return value.toLocaleString();
}

export default function ApprovalsPage() {
  const router = useAppRouter();
  const { status } = useSession();
  
  // State
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const [allCases, setAllCases] = useState<CaseData[]>([]); // Store all cases
  const [cases, setCases] = useState<CaseData[]>([]); // Filtered cases for display
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvalAction, setApprovalAction] = useState<ApprovalAction>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunningManagerAi, setIsRunningManagerAi] = useState(false);
  const [aiAnalysisStep, setAiAnalysisStep] = useState(0);
  const { policy: publicPolicy } = usePublicBusinessPolicy();
  const managerRunsAiAssessment = publicPolicy?.cases?.aiDamageAssessmentRunner === 'salvage_manager';

  useEffect(() => {
    if (!isRunningManagerAi) {
      setAiAnalysisStep(0);
      return;
    }

    setAiAnalysisStep(0);
    const interval = window.setInterval(() => {
      setAiAnalysisStep((prev) => (prev + 1) % AI_ANALYSIS_STEPS.length);
    }, 4000);

    return () => window.clearInterval(interval);
  }, [isRunningManagerAi]);
  
  // Price override state
  const [isEditMode, setIsEditMode] = useState(false);
  const [priceOverrides, setPriceOverrides] = useState<PriceOverrides>({});
  const [overrideComment, setOverrideComment] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [brokerName, setBrokerName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  
  // Auction schedule state
  const [auctionSchedule, setAuctionSchedule] = useState<AuctionScheduleValue>({ 
    mode: 'now',
    durationHours: 120, // Default 5 days
  });
  
  // Modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultModalData, setResultModalData] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    details?: string[];
  }>({
    type: 'success',
    title: '',
    message: '',
  });

  /**
   * Fetch all cases on mount only
   */
  useEffect(() => {
    if (status === 'authenticated') {
      fetchPendingCases();
    }
  }, [status]);

  /**
   * Filter cases based on active tab (client-side filtering)
   */
  useEffect(() => {
    if (allCases.length === 0) {
      setCases([]);
      return;
    }

    // Deduplicate cases by ID (in case of duplicate rows from joins)
    const uniqueCases = Array.from(
      new Map(allCases.map(c => [c.id, c])).values()
    );

    let filtered: CaseData[] = [];
    switch (activeTab) {
      case 'pending':
        filtered = uniqueCases.filter(c => c.status === 'pending_approval');
        break;
      case 'approved':
        // Show cases that have been approved (have approvedBy field)
        // This includes cases in 'active_auction' and 'sold' status
        filtered = uniqueCases.filter(c => c.approvedBy !== null && c.approvedBy !== undefined);
        break;
      case 'rejected':
        filtered = uniqueCases.filter(c => c.status === 'rejected');
        break;
      case 'all':
        filtered = uniqueCases;
        break;
    }
    setCases(filtered);
  }, [activeTab, allCases]);

  /**
   * Request notification permission on mount
   */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /**
   * Fetch all cases from API (no filtering - get everything)
   * Add cache-busting timestamp to force fresh data
   */
  const fetchPendingCases = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Add timestamp to bust cache
      const timestamp = Date.now();
      // Fetch enough rows so dashboard counts are actionable (avoid "phantom" pending items
      // that exist beyond the first page).
      const response = await fetch(`/api/cases?limit=500&offset=0&_t=${timestamp}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }

      const data = await response.json();
      setAllCases(data.data || []);
    } catch (err) {
      console.error('Error fetching cases:', err);
      setError(err instanceof Error ? err.message : 'Failed to load cases');
    } finally {
      setIsLoading(false);
    }
  };

  const runManagerAiAssessment = async () => {
    if (!selectedCase) return;

    setIsRunningManagerAi(true);
    try {
      const response = await fetch(`/api/cases/${selectedCase.id}/ai-assessment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'AI assessment failed');
      }

      await fetchPendingCases();
      const caseResponse = await fetch(`/api/cases/${selectedCase.id}`);
      const casePayload = await caseResponse.json();
      if (caseResponse.ok && casePayload.success && casePayload.data) {
        const freshAiAssessment = payload.data?.aiAssessment;
        setSelectedCase({
          ...(casePayload.data as CaseData),
          damageSeverity: payload.data?.damageSeverity || (casePayload.data as CaseData).damageSeverity,
          marketValue: String(payload.data?.marketValue ?? (casePayload.data as CaseData).marketValue),
          estimatedSalvageValue: String(payload.data?.estimatedSalvageValue ?? (casePayload.data as CaseData).estimatedSalvageValue),
          reservePrice: String(payload.data?.reservePrice ?? (casePayload.data as CaseData).reservePrice),
          aiAssessment: freshAiAssessment || (casePayload.data as CaseData).aiAssessment || selectedCase.aiAssessment,
        });
      } else if (payload.data?.aiAssessment) {
        setSelectedCase({
          ...selectedCase,
          damageSeverity: payload.data.damageSeverity || selectedCase.damageSeverity,
          marketValue: String(payload.data.marketValue ?? selectedCase.marketValue),
          estimatedSalvageValue: String(payload.data.estimatedSalvageValue ?? selectedCase.estimatedSalvageValue),
          reservePrice: String(payload.data.reservePrice ?? selectedCase.reservePrice),
          aiAssessment: payload.data.aiAssessment,
        });
      }
    } catch (error) {
      setResultModalData({
        type: 'error',
        title: 'AI assessment failed',
        message: error instanceof Error ? error.message : 'Unable to run AI assessment',
      });
      setShowResultModal(true);
    } finally {
      setIsRunningManagerAi(false);
    }
  };

  const saveCaseLocation = async () => {
    if (!selectedCase || selectedCase.status !== 'pending_approval') return;

    const patchPayload = buildCasePatchPayload({ locationName });
    if (!patchPayload.locationName) {
      setResultModalData({
        type: 'error',
        title: 'Location required',
        message: 'Enter a pickup or inspection location before saving.',
      });
      setShowResultModal(true);
      return;
    }

    try {
      setIsSavingLocation(true);
      const response = await fetch(`/api/cases/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to update location');
      }

      const updatedCase = {
        ...selectedCase,
        locationName: patchPayload.locationName,
      };
      setSelectedCase(updatedCase);
      setAllCases((current) => current.map((caseItem) => (
        caseItem.id === updatedCase.id ? updatedCase : caseItem
      )));
      setResultModalData({
        type: 'success',
        title: 'Location updated',
        message: 'The case location has been saved.',
      });
      setShowResultModal(true);
    } catch (error) {
      setResultModalData({
        type: 'error',
        title: 'Location update failed',
        message: error instanceof Error ? error.message : 'Unable to update the case location',
      });
      setShowResultModal(true);
    } finally {
      setIsSavingLocation(false);
    }
  };

  /**
   * Handle case selection
   */
  const handleCaseSelect = (caseData: CaseData) => {
    setSelectedCase(caseData);
    setApprovalAction(null);
    setComment('');
    // Reset price override state
    setIsEditMode(false);
    setPriceOverrides({});
    setOverrideComment('');
    setValidationErrors([]);
    setValidationWarnings([]);
    setBrokerName(caseData.brokerName ?? '');
    setAgencyName(caseData.agencyName ?? '');
    setBranchName(caseData.branchName ?? '');
    setLocationName(caseData.locationName ?? '');
    // Reset auction schedule to default
    setAuctionSchedule({ 
      mode: 'now',
      durationHours: 120, // Default 5 days
    });
    // Reset modal state
    setShowConfirmModal(false);
    setShowResultModal(false);
  };

  /**
   * Handle approval action - Show confirmation modal
   */
  const handleApprovalAction = (action: 'approve' | 'reject') => {
    if (action === 'approve') {
      if (brokerName.trim() && agencyName.trim()) {
        setResultModalData({
          type: 'error',
          title: 'Business Source Required',
          message: 'Use either broker or agency for this case, not both.',
        });
        setShowResultModal(true);
        return;
      }

      if (!brokerName.trim() && !agencyName.trim()) {
        setResultModalData({
          type: 'error',
          title: 'Business Source Required',
          message: 'Enter either a broker or an agency before approving this case.',
        });
        setShowResultModal(true);
        return;
      }
    }

    setApprovalAction(action);
    
    // For approval, show confirmation modal immediately
    if (action === 'approve') {
      setShowConfirmModal(true);
    }
  };

  useEffect(() => {
    if (!isEditMode || !selectedCase) {
      setValidationErrors([]);
      setValidationWarnings([]);
      return;
    }

    const result = validatePrices(priceOverrides, {
      marketValue: parseFloat(selectedCase.marketValue),
      salvageValue: parseFloat(selectedCase.estimatedSalvageValue),
      reservePrice: parseFloat(selectedCase.reservePrice),
    });
    setValidationErrors(result.errors);
    setValidationWarnings(result.warnings);
  }, [priceOverrides, isEditMode, selectedCase]);

  /**
   * Handle price change
   */
  const handlePriceChange = (field: keyof PriceOverrides, value: number) => {
    setPriceOverrides(prev => ({
      ...prev,
      [field]: value,
    }));
    // Validation will be triggered by useEffect
  };

  /**
   * Handle edit mode toggle
   */
  const handleEditModeToggle = () => {
    if (isEditMode) {
      // Exiting edit mode - reset overrides
      setPriceOverrides({});
      setOverrideComment('');
      setValidationErrors([]);
      setValidationWarnings([]);
    }
    setIsEditMode(!isEditMode);
  };

  /**
   * Check if there are any overrides
   */
  const hasOverrides = Object.keys(priceOverrides).length > 0;

  /**
   * Check if can approve with changes
   */
  const canApproveWithChanges = (() => {
    if (!hasOverrides || overrideComment.trim().length < 10 || !selectedCase) {
      return false;
    }
    
    // Only check for errors, not warnings
    const result = validatePrices(
      priceOverrides,
      {
        marketValue: parseFloat(selectedCase.marketValue),
        salvageValue: parseFloat(selectedCase.estimatedSalvageValue),
        reservePrice: parseFloat(selectedCase.reservePrice),
      }
    );
    
    return result.isValid;
  })();

  /**
   * Handle result modal close
   */
  const handleResultModalClose = () => {
    setShowResultModal(false);
    
    // If it was a success, close the detail view
    if (resultModalData.type === 'success') {
      setSelectedCase(null);
      setApprovalAction(null);
      setComment('');
      setIsEditMode(false);
      setPriceOverrides({});
      setOverrideComment('');
      setValidationErrors([]);
      setValidationWarnings([]);
      setAuctionSchedule({ 
        mode: 'now',
        durationHours: 120, // Default 5 days
      });
      setLocationName('');
    }
  };

  /**
   * Get confirmation modal content
   */
  const getConfirmationContent = () => {
    if (!selectedCase) return { title: '', message: '' };
    
    if (approvalAction === 'approve') {
      const hasChanges = hasOverrides;
      return {
        title: hasChanges ? 'Approve with Price Changes?' : 'Approve Case?',
        message: hasChanges
          ? `You are about to approve case ${selectedCase.claimReference} with price adjustments.\n\nThis will:\n• Apply your price changes\n• Create an auction\n• Notify matching vendors\n\nAre you sure you want to proceed?`
          : `You are about to approve case ${selectedCase.claimReference}.\n\nThis will:\n• Create an auction with AI-estimated prices\n• Notify matching vendors\n\nAre you sure you want to proceed?`,
      };
    } else if (approvalAction === 'reject') {
      return {
        title: 'Reject Case?',
        message: `You are about to reject case ${selectedCase.claimReference}.\n\nThis will:\n• Return the case to the adjuster\n• Notify the adjuster of rejection\n• Include your rejection reason\n\nAre you sure you want to proceed?`,
      };
    }
    
    return { title: '', message: '' };
  };

  /**
   * Submit approval decision
   */
  const handleSubmit = async () => {
    if (!selectedCase || !approvalAction) return;

    // Validate comment for rejection
    if (approvalAction === 'reject' && comment.trim().length < 10) {
      setResultModalData({
        type: 'error',
        title: 'Validation Error',
        message: 'Please provide a detailed reason for rejection (minimum 10 characters)',
      });
      setShowResultModal(true);
      return;
    }

    // Validate price overrides if in edit mode
    if (isEditMode && hasOverrides) {
      const result = validatePrices(
        priceOverrides,
        {
          marketValue: parseFloat(selectedCase.marketValue),
          salvageValue: parseFloat(selectedCase.estimatedSalvageValue),
          reservePrice: parseFloat(selectedCase.reservePrice),
        }
      );
      
      if (!result.isValid) {
        setValidationErrors(result.errors);
        setValidationWarnings(result.warnings);
        setResultModalData({
          type: 'error',
          title: 'Validation Error',
          message: 'Please fix validation errors before submitting',
          details: result.errors,
        });
        setShowResultModal(true);
        return;
      }
      
      if (overrideComment.trim().length < 10) {
        setResultModalData({
          type: 'error',
          title: 'Validation Error',
          message: 'Please provide a reason for price changes (minimum 10 characters)',
        });
        setShowResultModal(true);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setShowConfirmModal(false); // Close confirmation modal

      const response = await fetch(`/api/cases/${selectedCase.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: approvalAction,
          comment: comment.trim() || overrideComment.trim() || undefined,
          brokerName: brokerName.trim() || undefined,
          agencyName: agencyName.trim() || undefined,
          branchName: branchName.trim() || undefined,
          locationName: locationName.trim() || undefined,
          priceOverrides: hasOverrides ? priceOverrides : undefined,
          scheduleData: approvalAction === 'approve' ? auctionSchedule : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process approval');
      }

      // Show success message in modal
      if (approvalAction === 'approve') {
        setResultModalData({
          type: 'success',
          title: 'Case Approved',
          message: hasOverrides
            ? 'Case approved with price adjustments! Auction created.'
            : 'Case approved! Auction created.',
          details: hasOverrides ? [
            'Price adjustments have been applied',
            'Auction is now live',
          ] : [
            'Auction is now live',
          ],
        });
      } else {
        setResultModalData({
          type: 'success',
          title: 'Case Rejected',
          message: 'Case rejected and returned to adjuster.',
          details: [
            'The adjuster has been notified',
            'Case status updated to draft',
          ],
        });
      }
      setShowResultModal(true);

      // Refresh cases list
      await fetchPendingCases();
      
      // Reset state (will be done when modal closes)
    } catch (err) {
      console.error('Error submitting approval:', err);
      setResultModalData({
        type: 'error',
        title: 'Submission Failed',
        message: err instanceof Error ? err.message : 'Failed to submit approval',
      });
      setShowResultModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Format date
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  /**
   * Get severity color
   */
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor':
        return 'bg-green-100 text-green-800';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'severe':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Get status badge with smart label mapping
   * Maps 'active_auction' to 'Payment Pending' when auction is closed
   */
  const getStatusBadge = (caseData: CaseData) => {
    const display = resolveCaseDisplayStatus(caseData);

    const badges: Record<string, { label: string; color: string }> = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
      pending_approval: { label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-800' },
      active_auction: { label: 'Active Auction', color: 'bg-blue-100 text-blue-800' },
      awaiting_payment: { label: 'Payment Pending', color: 'bg-orange-100 text-orange-800' },
      awaiting_pickup: { label: 'Awaiting Pickup', color: 'bg-amber-100 text-amber-800' },
      closed: { label: 'Auction Closed', color: 'bg-gray-100 text-gray-800' },
      sold: { label: 'Sold', color: 'bg-purple-100 text-purple-800' },
      cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
    };

    return badges[display] || badges.draft;
  };

  if (status === 'loading' || isLoading) {
    return <DataLoadingState label="Case approvals" variant="page" />;
  }

  // Unauthenticated state
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-bold mb-2">Unauthorized</h2>
          <p className="text-red-600 mb-4">Please log in to access this page.</p>
          <button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-bold mb-2">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchPendingCases}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedCase) {
    const vehicleMileage = getVehicleMileage(selectedCase);
    const vehicleCondition = getVehicleCondition(selectedCase);
    const marketValue = parseFiniteNumber(selectedCase.marketValue);
    const salvageValue = parseFiniteNumber(selectedCase.estimatedSalvageValue);
    const reservePrice = parseFiniteNumber(selectedCase.reservePrice);
    const canRunManagerAnalysis = managerRunsAiAssessment && selectedCase.status === 'pending_approval';
    const displayDamageLabels = getDisplayableDamageLabels(selectedCase.aiAssessment?.labels);
    const displayDamagedParts = normalizeDamagedParts(selectedCase.aiAssessment);

    return (
      <div className="min-h-screen bg-gray-50 pb-32 overflow-y-auto">
        {/* Header */}
        <div className="bg-[var(--brand-primary)] text-white p-4 sticky top-0 z-40 shadow-md">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedCase(null)}
              className="text-white hover:text-gray-200"
            >
              ← Back
            </button>
            <h1 className="text-lg font-bold">Case Details</h1>
            <div className="w-16" />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Case Info Card */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedCase.claimReference}</h2>
                <p className="text-sm text-gray-600">Submitted {formatDate(selectedCase.createdAt)}</p>
                {selectedCase.adjusterName && (
                  <p className="text-sm text-gray-700 mt-1">
                    Claims adjuster: <span className="font-medium">{selectedCase.adjusterName}</span>
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(selectedCase.damageSeverity)}`}>
                  {formatSeverityLabel(selectedCase.damageSeverity)}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedCase).color}`}>
                  {getStatusBadge(selectedCase).label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-600">Asset Type</p>
                <p className="font-medium capitalize">{selectedCase.assetType}</p>
              </div>
              <div>
                <p className="text-gray-600">Insurance Class</p>
                <p className="font-medium">{formatInsuranceClass(selectedCase.insuranceClass)}</p>
              </div>
              <div>
                <p className="text-gray-600">Policy Number</p>
                <p className="font-medium">{selectedCase.policyNumber || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600">Market Value</p>
                <p className="font-medium">
                  {formatPendingCurrency(marketValue, 'Pending Analysis', { treatZeroAsPending: !selectedCase.aiAssessment })}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Estimated Salvage Value</p>
                <p className="font-medium">
                  {formatPendingCurrency(salvageValue)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Reserve Price</p>
                <p className="font-medium">
                  {formatPendingCurrency(reservePrice)}
                </p>
              </div>
            </div>
          </div>

          {/* Business Source */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-bold text-gray-900 mb-3">Business Source</h3>
            <p className="text-sm text-gray-600 mb-4">
              Approval requires either a broker or an agency. Branch is used for reporting and recovery leakage analysis.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Branch</span>
                <input
                  value={branchName}
                  onChange={(event) => setBranchName(event.target.value)}
                  placeholder="e.g. Akure"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Broker</span>
                <input
                  value={brokerName}
                  onChange={(event) => setBrokerName(event.target.value)}
                  placeholder="Broker name"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Agency</span>
                <input
                  value={agencyName}
                  onChange={(event) => setAgencyName(event.target.value)}
                  placeholder="Agency name"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                />
              </label>
            </div>
            {brokerName.trim() && agencyName.trim() ? (
              <p className="mt-3 text-sm text-red-600">Use either broker or agency, not both.</p>
            ) : !brokerName.trim() && !agencyName.trim() ? (
              <p className="mt-3 text-sm text-amber-700">Enter broker or agency before approval.</p>
            ) : null}
          </div>

          <CasePhotoGallery photos={selectedCase.photos} title="Case photos" className="shadow-md" />

          {/* AI Assessment */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-gray-900 flex items-center">
              <span className="mr-2">🤖</span>
              AI Damage Assessment
            </h3>
              {canRunManagerAnalysis && selectedCase.aiAssessment && (
                <OfflineAwareButton
                  onClick={() => void runManagerAiAssessment()}
                  disabled={isRunningManagerAi}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isRunningManagerAi ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  )}
                  {isRunningManagerAi ? 'Running AI analysis...' : 'Re-run AI analysis'}
                </OfflineAwareButton>
              )}
            </div>

            {isRunningManagerAi && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>{AI_ANALYSIS_STEPS[aiAnalysisStep]}</span>
                  </div>
                  <span className="text-xs text-blue-700">
                    Step {aiAnalysisStep + 1} of {AI_ANALYSIS_STEPS.length}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {AI_ANALYSIS_STEPS.map((step, index) => (
                    <div
                      key={step}
                      className={`h-1.5 rounded-full ${
                        index <= aiAnalysisStep ? 'bg-blue-600' : 'bg-blue-100'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {!selectedCase.aiAssessment ? (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3">
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">No AI assessment yet</span>
                  <br />
                  {managerRunsAiAssessment
                    ? 'Run AI damage analysis on the submitted photos before approving this case.'
                    : 'AI assessment data is not available for this case. Manual review is required.'}
                </p>
                {canRunManagerAnalysis && (
                  <OfflineAwareButton
                    onClick={() => void runManagerAiAssessment()}
                    disabled={isRunningManagerAi}
                    className="inline-flex items-center gap-2 bg-[var(--brand-primary)] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                  >
                    {isRunningManagerAi && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {isRunningManagerAi ? 'Running AI analysis...' : 'Run AI damage analysis'}
                  </OfflineAwareButton>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Overall Confidence Score - Prominent Display */}
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium">Overall Confidence</span>
                  <div className="flex items-center">
                    <div className="w-32 h-3 bg-gray-200 rounded-full mr-3">
                      <div
                        className={`h-3 rounded-full ${
                          selectedCase.aiAssessment.confidenceScore >= 80 ? 'bg-green-500' :
                          selectedCase.aiAssessment.confidenceScore >= 70 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${selectedCase.aiAssessment.confidenceScore}%` }}
                      />
                    </div>
                    <span className={`font-bold text-lg ${
                      selectedCase.aiAssessment.confidenceScore >= 80 ? 'text-green-600' :
                      selectedCase.aiAssessment.confidenceScore >= 70 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {selectedCase.aiAssessment.confidenceScore}%
                    </span>
                  </div>
                </div>

                {/* Low Confidence Warning */}
                {selectedCase.aiAssessment.confidenceScore < 70 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                    <svg className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-medium text-red-800">Low Confidence Score</p>
                      <p className="text-sm text-red-700 mt-1">Manual review strongly recommended. The AI assessment may be less accurate.</p>
                    </div>
                  </div>
                )}

                {/* Mileage and Condition Info */}
                {selectedCase.assetType === 'vehicle' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 font-medium mb-1">📊 Mileage</p>
                      <p className="text-sm font-bold text-blue-900">
                        {vehicleMileage 
                          ? `${vehicleMileage.toLocaleString()} km`
                          : 'Not provided'}
                      </p>
                      {!vehicleMileage && (
                        <p className="text-xs text-blue-700 mt-1">Estimated from vehicle age</p>
                      )}
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-xs text-purple-600 font-medium mb-1 flex items-center gap-1">
                        <Star className="w-4 h-4" aria-hidden="true" />
                        <span>Condition</span>
                      </p>
                      <p className="text-sm font-bold text-purple-900">
                        {vehicleCondition 
                          ? formatConditionForDisplay(vehicleCondition).label
                          : 'Good (Foreign Used) (default)'}
                      </p>
                      {!vehicleCondition && (
                        <p className="text-xs text-purple-700 mt-1">Default assumption</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Missing Data Notices */}
                {selectedCase.assetType === 'vehicle' && (!vehicleMileage || !vehicleCondition) && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <span className="font-medium">ℹ️ Note:</span> {' '}
                      {!vehicleMileage && !vehicleCondition 
                        ? 'Mileage and condition data not provided. Estimates may be less accurate.'
                        : !vehicleMileage
                        ? 'Mileage data not provided. Using estimated mileage based on vehicle age.'
                        : 'Condition data not provided. Assuming "good" condition.'}
                    </p>
                  </div>
                )}

                {/* AI Warnings */}
                {(() => {
                  const warnings = formatStaffReviewNotes(
                    selectedCase.aiAssessment.reviewReasons,
                    selectedCase.aiAssessment.warnings,
                    {
                      confidenceScore: selectedCase.aiAssessment.confidenceScore,
                      manualReviewRequired: true,
                    }
                  );
                  return warnings.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Review Notes:</p>
                      {warnings.map((warning, index) => (
                        <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-sm text-orange-800">{warning}</p>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {/* Damage Percentage */}
                <div className="flex justify-between">
                  <span className="text-gray-600">Damage Percentage</span>
                  <span className="font-medium">{selectedCase.aiAssessment.damagePercentage}%</span>
                </div>

                {/* Gemini Damage Display Component */}
                <GeminiDamageDisplay
                  itemDetails={selectedCase.aiAssessment.itemDetails}
                  damagedParts={displayDamagedParts}
                  summary={selectedCase.aiAssessment.summary || selectedCase.aiAssessment.recommendation}
                  showTitle={false}
                  assetType={selectedCase.assetType}
                />

                {/* Fallback: Detected Damage (for Vision API or old data) */}
                {displayDamagedParts.length === 0 && displayDamageLabels.length > 0 && (
                  <div>
                    <p className="text-gray-600 mb-2">Detected Damage</p>
                    <div className="flex flex-wrap gap-2">
                      {displayDamageLabels.map((label, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-xl text-sm font-medium break-words"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price Override Section */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Banknote className="w-5 h-5" aria-hidden="true" />
                <span>Valuation</span>
              </h3>
              {!isEditMode && !selectedCase.approvedBy && (
                <button
                  onClick={handleEditModeToggle}
                  className="text-sm text-[var(--brand-primary)] font-medium hover:text-[var(--brand-primary-hover)]"
                >
                  ✏️ Edit Prices
                </button>
              )}
              {isEditMode && (
                <button
                  onClick={handleEditModeToggle}
                  className="text-sm text-gray-600 font-medium hover:text-gray-800"
                >
                  ✕ Cancel
                </button>
              )}
            </div>
            
            {/* Price Fields */}
            <div className="space-y-3">
              <PriceField
                label="Market Value"
                aiValue={marketValue}
                overrideValue={priceOverrides.marketValue}
                isEditMode={isEditMode}
                onChange={(value) => handlePriceChange('marketValue', value)}
                confidence={selectedCase.aiAssessment?.confidenceScore}
                pendingLabel="Pending Analysis"
                isAnalyzing={isRunningManagerAi}
              />
              
              <PriceField
                label="Estimated Salvage Value"
                aiValue={salvageValue}
                overrideValue={priceOverrides.salvageValue}
                isEditMode={isEditMode}
                onChange={(value) => handlePriceChange('salvageValue', value)}
                pendingLabel="Pending Analysis"
                isAnalyzing={isRunningManagerAi}
              />
              
              <PriceField
                label="Reserve Price"
                aiValue={reservePrice}
                overrideValue={priceOverrides.reservePrice}
                isEditMode={isEditMode}
                onChange={(value) => handlePriceChange('reservePrice', value)}
                pendingLabel="Pending Analysis"
                isAnalyzing={isRunningManagerAi}
              />
            </div>
            
            {/* Comment Field (shown in edit mode with overrides) */}
            {isEditMode && hasOverrides && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Changes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={overrideComment}
                  onChange={(e) => setOverrideComment(e.target.value)}
                  placeholder="Explain why you're adjusting these prices (minimum 10 characters)..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent"
                />
                {overrideComment.trim().length > 0 && overrideComment.trim().length < 10 && (
                  <p className="text-xs text-red-600 mt-1">
                    Comment must be at least 10 characters (currently {overrideComment.trim().length})
                  </p>
                )}
              </div>
            )}
            
            {/* Validation Errors and Warnings */}
            {(validationErrors.length > 0 || validationWarnings.length > 0) && (
              <div className="mt-4 space-y-2">
                {/* Errors */}
                {validationErrors.map((error, i) => (
                  <div key={`error-${i}`} className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                ))}
                
                {/* Warnings */}
                {validationWarnings.map((warning, i) => (
                  <div key={`warning-${i}`} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700 flex items-start">
                    <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GPS Location */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-gray-900 flex items-center">
              <span className="mr-2">📍</span>
              Location
            </h3>
              {selectedCase.status === 'pending_approval' && (
                <button
                  type="button"
                  onClick={() => void saveCaseLocation()}
                  disabled={
                    isSavingLocation ||
                    !locationName.trim() ||
                    locationName.trim() === (selectedCase.locationName ?? '').trim()
                  }
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden="true" />
                  )}
                  Save location
                </button>
              )}
            </div>
            
            {selectedCase.status === 'pending_approval' ? (
              <label className="mb-3 block">
                <span className="sr-only">Case pickup location</span>
                <input
                  value={locationName}
                  onChange={(event) => setLocationName(event.target.value)}
                  placeholder="Enter inspection or pickup location"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--brand-focus-ring)]"
                />
              </label>
            ) : (
              <p className="text-gray-700 mb-3">{selectedCase.locationName || 'Location not specified'}</p>
            )}
            
            {/* Coordinates */}
            {selectedCase.gpsLocation?.y !== undefined && selectedCase.gpsLocation?.x !== undefined && (
              <p className="text-sm text-gray-600 mb-3">
                Coordinates: {selectedCase.gpsLocation.y.toFixed(6)}, {selectedCase.gpsLocation.x.toFixed(6)}
              </p>
            )}
            
            {/* Embedded Google Map */}
            <LocationMap
              latitude={selectedCase.gpsLocation?.y}
              longitude={selectedCase.gpsLocation?.x}
              address={locationName.trim() || selectedCase.locationName}
              height="192px"
            />
          </div>

          {/* Asset Details */}
          <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="font-bold text-gray-900 mb-3">Asset Details</h3>
            <div className="space-y-2 text-sm">
              {selectedCase.assetDetails && typeof selectedCase.assetDetails === 'object' && Object.entries(selectedCase.assetDetails).map(([key, value]) => {
                if (value === undefined || value === null || value === '') return null;

                const displayValue = formatAssetDetailValue(key, value);
                
                return (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-medium">{displayValue}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Voice Notes */}
          {selectedCase.voiceNotes && selectedCase.voiceNotes.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">🎤</span>
                Voice Notes
              </h3>
              <div className="space-y-2">
                {selectedCase.voiceNotes.map((note, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auction Schedule Settings - Only show for pending approval cases */}
          {selectedCase.status === 'pending_approval' && !selectedCase.approvedBy && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                <span className="mr-2">⏰</span>
                Auction Schedule
              </h3>
              <AuctionScheduleSelector
                value={auctionSchedule}
                onChange={setAuctionSchedule}
              />
            </div>
          )}
        </div>

        {/* Approval Actions - Fixed Bottom with proper z-index and centering */}
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-lg border-t border-gray-200/50 p-4 space-y-3 z-50">
          <div className="w-full max-w-2xl mx-auto">
          {/* Check if case has already been approved */}
          {selectedCase.approvedBy ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-center text-green-800">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium">Case Already Approved</p>
                  <p className="text-sm text-green-700">
                    Approved on {selectedCase.approvedAt ? new Date(selectedCase.approvedAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          ) : selectedCase.status === 'rejected' ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center justify-center text-red-800">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <div>
                  <p className="font-medium">Case Rejected</p>
                  <p className="text-sm text-red-700">This case has been rejected</p>
                </div>
              </div>
            </div>
          ) : isEditMode ? (
            // Edit Mode Actions - Show "Approve with Changes" and "Cancel Edits"
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={handleEditModeToggle}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-200 border-2 border-gray-300 min-w-[200px] max-w-xs"
              >
                Cancel Edits
              </button>
              <button
                onClick={() => handleApprovalAction('approve')}
                disabled={!canApproveWithChanges || isSubmitting}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 min-w-[200px] max-w-xs"
              >
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
                <span>{isSubmitting ? 'Processing...' : 'Approve with Changes'}</span>
              </button>
            </div>
          ) : !approvalAction ? (
            // Normal Mode Actions - Show "Approve" and "Reject"
            <div className="flex justify-center gap-4">
              <OfflineAwareButton
                onClick={() => handleApprovalAction('reject')}
                disabled={isSubmitting}
                requiresOnline={true}
                offlineTooltip="Rejection requires internet connection"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 min-w-[140px] max-w-[200px]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
                <span>Reject</span>
              </OfflineAwareButton>
              <OfflineAwareButton
                onClick={() => handleApprovalAction('approve')}
                disabled={isSubmitting}
                requiresOnline={true}
                offlineTooltip="Approval requires internet connection"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 min-w-[140px] max-w-[200px]"
              >
                <CheckCircle className="w-5 h-5" aria-hidden="true" />
                <span>Approve</span>
              </OfflineAwareButton>
            </div>
          ) : (
            // Approval/Rejection Confirmation - Show comment field and confirm/cancel
            <>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  {approvalAction === 'approve' ? (
                    <>
                      <Check className="w-5 h-5 text-green-600" aria-hidden="true" />
                      <span>Approving Case</span>
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5 text-red-600" aria-hidden="true" />
                      <span>Rejecting Case</span>
                    </>
                  )}
                </p>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    approvalAction === 'reject'
                      ? 'Reason for rejection (required, min 10 characters)'
                      : 'Optional comment'
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--brand-focus-ring)] focus:border-transparent text-sm"
                />
              </div>
              
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    setApprovalAction(null);
                    setComment('');
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center px-8 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-200 border-2 border-gray-300 min-w-[120px] max-w-[180px]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={isSubmitting || (approvalAction === 'reject' && comment.trim().length < 10)}
                  className={`inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-semibold text-white disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 min-w-[120px] max-w-[180px] ${
                    approvalAction === 'approve'
                      ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-400'
                      : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-400'
                  }`}
                >
                  {approvalAction === 'approve' ? (
                    <CheckCircle className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <X className="w-5 h-5" aria-hidden="true" />
                  )}
                  <span>{isSubmitting ? 'Processing...' : 'Confirm'}</span>
                </button>
              </div>
            </>
          )}
          </div>
        </div>

        {/* Confirmation Modal */}
        <ConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleSubmit}
          title={getConfirmationContent().title}
          message={getConfirmationContent().message}
          confirmText={approvalAction === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
          cancelText="Cancel"
          type={approvalAction === 'approve' ? 'warning' : 'danger'}
          isLoading={isSubmitting}
        />

        {/* Result Modal */}
        <ResultModal
          isOpen={showResultModal}
          onClose={handleResultModalClose}
          type={resultModalData.type}
          title={resultModalData.title}
          message={resultModalData.message}
          details={resultModalData.details}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gray-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-[var(--brand-primary)] text-white p-4 sticky top-0 z-40 shadow-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-white hover:text-gray-200"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold">Case Approvals</h1>
          <button
            onClick={fetchPendingCases}
            className="text-white hover:text-gray-200"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <StatGrid className="p-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Pending"
          value={Array.from(new Map(allCases.map(c => [c.id, c])).values()).filter(c => c.status === 'pending_approval').length}
          valueClassName="text-yellow-600"
          icon={
            <div className="p-2 bg-yellow-100 rounded-full">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          }
          className="shadow"
        />
        <StatCard
          title="Approved"
          value={Array.from(new Map(allCases.map(c => [c.id, c])).values()).filter(c => c.approvedBy !== null && c.approvedBy !== undefined).length}
          valueClassName="text-green-600"
          icon={
            <div className="p-2 bg-green-100 rounded-full">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          }
          className="shadow"
        />
        <StatCard
          title="Rejected"
          value={Array.from(new Map(allCases.map(c => [c.id, c])).values()).filter(c => c.status === 'rejected').length}
          valueClassName="text-red-600"
          icon={
            <div className="p-2 bg-red-100 rounded-full">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          }
          className="shadow"
        />
        <StatCard
          title="Total"
          value={Array.from(new Map(allCases.map(c => [c.id, c])).values()).length}
          valueClassName="text-blue-600"
          icon={
            <div className="p-2 bg-blue-100 rounded-full">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          }
          className="shadow"
        />
      </StatGrid>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-[60px] z-30">
        <div className="flex overflow-x-auto">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setActiveTab('approved')}
            className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'approved'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setActiveTab('rejected')}
            className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rejected'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Rejected
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 min-w-[100px] px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Cases List — swipe left/right on touch to change tab */}
      <SwipeTabsBody
        tabs={APPROVAL_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="p-4"
      >
        {cases.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" aria-label="All caught up" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">All Caught Up!</h2>
            <p className="text-gray-600">
              {activeTab === 'pending' && 'No cases pending approval'}
              {activeTab === 'approved' && 'No approved cases'}
              {activeTab === 'rejected' && 'No rejected cases'}
              {activeTab === 'all' && 'No cases found'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              {cases.length} case{cases.length !== 1 ? 's' : ''} {activeTab === 'all' ? 'total' : activeTab}
            </p>
            
            <div className="space-y-4">
              {cases.map((caseData) => (
                <button
                  key={caseData.id}
                  onClick={() => handleCaseSelect(caseData)}
                  className="w-full bg-white rounded-lg shadow-md p-4 text-left hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900">{caseData.claimReference}</h3>
                      <p className="text-sm text-gray-600">{formatDate(caseData.createdAt)}</p>
                      {caseData.adjusterName && (
                        <p className="text-sm text-gray-700 mt-0.5">
                          Adjuster: <span className="font-medium">{caseData.adjusterName}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(caseData.damageSeverity)}`}>
                        {caseData.damageSeverity ? caseData.damageSeverity.toUpperCase() : 'UNKNOWN'}
                      </span>
                      {caseData.status !== 'pending_approval' && (
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(caseData).color}`}>
                          {getStatusBadge(caseData).label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-gray-600">Asset Type</p>
                      <p className="font-medium capitalize">{caseData.assetType}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Insurance Class</p>
                      <p className="font-medium">{formatInsuranceClass(caseData.insuranceClass)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Policy Number</p>
                      <p className="font-medium">{caseData.policyNumber || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Estimated Salvage Value</p>
                      <p className="font-medium">
                        {formatPendingCurrency(parseFiniteNumber(caseData.estimatedSalvageValue))}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Branch</p>
                      <p className="font-medium">{caseData.branchName || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-gray-600">
                      <span className="mr-1">🤖</span>
                      <span>AI Confidence: {caseData.aiAssessment?.confidenceScore ?? 'N/A'}%</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <span className="mr-1">📷</span>
                      <span>{caseData.photos.length} photos</span>
                    </div>
                  </div>

                  {/* Photo Preview */}
                  <div className="mt-3 flex gap-2 overflow-x-auto">
                    {caseData.photos.filter(isValidPhotoUrl).slice(0, 4).map((photo, index) => (
                      <Image
                        key={index}
                        src={photo}
                        alt={`Preview ${index + 1}`}
                        width={80}
                        height={60}
                        unoptimized={isCloudinaryImageUrl(photo)}
                        className="w-20 h-16 object-cover rounded flex-shrink-0"
                      />
                    ))}
                    {caseData.photos.filter(isValidPhotoUrl).length === 0 && (
                      <div className="w-20 h-16 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center text-xs text-gray-400">
                        No photos
                      </div>
                    )}
                    {caseData.photos.filter(isValidPhotoUrl).length > 4 && (
                      <div className="w-20 h-16 bg-gray-200 rounded flex items-center justify-center flex-shrink-0 text-sm text-gray-600">
                        +{caseData.photos.filter(isValidPhotoUrl).length - 4}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </SwipeTabsBody>
    </div>
  );
}
