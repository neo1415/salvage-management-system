/**
 * Mobile Case Creation Page
 * 
 * Mobile-optimized form for Claims Adjusters to create salvage cases from accident sites.
 * Features:
 * - React Hook Form + Zod validation
 * - Mobile camera upload (3-10 photos)
 * - GPS auto-capture
 * - Web Speech API for voice-to-text notes
 * - Offline support with IndexedDB
 * - AI assessment results display
 * 
 * Requirements: 12, 13, NFR5.3, Enterprise Standards Section 9.1
 */

'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOffline } from '@/hooks/use-offline';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { saveOfflineCase } from '@/lib/db/indexeddb';
import { getAccurateGeolocation, type GeolocationError } from '@/lib/integrations/google-geolocation';
import { useToast } from '@/components/ui/toast';
import { getQualityTiers } from '@/features/valuations/services/condition-mapping.service';
import { SearchProgressIndicator, useSearchProgress, type SearchProgress } from '@/components/ui/search-progress-indicator';
import { UnifiedVoiceField, useUnifiedVoiceContent } from '@/components/ui/unified-voice-field';
import { ModernVoiceControls } from '@/components/ui/modern-voice-controls';
import { ResponsiveFormLayout, FormSection, FormField, ModernInput, ModernButton } from '@/components/ui/responsive-form-layout';
import { cn } from '@/lib/utils';
import { useDraftAutoSave } from '@/hooks/use-draft-auto-save';
import { DraftList } from '@/components/cases/draft-list';
import { AIAnalysisStatusBadge } from '@/components/cases/ai-analysis-status-badge';

/**
 * Web Speech API types (not fully supported in TypeScript)
 */
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

/**
 * Asset type options - Universal item types supported by internet search
 */
const ASSET_TYPES = [
  { value: 'vehicle', label: 'Vehicle', icon: '🚗' },
  { value: 'electronics', label: 'Electronics', icon: '📱' },
  { value: 'appliance', label: 'Appliance', icon: '🏠' },
  { value: 'property', label: 'Property', icon: '🏢' },
  { value: 'jewelry', label: 'Jewelry & Watches', icon: '💎' },
  { value: 'furniture', label: 'Furniture', icon: '🪑' },
  { value: 'machinery', label: 'Machinery & Equipment', icon: '⚙️' },
] as const;

/**
 * Validation schema - Updated for universal item types
 */
const caseFormSchema = z.object({
  claimReference: z.string().min(1, 'Claim reference is required'),
  assetType: z.enum(['vehicle', 'property', 'electronics', 'appliance', 'jewelry', 'furniture', 'machinery']).refine((val) => val !== undefined, {
    message: 'Asset type is required',
  }),
  marketValue: z.preprocess(
    (val) => {
      // Handle NaN, null, undefined, empty string
      if (val === null || val === undefined || val === '' || (typeof val === 'number' && isNaN(val))) {
        return undefined;
      }
      return val;
    },
    z.number().positive('Market value must be positive').optional()
  ),
  
  // Vehicle-specific fields
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.number().optional(),
  vehicleVin: z.string().optional(),
  vehicleMileage: z.number().positive('Mileage must be positive').optional(),
  vehicleCondition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  
  // Property-specific fields
  propertyType: z.string().optional(),
  propertyAddress: z.string().optional(),
  
  // Electronics-specific fields
  electronicsBrand: z.string().optional(),
  electronicsModel: z.string().optional(),
  electronicsSerialNumber: z.string().optional(),
  electronicsStorage: z.string().optional(),
  electronicsColor: z.string().optional(),
  
  // Appliance-specific fields
  applianceBrand: z.string().optional(),
  applianceModel: z.string().optional(),
  applianceSize: z.string().optional(),
  applianceType: z.string().optional(),
  
  // Jewelry-specific fields
  jewelryBrand: z.string().optional(),
  jewelryType: z.string().optional(),
  jewelryMaterial: z.string().optional(),
  jewelryWeight: z.string().optional(),
  
  // Furniture-specific fields
  furnitureBrand: z.string().optional(),
  furnitureType: z.string().optional(),
  furnitureMaterial: z.string().optional(),
  furnitureSize: z.string().optional(),
  
  // Machinery-specific fields
  machineryBrand: z.string().optional(),
  machineryModel: z.string().optional(),
  machineryType: z.string().optional(),
  machineryYear: z.number().optional(),
  
  // Universal condition field
  itemCondition: z.enum(['Brand New', 'Foreign Used (Tokunbo)', 'Nigerian Used', 'Heavily Used']).optional(),
  
  // Common fields
  photos: z.array(z.string()).min(3, 'At least 3 photos required').max(10, 'Maximum 10 photos allowed'),
  locationName: z.string().min(1, 'Location name is required'),
  unifiedVoiceContent: z.string().optional(),
}).refine((data) => {
  // Validate vehicle-specific fields
  if (data.assetType === 'vehicle') {
    return data.vehicleMake && data.vehicleModel && data.vehicleYear;
  }
  // Validate property-specific fields
  if (data.assetType === 'property') {
    return data.propertyType && data.propertyAddress;
  }
  // Validate electronics-specific fields
  if (data.assetType === 'electronics') {
    return data.electronicsBrand && data.electronicsModel;
  }
  // Validate appliance-specific fields
  if (data.assetType === 'appliance') {
    return data.applianceBrand && data.applianceModel;
  }
  // Validate jewelry-specific fields
  if (data.assetType === 'jewelry') {
    return data.jewelryType;
  }
  // Validate furniture-specific fields
  if (data.assetType === 'furniture') {
    return data.furnitureType;
  }
  // Validate machinery-specific fields
  if (data.assetType === 'machinery') {
    return data.machineryBrand && data.machineryType;
  }
  return true;
}, {
  message: 'Please fill in all required fields for the selected asset type',
  path: ['assetType'],
});

type CaseFormData = z.infer<typeof caseFormSchema>;

/**
 * GPS coordinates
 */
interface GeoLocation {
  latitude: number;
  longitude: number;
}

/**
 * AI Assessment result - COMPLETE structure from API
 */
interface AIAssessmentResult {
  damageSeverity: 'minor' | 'moderate' | 'severe';
  confidenceScore: number;
  labels: string[];
  estimatedSalvageValue: number;
  reservePrice: number;
  marketValue?: number;
  estimatedRepairCost?: number;
  damagePercentage?: number;
  isRepairable?: boolean;
  recommendation?: string;
  warnings?: string[];
  confidence?: {
    overall: number;
    vehicleDetection: number;
    damageDetection: number;
    valuationAccuracy: number;
    photoQuality: number;
    reasons: string[];
  };
  damageScore?: {
    structural: number;
    mechanical: number;
    cosmetic: number;
    electrical: number;
    interior: number;
  };
  analysisMethod?: 'gemini' | 'vision' | 'neutral' | 'mock';
  qualityTier?: string;
}

function NewCasePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOffline = useOffline();
  const { pendingCount } = useOfflineSync();
  const toast = useToast();
  
  // Form state
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CaseFormData>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      photos: [],
      unifiedVoiceContent: '',
      marketValue: undefined, // Explicitly set to undefined to avoid NaN
    },
  });

  const assetType = watch('assetType');
  const photos = watch('photos');
  const vehicleMileage = watch('vehicleMileage');
  const vehicleCondition = watch('vehicleCondition');
  const vehicleMake = watch('vehicleMake');
  const vehicleModel = watch('vehicleModel');
  const vehicleYear = watch('vehicleYear');
  
  // Unified voice content management
  const {
    content: voiceContent,
    appendVoiceNote,
    updateContent: updateVoiceContent,
    wordCount: voiceWordCount,
    characterCount: voiceCharacterCount,
  } = useUnifiedVoiceContent(watch('unifiedVoiceContent') || '');
  
  // Voice recording state
  const [interimTranscript, setInterimTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // UI state
  const [gpsLocation, setGpsLocation] = useState<GeoLocation | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [aiAssessment, setAiAssessment] = useState<AIAssessmentResult | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [mileageWarning, setMileageWarning] = useState<string | null>(null);
  const [formStateRestored, setFormStateRestored] = useState(false);
  
  // CRITICAL FIX: Track if user has attempted to submit
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  
  // Separate loading states for draft vs submit buttons
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmittingForApproval, setIsSubmittingForApproval] = useState(false);
  
  // Rate limiting state for AI assessment
  const [lastAnalysisTimes, setLastAnalysisTimes] = useState<number[]>([]);
  const [rateLimitError, setRateLimitError] = useState<string | null>(null);
  
  // Search progress state
  const {
    progress: searchProgress,
    startMarketSearch,
    startAIProcessing,
    startPartSearch,
    setComplete,
    setError,
    updateProgress,
    reset: resetSearchProgress,
  } = useSearchProgress();
  
  // Draft list visibility state
  const [showDraftList, setShowDraftList] = useState(false);
  
  // Watch all form fields - pass directly to useDraftAutoSave without memoization
  // The hook will handle its own memoization internally
  const formData = watch();
  const marketValue = watch('marketValue');
  const hasAIAnalysis = !!aiAssessment;
  
  const {
    currentDraftId,
    isSaving: isDraftSaving,
    lastSaved: draftLastSaved,
    saveDraft: saveDraftManually,
    loadDraft,
    drafts,
    deleteDraft,
    canSubmit: canSubmitDraft,
    validationErrors: draftValidationErrors,
    refreshDrafts,
  } = useDraftAutoSave(formData, hasAIAnalysis, marketValue, {
    enabled: true,
    interval: 30000, // 30 seconds
    onSave: (draft) => {
      console.log('Draft auto-saved:', draft.id);
    },
    onError: (error) => {
      console.error('Draft save failed:', error);
      toast.error('Draft save failed', error.message);
    },
  });
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mileageDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Form state persistence key
  const FORM_STATE_KEY = 'case-creation-form-state';

  /**
   * Auto-capture GPS location on mount
   */
  useEffect(() => {
    captureGPSLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load draft from URL parameter if present
   */
  useEffect(() => {
    const draftId = searchParams.get('draftId');
    if (draftId && !formStateRestored) {
      loadDraft(draftId).then(async () => {
        // Load the draft data from IndexedDB
        const { getDraft } = await import('@/lib/db/indexeddb');
        const draft = await getDraft(draftId);
        
        if (draft) {
          // Populate form fields from draft
          Object.keys(draft.formData).forEach((key) => {
            const value = draft.formData[key];
            if (value !== undefined && value !== null) {
              setValue(key as any, value);
            }
          });
          
          // Restore AI assessment if present
          if (draft.hasAIAnalysis && draft.marketValue) {
            setAiAssessment({
              damageSeverity: 'moderate',
              confidenceScore: 0.85,
              labels: [],
              estimatedSalvageValue: draft.marketValue * 0.7,
              reservePrice: draft.marketValue * 0.7 * 0.7,
              marketValue: draft.marketValue,
            } as AIAssessmentResult);
          }
          
          toast.success('Draft loaded', 'Continue editing your case');
        }
      }).catch((error) => {
        console.error('Failed to load draft:', error);
        toast.error('Failed to load draft', 'The draft may have been deleted');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /**
   * Restore form state from sessionStorage on mount
   * Requirement 10.5: Form state persistence
   */
  useEffect(() => {
    if (formStateRestored) return; // Only restore once
    
    try {
      const savedState = sessionStorage.getItem(FORM_STATE_KEY);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Restore vehicle autocomplete selections
        if (parsedState.vehicleMake) {
          setValue('vehicleMake', parsedState.vehicleMake);
        }
        if (parsedState.vehicleModel) {
          setValue('vehicleModel', parsedState.vehicleModel);
        }
        if (parsedState.vehicleYear !== undefined && parsedState.vehicleYear !== null) {
          setValue('vehicleYear', parsedState.vehicleYear);
        }
        
        // Restore mileage if present
        if (parsedState.vehicleMileage !== undefined && parsedState.vehicleMileage !== null) {
          setValue('vehicleMileage', parsedState.vehicleMileage);
        }
        
        // Restore condition if present
        if (parsedState.vehicleCondition) {
          setValue('vehicleCondition', parsedState.vehicleCondition);
        }
        
        console.log('Form state restored from sessionStorage:', parsedState);
      }
    } catch (error) {
      console.error('Failed to restore form state:', error);
    } finally {
      setFormStateRestored(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Initialize Web Speech API
   */
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognitionConstructor = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognitionConstructor();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
    }
  }, []);

  /**
   * Save form state to sessionStorage when vehicle fields, mileage, or condition changes
   * Requirement 10.5: Form state persistence
   */
  useEffect(() => {
    // Don't save until initial restore is complete
    if (!formStateRestored) return;
    
    // Only save if at least one field has a value
    if (vehicleMake || vehicleModel || vehicleYear !== undefined || vehicleMileage !== undefined || vehicleCondition !== undefined) {
      try {
        const stateToSave = {
          vehicleMake: vehicleMake || null,
          vehicleModel: vehicleModel || null,
          vehicleYear: vehicleYear || null,
          vehicleMileage: vehicleMileage || null,
          vehicleCondition: vehicleCondition || null,
          timestamp: new Date().toISOString(),
        };
        
        sessionStorage.setItem(FORM_STATE_KEY, JSON.stringify(stateToSave));
        console.log('Form state saved to sessionStorage:', stateToSave);
      } catch (error) {
        console.error('Failed to save form state:', error);
      }
    }
  }, [vehicleMake, vehicleModel, vehicleYear, vehicleMileage, vehicleCondition, formStateRestored]);

  /**
   * Sync unified voice content with form field
   * FIXED: Only update if the values are actually different to prevent infinite loop
   */
  useEffect(() => {
    const currentValue = watch('unifiedVoiceContent');
    if (currentValue !== voiceContent) {
      setValue('unifiedVoiceContent', voiceContent, { shouldDirty: false, shouldTouch: false });
    }
  }, [voiceContent, setValue, watch]);

  /**
   * Debounced mileage validation
   * - Validates positive numbers only
   * - Shows warning for unrealistic values (>500,000 km)
   * - Debounces validation (300ms)
   */
  useEffect(() => {
    // Clear previous timeout
    if (mileageDebounceRef.current) {
      clearTimeout(mileageDebounceRef.current);
    }

    // Only validate if mileage is provided
    if (vehicleMileage === undefined || vehicleMileage === null) {
      setMileageWarning(null);
      return;
    }

    // Debounce validation by 300ms
    mileageDebounceRef.current = setTimeout(() => {
      // Check for unrealistic values
      if (vehicleMileage > 500000) {
        setMileageWarning('⚠️ Unusually high mileage - please verify');
      } else {
        setMileageWarning(null);
      }
    }, 300);

    // Cleanup on unmount
    return () => {
      if (mileageDebounceRef.current) {
        clearTimeout(mileageDebounceRef.current);
      }
    };
  }, [vehicleMileage]);

  /**
   * Capture GPS location using hybrid approach
   * - When online: Uses Google Maps Geolocation API (accurate)
   * - When offline: Falls back to browser geolocation
   * - When offline and GPS fails: Shows optional message
   */
  const captureGPSLocation = async () => {
    if (!navigator.geolocation) {
      const errorMsg = isOffline 
        ? 'Geolocation not supported. GPS is optional when offline - you can submit without it.'
        : 'Geolocation is not supported by your browser';
      setGpsError(errorMsg);
      return;
    }

    setIsCapturingGPS(true);
    setGpsError(null);

    try {
      // Use hybrid geolocation service (Google API + browser fallback)
      const result = await getAccurateGeolocation();

      const location: GeoLocation = {
        latitude: result.latitude,
        longitude: result.longitude,
      };

      setGpsLocation(location);
      
      // Set location name (already includes reverse geocoding)
      setValue('locationName', result.locationName || `${result.latitude.toFixed(6)}, ${result.longitude.toFixed(6)}`);

      // Log accuracy for debugging
      console.log(`GPS captured via ${result.source}, accuracy: ${result.accuracy}m`);
    } catch (error) {
      console.error('GPS capture error:', error);
      
      // Handle GeolocationError from our service
      if (error && typeof error === 'object' && 'code' in error) {
        const geoError = error as GeolocationError;
        const errorMsg = isOffline 
          ? `${geoError.message} GPS is optional when offline - you can submit without it.`
          : geoError.message;
        setGpsError(errorMsg);
      } else {
        const errorMsg = isOffline
          ? 'Failed to capture GPS location. GPS is optional when offline - you can submit without it.'
          : 'Failed to capture GPS location. Please try again.';
        setGpsError(errorMsg);
      }
    } finally {
      setIsCapturingGPS(false);
    }
  };

  /**
   * Check if we should run AI assessment
   * Requirements:
   * - Online (not offline)
   * - At least 3 photos
   * - For vehicles: must have make, model, and year
   * - For electronics: must have brand and model
   * - For appliances: must have brand and model
   * - For jewelry: must have type
   * - For furniture: must have type
   * - For machinery: must have brand and type
   * - For property: no additional requirements (photos are sufficient)
   */
  const shouldRunAIAssessment = (): boolean => {
    if (isOffline) return false;
    
    const currentPhotos = watch('photos') || [];
    if (currentPhotos.length < 3) return false;
    
    const currentAssetType = watch('assetType');
    
    // Check requirements based on asset type
    switch (currentAssetType) {
      case 'vehicle':
        const make = watch('vehicleMake');
        const model = watch('vehicleModel');
        const year = watch('vehicleYear');
        return !!(make && model && year);
        
      case 'electronics':
        const electronicsBrand = watch('electronicsBrand');
        const electronicsModel = watch('electronicsModel');
        return !!(electronicsBrand && electronicsModel);
        
      case 'appliance':
        const applianceBrand = watch('applianceBrand');
        const applianceModel = watch('applianceModel');
        return !!(applianceBrand && applianceModel);
        
      case 'jewelry':
        const jewelryType = watch('jewelryType');
        return !!jewelryType;
        
      case 'furniture':
        const furnitureType = watch('furnitureType');
        return !!furnitureType;
        
      case 'machinery':
        const machineryBrand = watch('machineryBrand');
        const machineryType = watch('machineryType');
        return !!(machineryBrand && machineryType);
        
      case 'property':
        // Property only needs photos for AI assessment
        return true;
        
      default:
        return false;
    }
  };

  /**
   * Handle photo upload
   * CHANGED: No longer auto-triggers AI assessment
   * User must click "Analyze Photos" button manually
   */
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    console.log('📸 Processing', files.length, 'new photos');
    const newPhotos: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo too large', `${file.name} exceeds 5MB limit`);
        continue;
      }

      // Convert to base64
      const base64 = await fileToBase64(file);
      newPhotos.push(base64);
    }

    const currentPhotos = photos || [];
    const updatedPhotos = [...currentPhotos, ...newPhotos].slice(0, 10);
    setValue('photos', updatedPhotos);

    console.log('📸 Total photos now:', updatedPhotos.length);
    
    // REMOVED: Auto-trigger AI assessment
    // User must now click "Analyze Photos" button manually
  };

  /**
   * Check if rate limit is exceeded
   * Max 5 AI assessments per minute
   * Returns: { allowed: boolean, waitTime: number (seconds) }
   */
  const checkRateLimit = (): { allowed: boolean; waitTime: number } => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000; // 60 seconds
    
    // Filter out timestamps older than 1 minute
    const recentAnalyses = lastAnalysisTimes.filter(time => time > oneMinuteAgo);
    
    if (recentAnalyses.length >= 5) {
      // Calculate wait time until oldest request expires
      const oldestRequest = Math.min(...recentAnalyses);
      const waitTime = Math.ceil((oldestRequest + 60000 - now) / 1000);
      return { allowed: false, waitTime };
    }
    
    return { allowed: true, waitTime: 0 };
  };

  /**
   * Run AI assessment on uploaded photos
   * NOW USES ENHANCED SERVICE with universal item context and market data
   * Only runs when online - offline cases will be processed when synced
   * Shows progress indicators for internet search operations
   * 
   * CRITICAL: This function includes duplicate call prevention to avoid race conditions
   * UPDATED: Now called manually by user clicking "Analyze Photos" button
   */
  const runAIAssessment = async (photosToAssess: string[]) => {
    // CRITICAL: Check rate limit first
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      const errorMsg = `⚠️ Analysis limit reached. Please wait ${rateCheck.waitTime} seconds before analyzing again.`;
      setRateLimitError(errorMsg);
      toast.warning('Rate limit exceeded', errorMsg);
      return;
    }
    
    // Clear any previous rate limit error
    setRateLimitError(null);
    
    // CRITICAL: Prevent duplicate calls - check if already processing OR if we already have results
    if (isProcessingAI || isOffline) {
      console.log('⚠️ AI assessment skipped:', { isProcessingAI, isOffline, hasResults: !!aiAssessment });
      return;
    }
    
    console.log('✅ Starting AI assessment for', photosToAssess.length, 'photos');
    setIsProcessingAI(true);
    setAiAssessment(null); // Clear previous results
    resetSearchProgress(); // Reset any previous search progress
    
    // Update rate limit tracking
    const now = Date.now();
    setLastAnalysisTimes(prev => [...prev.filter(time => time > now - 60000), now]);
    
    try {
      // Build item info object based on asset type
      let itemInfo: any = {
        assetType: assetType,
      };

      switch (assetType) {
        case 'vehicle':
          itemInfo = {
            ...itemInfo,
            make: watch('vehicleMake'),
            model: watch('vehicleModel'),
            year: watch('vehicleYear'),
            vin: watch('vehicleVin'),
            mileage: watch('vehicleMileage'),
            condition: watch('vehicleCondition'),
          };
          break;
          
        case 'electronics':
          itemInfo = {
            ...itemInfo,
            brand: watch('electronicsBrand'),
            model: watch('electronicsModel'),
            storage: watch('electronicsStorage'),
            color: watch('electronicsColor'),
            condition: watch('itemCondition'),
          };
          break;
          
        case 'appliance':
          itemInfo = {
            ...itemInfo,
            brand: watch('applianceBrand'),
            model: watch('applianceModel'),
            type: watch('applianceType'),
            size: watch('applianceSize'),
            condition: watch('itemCondition'),
          };
          break;
          
        case 'jewelry':
          itemInfo = {
            ...itemInfo,
            type: watch('jewelryType'),
            brand: watch('jewelryBrand'),
            material: watch('jewelryMaterial'),
            weight: watch('jewelryWeight'),
            condition: watch('itemCondition'),
          };
          break;
          
        case 'furniture':
          itemInfo = {
            ...itemInfo,
            type: watch('furnitureType'),
            brand: watch('furnitureBrand'),
            material: watch('furnitureMaterial'),
            size: watch('furnitureSize'),
            condition: watch('itemCondition'),
          };
          break;
          
        case 'machinery':
          itemInfo = {
            ...itemInfo,
            brand: watch('machineryBrand'),
            type: watch('machineryType'),
            model: watch('machineryModel'),
            year: watch('machineryYear'),
            condition: watch('itemCondition'),
          };
          break;
          
        case 'property':
          itemInfo = {
            ...itemInfo,
            propertyType: watch('propertyType'),
            address: watch('propertyAddress'),
          };
          break;
      }

      console.log('Calling AI assessment API with item info:', itemInfo);

      // Start AI processing progress
      startAIProcessing();
      updateProgress({ progress: 10 });

      // Simulate market search progress (the API handles this internally)
      const searchQuery = assetType === 'vehicle' 
        ? `${itemInfo.make} ${itemInfo.model} ${itemInfo.year} ${itemInfo.condition || 'used'} price Nigeria`
        : `${itemInfo.brand || itemInfo.type} ${itemInfo.model || ''} ${itemInfo.condition || 'used'} price Nigeria`;
      
      startMarketSearch(searchQuery);
      updateProgress({ progress: 30 });

      // Simulate progress updates during API call
      const progressInterval = setInterval(() => {
        updateProgress({
          progress: Math.min(90, (searchProgress.progress || 0) + 10)
        });
      }, 1000);

      const response = await fetch('/api/cases/ai-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photos: photosToAssess,
          itemInfo, // Updated from vehicleInfo to itemInfo
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI assessment failed');
      }

      const result = await response.json();
      
      // Set AI assessment results - STORE COMPLETE STRUCTURE
      if (result.data) {
        const assessment: AIAssessmentResult = {
          damageSeverity: result.data.damageSeverity,
          confidenceScore: result.data.confidenceScore,
          labels: result.data.labels,
          estimatedSalvageValue: result.data.estimatedSalvageValue,
          reservePrice: result.data.reservePrice,
          // CRITICAL: Store ALL fields from API response
          marketValue: result.data.marketValue,
          estimatedRepairCost: result.data.estimatedRepairCost,
          damagePercentage: result.data.damagePercentage,
          isRepairable: result.data.isRepairable,
          recommendation: result.data.recommendation,
          warnings: result.data.warnings,
          confidence: result.data.confidence,
          damageScore: result.data.damageScore,
          analysisMethod: result.data.analysisMethod,
          qualityTier: result.data.qualityTier,
        };
        
        console.log('🎯 COMPLETE AI assessment stored:', assessment);
        setAiAssessment(assessment);
        
        // Auto-fill market value with the REAL market value from enhanced service
        setValue('marketValue', result.data.marketValue || result.data.estimatedSalvageValue);
        
        // Show completion with confidence and data source
        setComplete(
          result.data.confidenceScore,
          result.data.dataSource || 'internet'
        );
        
        console.log('AI Assessment Complete:', assessment);
        console.log('Market value set to:', result.data.marketValue);

        // Auto-hide progress after 3 seconds
        setTimeout(() => {
          resetSearchProgress();
        }, 3000);
      }
    } catch (error) {
      console.error('AI assessment error:', error);
      const errorMessage = error instanceof Error ? error.message : 'AI assessment failed';
      setError(errorMessage);
      toast.warning('AI assessment failed', 'You can still submit the form manually.');
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        resetSearchProgress();
      }, 5000);
    } finally {
      setIsProcessingAI(false);
    }
  };

  /**
   * Convert file to base64
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  /**
   * Remove photo
   */
  const removePhoto = (index: number) => {
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setValue('photos', updatedPhotos);
  };

  /**
   * Start voice recording
   */
  const startVoiceRecording = async () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition not supported', 'Please use Chrome, Edge, or Safari.');
      return;
    }

    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('Microphone permission denied:', error);
      toast.error('Microphone access denied', 'Please enable microphone permissions in your browser settings.');
      return;
    }

    setIsRecording(true);
    setRecordingDuration(0);
    
    // Start timer
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
    
    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Update interim results for real-time feedback
      setInterimTranscript(interimTranscript);
      
      // Only append final results to avoid duplicates
      if (finalTranscript) {
        const newContent = appendVoiceNote(finalTranscript, true);
        // Update the form field with the new unified content immediately
        setValue('unifiedVoiceContent', newContent);
        // Clear interim transcript after final result
        setInterimTranscript('');
      }
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      stopVoiceRecording();
      setInterimTranscript(''); // Clear any interim results on error
      
      // Provide user-friendly error messages
      switch (event.error) {
        case 'not-allowed':
          toast.error('Microphone access denied', 'Please enable microphone permissions in your browser settings.');
          break;
        case 'no-speech':
          toast.warning('No speech detected', 'Please try again.');
          break;
        case 'network':
          toast.error('Network error', 'Please check your internet connection.');
          break;
        default:
          toast.error('Voice recording failed', `Error: ${event.error}`);
      }
    };

    try {
      recognitionRef.current.start();
      console.log('Voice recognition started successfully');
    } catch (error) {
      console.error('Failed to start recognition:', error);
      stopVoiceRecording();
      toast.error('Failed to start voice recording', 'Please try again.');
    }
  };

  /**
   * Stop voice recording - Fixed to ensure proper stopping
   */
  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('Voice recognition stopped successfully');
      } catch (error) {
        console.error('Error stopping voice recognition:', error);
      }
    }
    
    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    setIsRecording(false);
    setInterimTranscript(''); // Clear any interim results
  };

  /**
   * Pause voice recording (same as stop for Web Speech API)
   */
  const pauseVoiceRecording = () => {
    stopVoiceRecording();
  };
  
  /**
   * Cleanup timer on unmount
   */
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  /**
   * Handle resuming a draft
   */
  const handleResumeDraft = async (draft: typeof drafts[0]) => {
    try {
      // Load the draft
      await loadDraft(draft.id);
      
      // Populate form fields
      Object.keys(draft.formData).forEach((key) => {
        const value = draft.formData[key];
        if (value !== undefined && value !== null) {
          setValue(key as keyof CaseFormData, value as any);
        }
      });
      
      // Restore AI assessment if available
      if (draft.hasAIAnalysis && draft.marketValue) {
        // Note: We don't have the full AI assessment stored in the draft
        // So we just restore the market value
        setValue('marketValue', draft.marketValue);
      }
      
      // Close the draft list
      setShowDraftList(false);
      
      toast.success('Draft loaded', 'Continue editing your case');
    } catch (error) {
      console.error('Failed to resume draft:', error);
      toast.error('Failed to load draft', 'Please try again');
    }
  };

  /**
   * Save draft without validation
   * Allows saving incomplete forms for later completion
   */
  const saveDraftDirectly = async () => {
    setIsSavingDraft(true);
    
    try {
      const formData = watch(); // Get all current form values
      
      // Save to IndexedDB via draft service
      await saveDraftManually();
      
      toast.success('Draft saved', 'You can continue editing later.');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSavingDraft(false);
    }
  };

  /**
   * Submit form
   * CRITICAL: AI assessment already runs in real-time during photo upload (line ~380)
   * This function just saves the case with the AI results already captured
   * The backend will NOT re-run AI assessment to avoid duplicate processing
   */
  const onSubmit = async (data: CaseFormData, isDraft: boolean = false) => {
    console.log('📝 Form submission started:', { isDraft, hasAIResults: !!aiAssessment, marketValue: data.marketValue });
    
    // CRITICAL FIX: Mark that user has attempted to submit
    setHasAttemptedSubmit(true);
    
    // CRITICAL: Prevent submission while AI is processing
    if (isProcessingAI || searchProgress.stage !== 'idle') {
      console.log('⚠️ Form submission blocked: AI assessment still in progress');
      toast.warning('Please wait', 'AI assessment is still processing...');
      return;
    }
    
    // Set appropriate loading state based on button clicked
    if (isDraft) {
      setIsSavingDraft(true);
    } else {
      setIsSubmittingForApproval(true);
    }
    
    try {
      // Market value is required for submission but not for draft saves
      if (isDraft === false && (!data.marketValue || data.marketValue <= 0)) {
        toast.error('Market value required', 'Please complete AI analysis to determine market value before submitting.');
        setIsSubmittingForApproval(false);
        return;
      }

      // When offline, GPS is optional - allow submission without it
      if (!gpsLocation && !isOffline) {
        toast.error('GPS location required', 'Please allow location access or go offline to skip GPS.');
        return;
      }

      // Prepare asset details based on type
      let assetDetails: Record<string, string | number | undefined> = {};
      
      if (data.assetType === 'vehicle') {
        assetDetails = {
          make: data.vehicleMake,
          model: data.vehicleModel,
          year: data.vehicleYear,
          vin: data.vehicleVin,
          mileage: data.vehicleMileage,
          condition: data.vehicleCondition,
        };
      } else if (data.assetType === 'property') {
        assetDetails = {
          propertyType: data.propertyType,
          address: data.propertyAddress,
        };
      } else if (data.assetType === 'electronics') {
        assetDetails = {
          brand: data.electronicsBrand,
          model: data.electronicsModel,
          storage: data.electronicsStorage,
          color: data.electronicsColor,
          serialNumber: data.electronicsSerialNumber,
          condition: data.itemCondition,
        };
      } else if (data.assetType === 'appliance') {
        assetDetails = {
          brand: data.applianceBrand,
          model: data.applianceModel,
          type: data.applianceType,
          size: data.applianceSize,
          condition: data.itemCondition,
        };
      } else if (data.assetType === 'jewelry') {
        assetDetails = {
          type: data.jewelryType,
          brand: data.jewelryBrand,
          material: data.jewelryMaterial,
          weight: data.jewelryWeight,
          condition: data.itemCondition,
        };
      } else if (data.assetType === 'furniture') {
        assetDetails = {
          type: data.furnitureType,
          brand: data.furnitureBrand,
          material: data.furnitureMaterial,
          size: data.furnitureSize,
          condition: data.itemCondition,
        };
      } else if (data.assetType === 'machinery') {
        assetDetails = {
          brand: data.machineryBrand,
          type: data.machineryType,
          model: data.machineryModel,
          year: data.machineryYear,
          condition: data.itemCondition,
        };
      }

      const caseData = {
        claimReference: data.claimReference,
        assetType: data.assetType,
        assetDetails,
        marketValue: data.marketValue,
        photos: data.photos,
        gpsLocation: gpsLocation || undefined, // Optional when offline
        locationName: data.locationName || (isOffline ? 'Location unavailable (offline)' : 'Unknown location'),
        // FIXED: Convert unified voice content to voiceNotes array for backend
        voiceNotes: data.unifiedVoiceContent ? [data.unifiedVoiceContent] : [],
        status: isDraft ? 'draft' as const : 'pending_approval' as const,
        // CRITICAL FIX: Pass COMPLETE AI assessment results from frontend to backend
        aiAssessmentResult: aiAssessment ? {
          damageSeverity: aiAssessment.damageSeverity,
          confidenceScore: aiAssessment.confidenceScore,
          labels: aiAssessment.labels,
          estimatedSalvageValue: aiAssessment.estimatedSalvageValue,
          reservePrice: aiAssessment.reservePrice,
          // Include ALL additional fields
          marketValue: aiAssessment.marketValue,
          estimatedRepairCost: aiAssessment.estimatedRepairCost,
          damagePercentage: aiAssessment.damagePercentage,
          isRepairable: aiAssessment.isRepairable,
          recommendation: aiAssessment.recommendation,
          warnings: aiAssessment.warnings,
          confidence: aiAssessment.confidence,
          damageScore: aiAssessment.damageScore,
          analysisMethod: aiAssessment.analysisMethod,
          qualityTier: aiAssessment.qualityTier,
        } : undefined,
      };
      
      console.log('📤 Sending case data to backend with AI assessment:', {
        hasSeverity: !!aiAssessment?.damageSeverity,
        severity: aiAssessment?.damageSeverity,
        confidence: aiAssessment?.confidenceScore,
      });

      if (isOffline) {
        // Save to IndexedDB for offline sync
        await saveOfflineCase({
          ...caseData,
          createdBy: 'current-user-id', // TODO: Get from session
          syncStatus: 'pending',
        });
        
        // Clear form state from sessionStorage on successful submission
        sessionStorage.removeItem(FORM_STATE_KEY);
        
        // Clear the current draft after successful submission
        if (currentDraftId && !isDraft) {
          await deleteDraft(currentDraftId);
        }
        
        toast.success('Case saved offline', 'It will be synced when connection is restored.');
        router.push('/adjuster/my-cases');
      } else {
        // Submit to API (AI assessment already completed during photo upload)
        const response = await fetch('/api/cases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(caseData),
        });

        if (!response.ok) {
          const error = await response.json();
          
          // Handle specific validation errors
          if (error.errors && Array.isArray(error.errors)) {
            const errorMessages = error.errors.join(', ');
            
            // Check for duplicate claim reference error
            if (errorMessages.includes('Claim reference must be unique')) {
              throw new Error(`Claim reference "${data.claimReference}" already exists. Please use a different claim reference.`);
            }
            
            throw new Error(errorMessages);
          }
          
          throw new Error(error.error || 'Failed to create case');
        }

        // Clear form state from sessionStorage on successful submission
        sessionStorage.removeItem(FORM_STATE_KEY);

        // Clear the current draft after successful submission
        if (currentDraftId && !isDraft) {
          await deleteDraft(currentDraftId);
        }

        toast.success(
          isDraft ? 'Case saved as draft' : 'Case submitted for approval',
          isDraft ? 'You can continue editing later.' : 'Manager will review your submission.'
        );
        router.push('/adjuster/my-cases');
      }
    } catch (error) {
      console.error('Error submitting case:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit case';
      toast.error('Submission failed', errorMessage);
    } finally {
      // Clear the appropriate loading state
      if (isDraft) {
        setIsSavingDraft(false);
      } else {
        setIsSubmittingForApproval(false);
      }
    }
  };

  return (
    <ResponsiveFormLayout
      variant="auto"
      spacing="comfortable"
      theme="auto"
      voiceButtonPosition="sticky"
      enableVoiceOptimization={true}
      className="min-h-screen"
    >
      {/* Modern Header with Glassmorphism - Fixed positioning */}
      <div className="bg-gradient-to-r from-[#800020] via-[#a0002a] to-[#800020] text-white sticky top-0 z-20 backdrop-blur-lg shadow-2xl shadow-[#800020]/20 border-b border-white/10">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="!text-white !bg-white/10 hover:!bg-white/20 !border-white/20 hover:!border-white/30 transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </ModernButton>
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">
                Create Salvage Case
              </h1>
            </div>
            <div className="w-20" /> {/* Spacer */}
          </div>
        </div>
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 pointer-events-none" />
      </div>

      {/* Modern Offline Indicator with Enhanced Design */}
      {isOffline && (
        <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/50 rounded-2xl shadow-lg backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">You're offline</h3>
              <p className="text-sm text-amber-700 mt-1">
                Changes will sync automatically when connection is restored.
                {pendingCount > 0 && (
                  <span className="inline-flex items-center ml-2 px-2 py-1 bg-amber-200 text-amber-800 text-xs font-medium rounded-full">
                    {pendingCount} pending
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Draft Auto-Save Indicator */}
      {(isDraftSaving || draftLastSaved) && (
        <div className="mx-4 mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl shadow-sm">
          <div className="flex items-center space-x-2">
            {isDraftSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-blue-700 font-medium">Saving draft...</span>
              </>
            ) : draftLastSaved ? (
              <>
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">
                  Last saved: {new Date(draftLastSaved).toLocaleTimeString()}
                </span>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* AI Analysis Required Warning - ONLY show after user attempts to submit */}
      {hasAttemptedSubmit && !canSubmitDraft && draftValidationErrors.length > 0 && (
        <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200/50 rounded-xl shadow-sm">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900">Cannot Submit</h3>
              <ul className="mt-1 text-sm text-red-700 space-y-1">
                {draftValidationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Saved Drafts Section */}
      {drafts.length > 0 && (
        <div className="mx-4 mt-4">
          <button
            type="button"
            onClick={() => setShowDraftList(!showDraftList)}
            className="w-full p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/50 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                    <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-indigo-900">Saved Drafts</h3>
                  <p className="text-xs text-indigo-700">
                    {drafts.length} draft{drafts.length !== 1 ? 's' : ''} available
                  </p>
                </div>
              </div>
              <svg
                className={cn(
                  'w-5 h-5 text-indigo-600 transition-transform duration-200',
                  showDraftList ? 'rotate-180' : ''
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* Draft List - Collapsible */}
          {showDraftList && (
            <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
              <DraftList
                drafts={drafts}
                onResume={handleResumeDraft}
                onDelete={deleteDraft}
              />
            </div>
          )}
        </div>
      )}

      {/* Modern Form Container */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
        
        {/* Claim Reference - Modern Card Design */}
        <FormSection variant="card" title="Case Information" description="Basic details for the salvage case">
          <FormField
            label="Claim Reference"
            required={true}
            error={errors.claimReference?.message}
          >
            <ModernInput
              {...register('claimReference')}
              variant="filled"
              size="lg"
              placeholder="Enter claim reference number"
              className="font-mono tracking-wide"
            />
          </FormField>
        </FormSection>

        {/* Asset Type - Enhanced Selection */}
        <FormSection variant="card" title="Asset Classification" description="Select the type of item being assessed">
          <FormField
            label="Asset Type"
            required={true}
            error={errors.assetType?.message}
            description="Universal AI search supports all item types with real-time market pricing"
          >
            <Controller
              name="assetType"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ASSET_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => field.onChange(type.value)}
                      className={cn(
                        'relative p-4 rounded-2xl border-2 transition-all duration-300 ease-out',
                        'hover:scale-105 hover:shadow-lg active:scale-95',
                        'focus:outline-none focus:ring-4 focus:ring-[#800020]/20',
                        'group cursor-pointer',
                        field.value === type.value ? [
                          'border-[#800020] bg-gradient-to-br from-[#800020]/5 to-[#800020]/10',
                          'shadow-lg shadow-[#800020]/20',
                          'ring-2 ring-[#800020]/30',
                        ] : [
                          'border-gray-200 bg-white hover:border-gray-300',
                          'hover:bg-gray-50',
                        ]
                      )}
                    >
                      <div className="text-center space-y-2">
                        <div className="text-3xl group-hover:scale-110 transition-transform duration-200">
                          {type.icon}
                        </div>
                        <div className={cn(
                          'font-medium text-sm',
                          field.value === type.value ? 'text-[#800020]' : 'text-gray-700'
                        )}>
                          {type.label}
                        </div>
                      </div>
                      
                      {/* Selection indicator */}
                      {field.value === type.value && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#800020] rounded-full flex items-center justify-center shadow-lg">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            />
          </FormField>
        </FormSection>

        {/* Conditional Fields - Vehicle with Modern Design */}
        {assetType === 'vehicle' && (
          <FormSection 
            variant="highlighted" 
            title="🚗 Vehicle Details" 
            description="Provide vehicle information for accurate AI assessment"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Make" required={true}>
                <ModernInput
                  {...register('vehicleMake')}
                  variant="filled"
                  placeholder="e.g., Toyota"
                />
              </FormField>

              <FormField label="Model" required={true}>
                <ModernInput
                  {...register('vehicleModel')}
                  variant="filled"
                  placeholder="e.g., Camry"
                />
              </FormField>

              <FormField label="Year" required={true}>
                <ModernInput
                  type="number"
                  {...register('vehicleYear', { valueAsNumber: true })}
                  variant="filled"
                  placeholder="e.g., 2020"
                  min="1900"
                  max={new Date().getFullYear() + 1}
                />
              </FormField>

              <FormField 
                label="VIN (Optional)" 
                description="Vehicle Identification Number for precise identification"
              >
                <ModernInput
                  {...register('vehicleVin')}
                  variant="filled"
                  placeholder="17-character VIN"
                  className="font-mono tracking-wider uppercase"
                  maxLength={17}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <FormField 
                label="Mileage (Optional)" 
                error={errors.vehicleMileage?.message}
              >
                <div className="relative">
                  <ModernInput
                    type="number"
                    {...register('vehicleMileage', { valueAsNumber: true })}
                    variant="filled"
                    placeholder="Enter odometer reading"
                    min="0"
                    className="pr-12"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <span className="text-sm text-gray-500 font-medium">km</span>
                  </div>
                </div>
                {mileageWarning && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-700 flex items-center">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {mileageWarning}
                    </p>
                  </div>
                )}
              </FormField>

              <FormField 
                label="Pre-Accident Condition (Optional)" 
                error={errors.vehicleCondition?.message}
              >
                <Controller
                  name="vehicleCondition"
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent bg-white"
                    >
                      <option value="">Select condition</option>
                      {getQualityTiers().map((condition) => (
                        <option key={condition.value} value={condition.value}>
                          {condition.label}
                        </option>
                      ))}
                    </select>
                  )}
                />
              </FormField>
            </div>
          </FormSection>
        )}

        {/* Conditional Fields - Property with Modern Design */}
        {assetType === 'property' && (
          <FormSection 
            variant="highlighted" 
            title="🏢 Property Details" 
            description="Property information for accurate assessment"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Property Type" required={true}>
                <ModernInput
                  {...register('propertyType')}
                  variant="filled"
                  placeholder="e.g., Residential, Commercial, Industrial"
                />
              </FormField>

              <FormField label="Address" required={true} className="md:col-span-2">
                <textarea
                  {...register('propertyAddress')}
                  rows={3}
                  className={cn(
                    'w-full px-4 py-3 border-transparent bg-gray-100 text-gray-900 rounded-xl',
                    'hover:bg-gray-200 focus:bg-white focus:border-[#800020] focus:ring-2 focus:ring-[#800020]/30',
                    'transition-all duration-200 ease-out resize-none',
                    'placeholder:text-gray-600'
                  )}
                  placeholder="Full property address with landmarks"
                />
              </FormField>
            </div>
          </FormSection>
        )}

        {/* Conditional Fields - Electronics */}
        {assetType === 'electronics' && (
          <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
            <h3 className="font-medium text-gray-900">📱 Electronics Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('electronicsBrand')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Samsung, Apple, Sony"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('electronicsModel')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., iPhone 13, Galaxy S21"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Storage/Capacity (Optional)
              </label>
              <input
                type="text"
                {...register('electronicsStorage')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., 128GB, 256GB"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color (Optional)
              </label>
              <input
                type="text"
                {...register('electronicsColor')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Black, White, Gold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Serial Number (Optional)
              </label>
              <input
                type="text"
                {...register('electronicsSerialNumber')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="Serial number"
              />
            </div>
          </div>
        )}

        {/* Conditional Fields - Appliance */}
        {assetType === 'appliance' && (
          <div className="space-y-4 p-4 bg-orange-50 rounded-lg">
            <h3 className="font-medium text-gray-900">🏠 Appliance Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('applianceBrand')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., LG, Samsung, Whirlpool"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('applianceModel')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., WM-1234, RF-5678"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type (Optional)
              </label>
              <input
                type="text"
                {...register('applianceType')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Refrigerator, Washing Machine"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size/Capacity (Optional)
              </label>
              <input
                type="text"
                {...register('applianceSize')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., 7kg, 500L, 1.5HP"
              />
            </div>
          </div>
        )}

        {/* Conditional Fields - Jewelry */}
        {assetType === 'jewelry' && (
          <div className="space-y-4 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-medium text-gray-900">💎 Jewelry & Watches Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('jewelryType')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Watch, Ring, Necklace, Bracelet"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand (Optional)
              </label>
              <input
                type="text"
                {...register('jewelryBrand')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Rolex, Cartier, Tiffany"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Material (Optional)
              </label>
              <input
                type="text"
                {...register('jewelryMaterial')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Gold, Silver, Platinum, Diamond"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Weight/Size (Optional)
              </label>
              <input
                type="text"
                {...register('jewelryWeight')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., 18k, 2 carats, Size 7"
              />
            </div>
          </div>
        )}

        {/* Conditional Fields - Furniture */}
        {assetType === 'furniture' && (
          <div className="space-y-4 p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium text-gray-900">🪑 Furniture Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('furnitureType')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Sofa, Dining Table, Wardrobe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand (Optional)
              </label>
              <input
                type="text"
                {...register('furnitureBrand')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., IKEA, Ashley, West Elm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Material (Optional)
              </label>
              <input
                type="text"
                {...register('furnitureMaterial')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Leather, Wood, Fabric"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Size (Optional)
              </label>
              <input
                type="text"
                {...register('furnitureSize')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., 3-seater, King size, 6-person"
              />
            </div>
          </div>
        )}

        {/* Conditional Fields - Machinery */}
        {assetType === 'machinery' && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900">⚙️ Machinery & Equipment Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('machineryBrand')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Caterpillar, John Deere, Komatsu"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('machineryType')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Excavator, Generator, Tractor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model (Optional)
              </label>
              <input
                type="text"
                {...register('machineryModel')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., CAT-320, JD-5075E"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year (Optional)
              </label>
              <input
                type="number"
                {...register('machineryYear', { valueAsNumber: true })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., 2020"
                min="1990"
                max={new Date().getFullYear()}
              />
            </div>
          </div>
        )}

        {/* Universal Condition Field */}
        {assetType && assetType !== 'vehicle' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
              Item Condition (Optional - Recommended)
              <button
                type="button"
                title="Adding condition improves AI accuracy by 5-10%"
                className="ml-2 text-blue-500 hover:text-blue-700"
              >
                ℹ️
              </button>
            </label>
            <Controller
              name="itemCondition"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                >
                  <option value="">Select condition</option>
                  <option value="Brand New">Brand New</option>
                  <option value="Foreign Used (Tokunbo)">Foreign Used (Tokunbo)</option>
                  <option value="Nigerian Used">Nigerian Used</option>
                  <option value="Heavily Used">Heavily Used</option>
                </select>
              )}
            />
            {!watch('itemCondition') && (
              <p className="mt-1 text-xs text-blue-600">
                💡 Adding condition improves AI accuracy by 5-10%
              </p>
            )}
            {errors.itemCondition && (
              <p className="mt-1 text-sm text-red-600">{errors.itemCondition.message}</p>
            )}
          </div>
        )}

        {/* Market Value - AI Estimated */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Market Value (₦)
          </label>
          <div className="relative">
            <input
              type="number"
              {...register('marketValue', { 
                setValueAs: (v) => v === '' || v === null ? undefined : parseFloat(v)
              })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent bg-gray-50"
              placeholder="AI will estimate from photos"
              readOnly={!aiAssessment}
            />
            {aiAssessment && (
              <button
                type="button"
                onClick={() => {
                  const newValue = prompt('Enter market value:', watch('marketValue')?.toString());
                  if (newValue) setValue('marketValue', parseFloat(newValue));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#800020] hover:underline"
              >
                Edit
              </button>
            )}
          </div>
          {aiAssessment && (
            <p className="mt-1 text-xs text-green-600">
              ✓ AI estimated from photos
            </p>
          )}
          {!aiAssessment && (
            <p className="mt-1 text-xs text-gray-500">
              Upload photos first - AI will estimate the market value
            </p>
          )}
          {errors.marketValue && (
            <p className="mt-1 text-sm text-red-600">{errors.marketValue.message}</p>
          )}
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photos (3-10 required) <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingAI || searchProgress.stage !== 'idle'}
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#800020] hover:text-[#800020] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessingAI || searchProgress.stage !== 'idle' 
              ? '🔄 Processing...' 
              : `📷 Take Photo or Upload (${photos?.length || 0}/10)`}
          </button>
          <p className="mt-1 text-xs text-gray-500">
            {isOffline 
              ? 'Tap to use camera or select from gallery. AI will analyze when connection is restored.' 
              : !shouldRunAIAssessment()
                ? 'Fill in item details first for accurate AI assessment with internet search.'
                : searchProgress.stage !== 'idle'
                  ? 'AI is searching the internet for market data and analyzing photos...'
                  : 'Tap to use camera or select from gallery. AI will analyze photos with real-time internet search.'}
          </p>
          {errors.photos && (
            <p className="mt-1 text-sm text-red-600">{errors.photos.message}</p>
          )}
          
          {/* Photo Preview */}
          {photos && photos.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative">
                  <Image
                    src={photo}
                    alt={`Photo ${index + 1}`}
                    width={200}
                    height={96}
                    unoptimized
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Manual AI Assessment Button */}
          {!isOffline && photos && photos.length >= 3 && photos.length <= 10 && shouldRunAIAssessment() && searchProgress.stage === 'idle' && (
            <div className="mt-4 space-y-3">
              {/* AI Analysis Status Badge */}
              <AIAnalysisStatusBadge
                hasAnalysis={hasAIAnalysis}
                isProcessing={isProcessingAI}
                marketValue={marketValue}
                confidenceScore={aiAssessment?.confidenceScore}
                error={searchProgress.stage === 'error' ? searchProgress.error || 'Analysis failed' : null}
                className="w-full"
              />
              
              {/* Rate Limit Error */}
              {rateLimitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-medium text-red-900">{rateLimitError}</p>
                  </div>
                </div>
              )}
              
              {/* Analyze Button */}
              <ModernButton
                type="button"
                variant="primary"
                size="lg"
                fullWidth={true}
                onClick={() => runAIAssessment(photos)}
                disabled={isProcessingAI || !checkRateLimit().allowed}
                loading={isProcessingAI}
                className="relative overflow-hidden group"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="font-semibold">
                    {aiAssessment ? `Re-Analyze ${photos.length} Photos` : `Analyze ${photos.length} Photos`}
                  </span>
                </div>
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </ModernButton>
              
              {/* Helper Text */}
              <div className="text-center">
                {aiAssessment ? (
                  <p className="text-sm text-green-600 font-medium">
                    ✓ Analysis complete! You can add/remove photos and re-analyze
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    Ready to analyze {photos.length} photo{photos.length > 1 ? 's' : ''} with AI
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Photo Count Warning */}
          {!isOffline && photos && photos.length < 3 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-900">Upload at least 3 photos to analyze</p>
                  <p className="text-xs text-amber-700">You have {photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Item Details Required Notice */}
          {!isOffline && photos && photos.length >= 3 && !shouldRunAIAssessment() && assetType && searchProgress.stage === 'idle' && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900">Item details required</p>
                  <p className="text-xs text-blue-700">
                    {assetType === 'vehicle' && 'Please fill in Make, Model, and Year to analyze'}
                    {assetType === 'electronics' && 'Please fill in Brand and Model to analyze'}
                    {assetType === 'appliance' && 'Please fill in Brand and Model to analyze'}
                    {assetType === 'jewelry' && 'Please fill in Type to analyze'}
                    {assetType === 'furniture' && 'Please fill in Type to analyze'}
                    {assetType === 'machinery' && 'Please fill in Brand and Type to analyze'}
                    {assetType === 'property' && 'Property details are sufficient for analysis'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Offline AI Notice */}
          {isOffline && photos && photos.length >= 3 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-900">You're offline</p>
                  <p className="text-xs text-yellow-700">AI assessment will run automatically when connection is restored</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Search Progress Indicator */}
          {(searchProgress.stage !== 'idle' || isProcessingAI) && (
            <SearchProgressIndicator
              progress={searchProgress}
              onCancel={() => {
                resetSearchProgress();
                setIsProcessingAI(false);
              }}
              onRetry={() => {
                if (photos && photos.length >= 3) {
                  runAIAssessment(photos);
                }
              }}
              className="mt-3"
            />
          )}
        </div>

        {/* AI Assessment Results - Show immediately after photos */}
        {aiAssessment && (
          <div className="w-full max-w-full overflow-hidden p-5 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border-2 border-green-300 shadow-md">
            <div className="flex items-center mb-3">
              <svg className="w-6 h-6 text-green-600 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-base md:text-lg font-bold text-gray-900 break-words">✨ AI Damage Assessment Complete</h3>
            </div>
            <div className="space-y-3 w-full max-w-full overflow-hidden">
              <div className="flex justify-between items-center gap-2 p-3 bg-white rounded-lg overflow-hidden">
                <span className="text-sm md:text-base text-gray-700 font-medium truncate">Damage Severity:</span>
                <span className={`px-3 py-1 rounded-full text-xs md:text-sm font-bold whitespace-nowrap flex-shrink-0 ${
                  aiAssessment.damageSeverity === 'minor' ? 'bg-green-100 text-green-800' :
                  aiAssessment.damageSeverity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {aiAssessment.damageSeverity.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 p-3 bg-white rounded-lg overflow-hidden">
                <span className="text-sm md:text-base text-gray-700 font-medium truncate">AI Confidence:</span>
                <span className="text-base md:text-lg font-bold text-blue-600 whitespace-nowrap flex-shrink-0">{aiAssessment.confidenceScore}%</span>
              </div>
              
              {/* NEW: Mileage and Condition Display (Requirement 3.1, 3.2) */}
              {assetType === 'vehicle' && (
                <div className="w-full max-w-full overflow-hidden p-3 bg-white rounded-lg border-l-4 border-blue-400">
                  <div className="text-xs md:text-sm font-medium text-gray-700 mb-2">📊 Vehicle Data Used:</div>
                  <div className="space-y-1 text-xs md:text-sm">
                    {vehicleMileage ? (
                      <div className="flex items-start gap-2">
                        <span className="text-green-600 flex-shrink-0">✓</span>
                        <span className="text-gray-600 break-words">Mileage: <span className="font-semibold">{vehicleMileage.toLocaleString()} km</span></span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-600 flex-shrink-0">⚠</span>
                        <span className="text-gray-600 break-words">Mileage: <span className="font-semibold">Estimated</span> (based on vehicle age)</span>
                      </div>
                    )}
                    {vehicleCondition ? (
                      <div className="flex items-start gap-2">
                        <span className="text-green-600 flex-shrink-0">✓</span>
                        <span className="text-gray-600 break-words">Condition: <span className="font-semibold">{getQualityTiers().find(t => t.value === vehicleCondition)?.label || vehicleCondition}</span></span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <span className="text-yellow-600 flex-shrink-0">⚠</span>
                        <span className="text-gray-600 break-words">Condition: <span className="font-semibold">Good (Foreign Used)</span> (default assumed)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center gap-2 p-3 bg-white rounded-lg overflow-hidden">
                <span className="text-sm md:text-base text-gray-700 font-medium truncate">Estimated Salvage Value:</span>
                <span className="text-base md:text-lg font-bold text-green-600 whitespace-nowrap flex-shrink-0">₦{aiAssessment.estimatedSalvageValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center gap-2 p-3 bg-white rounded-lg overflow-hidden">
                <span className="text-sm md:text-base text-gray-700 font-medium truncate">Reserve Price:</span>
                <span className="text-base md:text-lg font-bold text-[#800020] whitespace-nowrap flex-shrink-0">₦{aiAssessment.reservePrice.toLocaleString()}</span>
              </div>
              <div className="w-full max-w-full overflow-hidden p-3 bg-white rounded-lg">
                <span className="text-sm md:text-base text-gray-700 font-medium block mb-2">Detected Damage:</span>
                <div className="flex flex-wrap gap-2 w-full max-w-full">
                  {aiAssessment.labels.map((label, index) => (
                    <span key={index} className="inline-flex items-center px-3 md:px-4 py-1.5 md:py-2 bg-blue-500 text-white rounded-xl text-xs md:text-sm font-medium break-words max-w-full">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-600 italic break-words">
              💡 Market value has been auto-filled based on AI analysis. You can edit it if needed.
            </p>
          </div>
        )}

        {/* GPS Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GPS Location <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              {...register('locationName')}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              placeholder="Enter location or use GPS"
            />
            <button
              type="button"
              onClick={captureGPSLocation}
              disabled={isCapturingGPS}
              className="px-4 py-3 bg-[#800020] text-white rounded-lg hover:bg-[#600018] disabled:bg-gray-400 flex-shrink-0"
              title="Capture GPS location"
            >
              {isCapturingGPS ? '📍...' : '📍'}
            </button>
          </div>
          {gpsLocation && (
            <p className="mt-1 text-sm text-green-600">
              ✓ GPS captured: {gpsLocation.latitude.toFixed(6)}, {gpsLocation.longitude.toFixed(6)}
              <span className="text-gray-600 ml-2">(You can edit the location name above)</span>
            </p>
          )}
          {gpsError && (
            <p className="mt-1 text-sm text-red-600">{gpsError}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Tip: Use GPS button for coordinates, then edit the location name if needed
          </p>
        </div>

        {/* Voice Notes - Unified Modern Interface */}
        <FormSection
          title="Voice Notes"
          description="Tap the record button to add audio notes for additional context (e.g., damage description, special observations)"
          variant="card"
        >
          <div className="space-y-4">
            {/* Unified Voice Field */}
            <UnifiedVoiceField
              value={voiceContent}
              onChange={updateVoiceContent}
              placeholder="Voice notes will appear here as you record them. You can also type directly in this field..."
              showCharacterCount={true}
              maxLength={5000}
              autoResize={true}
              aria-label="Voice notes text area"
              aria-describedby="voice-notes-description"
            />
            
            {/* Interim transcript indicator */}
            {interimTranscript && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-blue-700 font-medium">Listening...</span>
                </div>
                <p className="text-sm text-blue-600 mt-1 italic">"{interimTranscript}"</p>
              </div>
            )}
            
            {/* Voice Controls - Mobile-first design */}
            <div className="flex flex-col items-center space-y-4 py-4">
              <ModernVoiceControls
                isRecording={isRecording}
                onStartRecording={startVoiceRecording}
                onStopRecording={stopVoiceRecording}
                onPauseRecording={pauseVoiceRecording}
                duration={recordingDuration}
                disabled={false}
                className="flex justify-center"
              />
              
              {/* Mobile-friendly instructions */}
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {isRecording 
                    ? 'Tap the red button to stop recording' 
                    : 'Tap the microphone button to start recording'}
                </p>
                {!isRecording && (
                  <p className="text-xs text-gray-500 mt-1">
                    Voice notes are automatically added to the text field above
                  </p>
                )}
              </div>
            </div>
            
            {/* Voice Notes Statistics */}
            {voiceContent && (
              <div className="flex justify-between items-center text-xs text-gray-500 !bg-gray-50 rounded-lg px-3 py-2">
                <span>Words: {voiceWordCount}</span>
                <span>Characters: {voiceCharacterCount}</span>
              </div>
            )}
          </div>
          
          {/* Hidden description for accessibility */}
          <div id="voice-notes-description" className="sr-only">
            Combined text from all voice recordings. You can edit this text directly or add new recordings using the voice controls.
          </div>
        </FormSection>

        {/* Modern Action Buttons - Fixed at bottom with proper z-index and centering */}
        <div className="fixed left-0 right-0 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-lg border-t border-gray-200/50 p-4 z-50">
          <div className="w-full max-w-2xl mx-auto space-y-3">
            {/* AI Analysis Status Badge - Show if not complete */}
            {!canSubmitDraft && (
              <AIAnalysisStatusBadge
                hasAnalysis={hasAIAnalysis}
                isProcessing={isProcessingAI}
                marketValue={marketValue}
                confidenceScore={aiAssessment?.confidenceScore}
                error={searchProgress.stage === 'error' ? searchProgress.error || 'Analysis failed' : null}
                className="w-full"
              />
            )}
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            {/* Save Draft Button - Burgundy outline style matching app theme */}
            <ModernButton
              type="button"
              variant="secondary"
              size="md"
              onClick={saveDraftDirectly}
              disabled={isSavingDraft || isSubmittingForApproval || isProcessingAI || searchProgress.stage !== 'idle'}
              loading={isSavingDraft}
              className={cn(
                "flex-1 sm:flex-none sm:min-w-[140px] relative overflow-hidden",
                "bg-white hover:bg-[#800020]/5",
                "text-[#800020] font-medium shadow-md hover:shadow-lg",
                "border-2 border-[#800020] hover:border-[#a0002a]",
                "transform transition-all duration-200 ease-out",
                "hover:scale-[1.02] active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                "rounded-xl px-4 py-3"
              )}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm font-semibold">
                  {isSavingDraft ? 'Saving...' : 
                   isProcessingAI || searchProgress.stage !== 'idle' ? 'Processing...' : 
                   'Save Draft'}
                </span>
              </div>
            </ModernButton>

            {/* Submit Button - Better proportions */}
            <ModernButton
              type="button"
              variant="primary"
              size="md"
              onClick={handleSubmit((data) => onSubmit(data, false))}
              disabled={!canSubmitDraft || isSavingDraft || isSubmittingForApproval || isProcessingAI || searchProgress.stage !== 'idle'}
              loading={isSubmittingForApproval}
              className={cn(
                "flex-1 sm:flex-none sm:min-w-[160px] relative overflow-hidden group",
                "bg-gradient-to-r from-[#800020] via-[#a0002a] to-[#c0003a]",
                "hover:from-[#900025] hover:via-[#b0002f] hover:to-[#d0003f]",
                "text-white font-semibold shadow-lg hover:shadow-xl hover:shadow-[#800020]/30",
                "border border-[#800020]/30 hover:border-[#800020]/50",
                "transform transition-all duration-200 ease-out",
                "hover:scale-[1.02] active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                "rounded-xl px-4 py-3"
              )}
              title={!canSubmitDraft ? 'AI analysis required before submission' : ''}
            >
              <div className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">
                  {isSubmittingForApproval ? 'Submitting...' : 
                   isProcessingAI || searchProgress.stage !== 'idle' ? 'Processing...' : 
                   'Submit for Approval'}
                </span>
              </div>
              {/* Enhanced shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </ModernButton>
          </div>
          </div>
          
          {/* Subtle gradient fade */}
          <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-transparent to-white/20 pointer-events-none" />
        </div>

        {/* Bottom padding to account for fixed buttons */}
        <div className="h-32" />
      </form>
    </div>
    </ResponsiveFormLayout>
  );
}

// Wrap in Suspense boundary to fix Next.js build error
export default function NewCasePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading case creation form...</p>
        </div>
      </div>
    }>
      <NewCasePageContent />
    </Suspense>
  );
}
