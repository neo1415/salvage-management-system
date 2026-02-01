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
   * Capture GPS location
   */
  const captureGPSLocation = async () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    setIsCapturingGPS(true);
    setGpsError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 30000, // Increased to 30 seconds for better reliability
          maximumAge: 0,
        });
      });

      const location: GeoLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setGpsLocation(location);
      
      // Reverse geocode to get location name
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}`
        );
        const data = await response.json();
        setValue('locationName', data.display_name || 'Unknown location');
      } catch (error) {
        console.error('Failed to reverse geocode:', error);
        setValue('locationName', `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
      }
    } catch (error) {
      console.error('GPS capture error:', error);
      
      // Provide user-friendly error messages based on error code
      let errorMessage = 'Failed to capture GPS location';
      
      if (error && typeof error === 'object' && 'code' in error) {
        const geoError = error as GeolocationPositionError;
        switch (geoError.code) {
          case 1: // PERMISSION_DENIED
            errorMessage = 'Location permission denied. Please enable location access in your browser settings.';
            break;
          case 2: // POSITION_UNAVAILABLE
            errorMessage = 'Location unavailable. Please check your device GPS settings.';
            break;
          case 3: // TIMEOUT
            errorMessage = 'Location request timed out. Please try again or move to an area with better GPS signal.';
            break;
          default:
            errorMessage = geoError.message || 'Failed to capture GPS location';
        }
      }
      
      setGpsError(errorMessage);
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
        alert(`Photo ${file.name} exceeds 5MB limit`);
        continue;
      }

      // Convert to base64
      const base64 = await fileToBase64(file);
      newPhotos.push(base64);
    }

    const currentPhotos = photos || [];
    const updatedPhotos = [...currentPhotos, ...newPhotos].slice(0, 10);
    setValue('photos', updatedPhotos);
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
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    // Request microphone permission first
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      console.error('Microphone permission denied:', error);
      alert('Microphone access denied. Please enable microphone permissions in your browser settings to use voice notes.');
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
      let errorMessage = 'Voice recording failed. ';
      switch (event.error) {
        case 'not-allowed':
          errorMessage += 'Microphone access denied. Please enable microphone permissions in your browser settings.';
          break;
        case 'no-speech':
          errorMessage += 'No speech detected. Please try again.';
          break;
        case 'network':
          errorMessage += 'Network error. Please check your internet connection.';
          break;
        default:
          errorMessage += `Error: ${event.error}`;
      }
      alert(errorMessage);
    };

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start recognition:', error);
      setIsRecording(false);
      alert('Failed to start voice recording. Please try again.');
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
   */
  const onSubmit = async (data: CaseFormData, isDraft: boolean = false) => {
    try {
      if (!gpsLocation) {
        alert('GPS location is required. Please allow location access.');
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
        
        alert('Case saved offline. It will be synced when connection is restored.');
        router.push('/adjuster/cases');
      } else {
        // Submit to API
        setIsProcessingAI(true);
        
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

        const result = await response.json();
        
        // Display AI assessment
        if (result.data.aiAssessment) {
          setAiAssessment({
            damageSeverity: result.data.damageSeverity,
            confidenceScore: result.data.aiAssessment.confidenceScore,
            labels: result.data.aiAssessment.labels,
            estimatedSalvageValue: result.data.estimatedSalvageValue,
            reservePrice: result.data.reservePrice,
          });
        }

        alert(isDraft ? 'Case saved as draft' : 'Case submitted for approval');
        router.push('/adjuster/cases');
      }
    } catch (error) {
      console.error('Error submitting case:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit case';
      alert(errorMessage);
    } finally {
      setIsProcessingAI(false);
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
            className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-[#800020] hover:text-[#800020] transition-colors font-medium"
          >
            📷 Take Photo or Upload ({photos?.length || 0}/10)
          </button>
          <p className="mt-1 text-xs text-gray-500">
            Tap to use camera or select from gallery
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

        {/* AI Assessment Results */}
        {aiAssessment && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-gray-900 mb-3">AI Damage Assessment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Damage Severity:</span>
                <span className="font-medium capitalize">{aiAssessment.damageSeverity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Confidence:</span>
                <span className="font-medium">{aiAssessment.confidenceScore}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated Salvage Value:</span>
                <span className="font-medium">₦{aiAssessment.estimatedSalvageValue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reserve Price:</span>
                <span className="font-medium">₦{aiAssessment.reservePrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-600">Damage Labels:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {aiAssessment.labels.map((label, index) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 space-y-2">
          <button
            type="button"
            onClick={handleSubmit((data) => onSubmit(data, true))}
            disabled={isSubmitting || isProcessingAI}
            className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400"
          >
            {isSubmitting ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={handleSubmit((data) => onSubmit(data, false))}
            disabled={isSubmitting || isProcessingAI}
            className="w-full px-4 py-3 bg-[#800020] text-white rounded-lg font-medium hover:bg-[#600018] disabled:bg-gray-400"
          >
            {isProcessingAI ? 'Processing AI Assessment...' : isSubmitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
