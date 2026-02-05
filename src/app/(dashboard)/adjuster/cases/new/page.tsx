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

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useOffline } from '@/hooks/use-offline';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { saveOfflineCase } from '@/lib/db/indexeddb';
import { getAccurateGeolocation, type GeolocationError } from '@/lib/integrations/google-geolocation';
import { useToast } from '@/components/ui/toast';

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
 * Asset type options
 */
const ASSET_TYPES = [
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'property', label: 'Property' },
  { value: 'electronics', label: 'Electronics' },
] as const;

/**
 * Validation schema
 */
const caseFormSchema = z.object({
  claimReference: z.string().min(1, 'Claim reference is required'),
  assetType: z.enum(['vehicle', 'property', 'electronics']).refine((val) => val !== undefined, {
    message: 'Asset type is required',
  }),
  marketValue: z.number().positive('Market value must be positive'),
  
  // Vehicle-specific fields
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.number().optional(),
  vehicleVin: z.string().optional(),
  
  // Property-specific fields
  propertyType: z.string().optional(),
  propertyAddress: z.string().optional(),
  
  // Electronics-specific fields
  electronicsBrand: z.string().optional(),
  electronicsSerialNumber: z.string().optional(),
  
  // Common fields
  photos: z.array(z.string()).min(3, 'At least 3 photos required').max(10, 'Maximum 10 photos allowed'),
  locationName: z.string().min(1, 'Location name is required'),
  voiceNotes: z.array(z.string()).optional(),
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
    return data.electronicsBrand;
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
 * AI Assessment result
 */
interface AIAssessmentResult {
  damageSeverity: 'minor' | 'moderate' | 'severe';
  confidenceScore: number;
  labels: string[];
  estimatedSalvageValue: number;
  reservePrice: number;
}

export default function NewCasePage() {
  const router = useRouter();
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
      voiceNotes: [],
    },
  });

  const assetType = watch('assetType');
  const photos = watch('photos');
  
  // UI state
  const [gpsLocation, setGpsLocation] = useState<GeoLocation | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [aiAssessment, setAiAssessment] = useState<AIAssessmentResult | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  /**
   * Auto-capture GPS location on mount
   */
  useEffect(() => {
    captureGPSLocation();
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
   * Capture GPS location using hybrid approach
   * - When online: Uses Google Maps Geolocation API (accurate)
   * - When offline: Falls back to browser geolocation
   */
  const captureGPSLocation = async () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
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
        setGpsError(geoError.message);
      } else {
        setGpsError('Failed to capture GPS location. Please try again.');
      }
    } finally {
      setIsCapturingGPS(false);
    }
  };

  /**
   * Handle photo upload
   */
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

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

    // Only trigger AI assessment when online and we have at least 3 photos
    if (!isOffline && updatedPhotos.length >= 3) {
      await runAIAssessment(updatedPhotos);
    }
  };

  /**
   * Run AI assessment on uploaded photos
   * Only runs when online - offline cases will be processed when synced
   */
  const runAIAssessment = async (photosToAssess: string[]) => {
    if (isProcessingAI || isOffline) return; // Prevent duplicate calls and skip if offline
    
    setIsProcessingAI(true);
    setAiAssessment(null); // Clear previous results
    
    try {
      const response = await fetch('/api/cases/ai-assessment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          photos: photosToAssess,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI assessment failed');
      }

      const result = await response.json();
      
      // Set AI assessment results
      if (result.data) {
        const assessment: AIAssessmentResult = {
          damageSeverity: result.data.damageSeverity,
          confidenceScore: result.data.confidenceScore,
          labels: result.data.labels,
          estimatedSalvageValue: result.data.estimatedSalvageValue,
          reservePrice: result.data.reservePrice,
        };
        
        setAiAssessment(assessment);
        
        // Auto-fill market value
        setValue('marketValue', result.data.estimatedSalvageValue);
        
        console.log('AI Assessment Complete:', assessment);
      }
    } catch (error) {
      console.error('AI assessment error:', error);
      toast.warning('AI assessment failed', 'You can still submit the form manually.');
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
    
    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      
      // Update voice notes
      const currentNotes = watch('voiceNotes') || [];
      setValue('voiceNotes', [...currentNotes, transcript]);
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      
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
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setIsRecording(false);
      toast.error('Failed to start voice recording', 'Please try again.');
    }
  };

  /**
   * Stop voice recording
   */
  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  /**
   * Submit form
   * Note: AI assessment already runs in real-time during photo upload (line ~380)
   * This function just saves the case with the AI results already captured
   */
  const onSubmit = async (data: CaseFormData, isDraft: boolean = false) => {
    try {
      if (!gpsLocation) {
        toast.error('GPS location required', 'Please allow location access.');
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
        };
      } else if (data.assetType === 'property') {
        assetDetails = {
          propertyType: data.propertyType,
          address: data.propertyAddress,
        };
      } else if (data.assetType === 'electronics') {
        assetDetails = {
          brand: data.electronicsBrand,
          serialNumber: data.electronicsSerialNumber,
        };
      }

      const caseData = {
        claimReference: data.claimReference,
        assetType: data.assetType,
        assetDetails,
        marketValue: data.marketValue,
        photos: data.photos,
        gpsLocation,
        locationName: data.locationName,
        voiceNotes: data.voiceNotes,
        status: isDraft ? 'draft' as const : 'pending_approval' as const,
      };

      if (isOffline) {
        // Save to IndexedDB for offline sync
        await saveOfflineCase({
          ...caseData,
          createdBy: 'current-user-id', // TODO: Get from session
          syncStatus: 'pending',
        });
        
        toast.success('Case saved offline', 'It will be synced when connection is restored.');
        router.push('/adjuster/cases');
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
          throw new Error(error.error || 'Failed to create case');
        }

        toast.success(
          isDraft ? 'Case saved as draft' : 'Case submitted for approval',
          isDraft ? 'You can continue editing later.' : 'Manager will review your submission.'
        );
        router.push('/adjuster/cases');
      }
    } catch (error) {
      console.error('Error submitting case:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit case';
      toast.error('Submission failed', errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-[#800020] text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="text-white hover:text-gray-200"
          >
            ← Back
          </button>
          <h1 className="text-lg font-bold">Create Salvage Case</h1>
          <div className="w-16" /> {/* Spacer */}
        </div>
      </div>

      {/* Offline Indicator */}
      {isOffline && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="font-medium">
              You're offline. Changes will sync automatically when connection is restored.
              {pendingCount > 0 && ` (${pendingCount} pending)`}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <form className="p-4 space-y-6">
        {/* Claim Reference */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Claim Reference <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('claimReference')}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
            placeholder="Enter claim reference"
          />
          {errors.claimReference && (
            <p className="mt-1 text-sm text-red-600">{errors.claimReference.message}</p>
          )}
        </div>

        {/* Asset Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Asset Type <span className="text-red-500">*</span>
          </label>
          <Controller
            name="assetType"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
              >
                <option value="">Select asset type</option>
                {ASSET_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          />
          {errors.assetType && (
            <p className="mt-1 text-sm text-red-600">{errors.assetType.message}</p>
          )}
        </div>

        {/* Conditional Fields - Vehicle */}
        {assetType === 'vehicle' && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-gray-900">Vehicle Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('vehicleMake')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Toyota"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('vehicleModel')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Camry"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                {...register('vehicleYear', { valueAsNumber: true })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., 2020"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VIN (Optional)
              </label>
              <input
                type="text"
                {...register('vehicleVin')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="Vehicle Identification Number"
              />
            </div>
          </div>
        )}

        {/* Conditional Fields - Property */}
        {assetType === 'property' && (
          <div className="space-y-4 p-4 bg-green-50 rounded-lg">
            <h3 className="font-medium text-gray-900">Property Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Property Type <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('propertyType')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Residential, Commercial"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('propertyAddress')}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="Full property address"
              />
            </div>
          </div>
        )}

        {/* Conditional Fields - Electronics */}
        {assetType === 'electronics' && (
          <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
            <h3 className="font-medium text-gray-900">Electronics Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('electronicsBrand')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
                placeholder="e.g., Samsung, Apple"
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

        {/* Market Value - AI Estimated */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Market Value (₦) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              {...register('marketValue', { valueAsNumber: true })}
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
            disabled={isProcessingAI}
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#800020] hover:text-[#800020] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📷 Take Photo or Upload ({photos?.length || 0}/10)
          </button>
          <p className="mt-1 text-xs text-gray-500">
            {isOffline 
              ? 'Tap to use camera or select from gallery. AI will analyze when connection is restored.' 
              : 'Tap to use camera or select from gallery. AI will analyze photos automatically.'}
          </p>
          {errors.photos && (
            <p className="mt-1 text-sm text-red-600">{errors.photos.message}</p>
          )}
          
          {/* Offline AI Notice */}
          {isOffline && photos && photos.length >= 3 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-900">You're offline</p>
                  <p className="text-xs text-yellow-700">AI assessment will run automatically when connection is restored</p>
                </div>
              </div>
            </div>
          )}
          
          {/* AI Processing Indicator */}
          {isProcessingAI && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-900">AI is analyzing your photos...</p>
                  <p className="text-xs text-blue-700">This may take a few seconds</p>
                </div>
              </div>
            </div>
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
        </div>

        {/* AI Assessment Results - Show immediately after photos */}
        {aiAssessment && (
          <div className="p-5 bg-gradient-to-br from-green-50 to-blue-50 rounded-xl border-2 border-green-300 shadow-md">
            <div className="flex items-center mb-3">
              <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-bold text-gray-900">✨ AI Damage Assessment Complete</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-gray-700 font-medium">Damage Severity:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  aiAssessment.damageSeverity === 'minor' ? 'bg-green-100 text-green-800' :
                  aiAssessment.damageSeverity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {aiAssessment.damageSeverity.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-gray-700 font-medium">AI Confidence:</span>
                <span className="text-lg font-bold text-blue-600">{aiAssessment.confidenceScore}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-gray-700 font-medium">Estimated Salvage Value:</span>
                <span className="text-lg font-bold text-green-600">₦{aiAssessment.estimatedSalvageValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                <span className="text-gray-700 font-medium">Reserve Price:</span>
                <span className="text-lg font-bold text-[#800020]">₦{aiAssessment.reservePrice.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <span className="text-gray-700 font-medium block mb-2">Detected Damage:</span>
                <div className="flex flex-wrap gap-2">
                  {aiAssessment.labels.map((label, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-medium">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-600 italic">
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

        {/* Voice Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Voice Notes (Optional)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Add audio notes for additional context (e.g., damage description, special observations)
          </p>
          <button
            type="button"
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
              isRecording
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : 'bg-[#800020] text-white hover:bg-[#600018]'
            }`}
          >
            {isRecording ? '⏹️ Stop Recording' : '🎤 Record Voice Note'}
          </button>
          {watch('voiceNotes') && watch('voiceNotes')!.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">Recorded Notes:</p>
              {watch('voiceNotes')!.map((note, index) => (
                <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm flex justify-between items-start">
                  <span className="flex-1">{note}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const currentNotes = watch('voiceNotes') || [];
                      setValue('voiceNotes', currentNotes.filter((_, i) => i !== index));
                    }}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 space-y-2">
          <button
            type="button"
            onClick={handleSubmit((data) => onSubmit(data, true))}
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400"
          >
            {isSubmitting ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={handleSubmit((data) => onSubmit(data, false))}
            disabled={isSubmitting}
            className="w-full px-4 py-3 bg-[#800020] text-white rounded-lg font-medium hover:bg-[#600018] disabled:bg-gray-400"
          >
            {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
