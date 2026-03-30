/**
 * Gemini Damage Display Component
 * 
 * Reusable component for displaying Gemini AI damage detection data consistently
 * across all pages (auction details, case approval, case details, etc.)
 * 
 * Features:
 * - Item Details section (make, model, year, color, trim, bodyStyle, overallCondition, notes)
 * - Damaged Parts section (list of damaged parts with severity and confidence)
 * - Summary section (AI-generated damage description)
 * - Graceful handling of missing/optional fields
 * - Professional styling suitable for insurance adjusters and vendors
 */

import React from 'react';

/**
 * Item details from Gemini AI
 */
export interface ItemDetails {
  detectedMake?: string;
  detectedModel?: string;
  detectedYear?: string;
  color?: string;
  trim?: string;
  bodyStyle?: string;
  storage?: string;
  overallCondition?: string;
  notes?: string;
}

/**
 * Individual damaged part with severity and confidence
 */
export interface DamagedPart {
  part: string;
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;
}

/**
 * Props for GeminiDamageDisplay component
 */
export interface GeminiDamageDisplayProps {
  itemDetails?: ItemDetails;
  damagedParts?: DamagedPart[];
  summary?: string;
  className?: string;
  showTitle?: boolean;
  assetType?: 'vehicle' | 'electronics' | 'machinery' | 'equipment' | 'property';
}

/**
 * Get severity badge color
 */
const getSeverityColor = (severity: 'minor' | 'moderate' | 'severe'): string => {
  switch (severity) {
    case 'minor':
      return 'bg-yellow-100 text-yellow-800';
    case 'moderate':
      return 'bg-orange-100 text-orange-800';
    case 'severe':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Gemini Damage Display Component
 */
export function GeminiDamageDisplay({
  itemDetails,
  damagedParts,
  summary,
  className = '',
  showTitle = true,
  assetType,
}: GeminiDamageDisplayProps) {
  // Check if we have any data to display
  const hasItemDetails = itemDetails && Object.keys(itemDetails).some(key => itemDetails[key as keyof ItemDetails]);
  const hasDamagedParts = damagedParts && damagedParts.length > 0;
  const hasSummary = summary && summary.trim().length > 0;

  // If no data, don't render anything
  if (!hasItemDetails && !hasDamagedParts && !hasSummary) {
    return null;
  }

  // Determine which fields to show based on asset type
  const shouldShowField = (fieldName: keyof ItemDetails): boolean => {
    if (!assetType) return true; // Show all fields if asset type is not specified
    
    switch (fieldName) {
      case 'trim':
      case 'bodyStyle':
        // Only show for vehicles
        return assetType === 'vehicle';
      
      case 'storage':
        // Only show for electronics
        return assetType === 'electronics';
      
      case 'color':
        // Show for vehicles and electronics, but not for machinery/equipment
        return assetType === 'vehicle' || assetType === 'electronics';
      
      case 'detectedMake':
      case 'detectedModel':
      case 'detectedYear':
      case 'overallCondition':
      case 'notes':
        // Show for all asset types
        return true;
      
      default:
        return true;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Title */}
      {showTitle && (
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>AI Damage Analysis</span>
        </h3>
      )}

      {/* Summary Section */}
      {hasSummary && (
        <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-purple-900 mb-1">Damage Summary</p>
              <p className="text-sm text-gray-800 leading-relaxed">{summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Item Details Section */}
      {hasItemDetails && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Item Identification</span>
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {itemDetails.detectedMake && shouldShowField('detectedMake') && (
              <div>
                <span className="text-gray-600">Make:</span>{' '}
                <span className="font-semibold text-gray-900">{itemDetails.detectedMake}</span>
              </div>
            )}
            {itemDetails.detectedModel && shouldShowField('detectedModel') && (
              <div>
                <span className="text-gray-600">Model:</span>{' '}
                <span className="font-semibold text-gray-900">{itemDetails.detectedModel}</span>
              </div>
            )}
            {itemDetails.detectedYear && shouldShowField('detectedYear') && (
              <div>
                <span className="text-gray-600">Year:</span>{' '}
                <span className="font-semibold text-gray-900">{itemDetails.detectedYear}</span>
              </div>
            )}
            {itemDetails.color && shouldShowField('color') && (
              <div>
                <span className="text-gray-600">Color:</span>{' '}
                <span className="font-semibold text-gray-900">{itemDetails.color}</span>
              </div>
            )}
            {itemDetails.trim && shouldShowField('trim') && (
              <div>
                <span className="text-gray-600">Trim:</span>{' '}
                <span className="font-semibold text-gray-900">{itemDetails.trim}</span>
              </div>
            )}
            {itemDetails.bodyStyle && shouldShowField('bodyStyle') && (
              <div>
                <span className="text-gray-600">Body Style:</span>{' '}
                <span className="font-semibold text-gray-900">{itemDetails.bodyStyle}</span>
              </div>
            )}
            {itemDetails.storage && shouldShowField('storage') && (
              <div>
                <span className="text-gray-600">Storage:</span>{' '}
                <span className="font-semibold text-gray-900">{itemDetails.storage}</span>
              </div>
            )}
            {itemDetails.overallCondition && shouldShowField('overallCondition') && (
              <div className="col-span-2">
                <span className="text-gray-600">Overall Condition:</span>{' '}
                <span className="font-semibold text-gray-900">{itemDetails.overallCondition}</span>
              </div>
            )}
          </div>
          {itemDetails.notes && shouldShowField('notes') && (
            <div className="mt-3 pt-3 border-t border-purple-200">
              <p className="text-xs text-gray-600 italic">{itemDetails.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Damaged Parts Section */}
      {hasDamagedParts && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Damaged Parts ({damagedParts.length})</span>
          </p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {damagedParts.map((part, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 p-3 bg-white rounded-lg shadow-sm"
              >
                <span className="text-sm text-gray-800 font-medium flex-1">{part.part}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getSeverityColor(part.severity)}`}>
                    {part.severity.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">{part.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for smaller displays (e.g., cards)
 */
export function GeminiDamageDisplayCompact({
  itemDetails,
  damagedParts,
  summary,
  className = '',
  assetType,
}: GeminiDamageDisplayProps) {
  const hasItemDetails = itemDetails && Object.keys(itemDetails).some(key => itemDetails[key as keyof ItemDetails]);
  const hasDamagedParts = damagedParts && damagedParts.length > 0;
  const hasSummary = summary && summary.trim().length > 0;

  if (!hasItemDetails && !hasDamagedParts && !hasSummary) {
    return null;
  }

  // Determine which fields to show based on asset type
  const shouldShowField = (fieldName: keyof ItemDetails): boolean => {
    if (!assetType) return true; // Show all fields if asset type is not specified
    
    switch (fieldName) {
      case 'trim':
      case 'bodyStyle':
        // Only show for vehicles
        return assetType === 'vehicle';
      
      case 'storage':
        // Only show for electronics
        return assetType === 'electronics';
      
      case 'color':
        // Show for vehicles and electronics, but not for machinery/equipment
        return assetType === 'vehicle' || assetType === 'electronics';
      
      case 'detectedMake':
      case 'detectedModel':
      case 'detectedYear':
      case 'overallCondition':
      case 'notes':
        // Show for all asset types
        return true;
      
      default:
        return true;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Summary - Compact */}
      {hasSummary && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-xs font-bold text-purple-900 mb-1">AI Summary</p>
          <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{summary}</p>
        </div>
      )}

      {/* Item Details - Compact */}
      {hasItemDetails && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p className="text-xs font-bold text-gray-900 mb-2">🔍 Item ID</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {itemDetails.detectedMake && shouldShowField('detectedMake') && (
              <div><span className="text-gray-600">Make:</span> <span className="font-semibold">{itemDetails.detectedMake}</span></div>
            )}
            {itemDetails.detectedModel && shouldShowField('detectedModel') && (
              <div><span className="text-gray-600">Model:</span> <span className="font-semibold">{itemDetails.detectedModel}</span></div>
            )}
            {itemDetails.detectedYear && shouldShowField('detectedYear') && (
              <div><span className="text-gray-600">Year:</span> <span className="font-semibold">{itemDetails.detectedYear}</span></div>
            )}
            {itemDetails.color && shouldShowField('color') && (
              <div><span className="text-gray-600">Color:</span> <span className="font-semibold">{itemDetails.color}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Damaged Parts - Compact */}
      {hasDamagedParts && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs font-bold text-gray-900 mb-2">🔧 Damaged Parts ({damagedParts.length})</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {damagedParts.map((part, index) => (
              <div key={index} className="flex items-center justify-between gap-2 p-2 bg-white rounded text-xs">
                <span className="text-gray-800 font-medium flex-1 truncate">{part.part}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${getSeverityColor(part.severity)}`}>
                  {part.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
