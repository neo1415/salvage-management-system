/**
 * PredictionCard Component
 * Tasks 10.1.1, 10.1.2, 10.1.3
 * 
 * Displays auction price prediction with confidence indicators
 */

'use client';

import { useState } from 'react';
import { TrendingUp, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface PredictionCardProps {
  auctionId: string;
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidenceScore: number;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  method: string;
  sampleSize: number;
  metadata?: {
    similarAuctions?: number;
    marketAdjustment?: number;
    competitionLevel?: string;
    seasonalFactor?: number;
    warnings?: string[];
    notes?: string[];
  };
}

/**
 * Task 10.1.1: Create PredictionCard component with price range display
 * Task 10.1.2: Implement color-coded confidence indicators
 */
export function PredictionCard({
  auctionId,
  predictedPrice,
  lowerBound,
  upperBound,
  confidenceScore,
  confidenceLevel,
  method,
  sampleSize,
  metadata,
}: PredictionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Task 10.1.2: Color-coded confidence indicators
  const confidenceColors = {
    High: 'bg-green-100 text-green-800 border-green-300',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Low: 'bg-orange-100 text-orange-800 border-orange-300',
  };

  const confidenceBarColors = {
    High: 'bg-green-500',
    Medium: 'bg-yellow-500',
    Low: 'bg-orange-500',
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Price Prediction</h3>
        </div>
        
        {/* Task 10.1.2: Confidence badge */}
        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${confidenceColors[confidenceLevel]}`}>
          {confidenceLevel} Confidence
        </span>
      </div>

      {/* Predicted Price */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-1">Predicted Final Price</p>
        <p className="text-3xl font-bold text-gray-900">{formatCurrency(predictedPrice)}</p>
      </div>

      {/* Price Range */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Expected Range</span>
          <span className="text-sm font-medium text-gray-900">
            {formatCurrency(lowerBound)} - {formatCurrency(upperBound)}
          </span>
        </div>
        
        {/* Visual range indicator */}
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`absolute h-full ${confidenceBarColors[confidenceLevel]} opacity-60`}
            style={{
              left: '0%',
              width: '100%',
            }}
          />
          <div 
            className="absolute h-full bg-gray-900"
            style={{
              left: '50%',
              width: '2px',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">Lower</span>
          <span className="text-xs text-gray-500">Upper</span>
        </div>
      </div>

      {/* Confidence Score */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">Confidence Score</span>
          <span className="text-sm font-medium text-gray-900">
            {(confidenceScore * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${confidenceBarColors[confidenceLevel]}`}
            style={{ width: `${confidenceScore * 100}%` }}
          />
        </div>
      </div>

      {/* Metadata Summary */}
      {metadata && (
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {metadata.similarAuctions !== undefined && (
            <div>
              <p className="text-gray-600">Similar Auctions</p>
              <p className="font-medium text-gray-900">{metadata.similarAuctions}</p>
            </div>
          )}
          {metadata.competitionLevel && (
            <div>
              <p className="text-gray-600">Competition</p>
              <p className="font-medium text-gray-900 capitalize">
                {metadata.competitionLevel.replace('_', ' ')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Task 10.1.3: "How is this calculated?" expandable section */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">How is this calculated?</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-600" />
        )}
      </button>

      {/* Expanded explanation */}
      {isExpanded && (
        <div className="mt-3 p-4 bg-blue-50 rounded-lg text-sm space-y-3">
          <div>
            <p className="font-medium text-gray-900 mb-1">Prediction Method</p>
            <p className="text-gray-700">
              {method === 'historical' 
                ? 'Based on historical auction data from similar assets'
                : method === 'salvage_value'
                ? 'Based on estimated salvage value'
                : method === 'market_value_calc'
                ? 'Calculated from market value and damage assessment'
                : 'Estimated from reserve price'}
            </p>
          </div>

          <div>
            <p className="font-medium text-gray-900 mb-1">Data Points</p>
            <p className="text-gray-700">
              Analysis based on {sampleSize} similar auction{sampleSize !== 1 ? 's' : ''}
            </p>
          </div>

          {metadata?.marketAdjustment && (
            <div>
              <p className="font-medium text-gray-900 mb-1">Market Adjustments</p>
              <p className="text-gray-700">
                Applied {((metadata.marketAdjustment - 1) * 100).toFixed(1)}% adjustment for current market conditions
                {metadata.seasonalFactor && ` and seasonal trends`}
              </p>
            </div>
          )}

          {metadata?.notes && metadata.notes.length > 0 && (
            <div>
              <p className="font-medium text-gray-900 mb-1">Notes</p>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {metadata.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {metadata?.warnings && metadata.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="font-medium text-yellow-900 mb-1">⚠️ Warnings</p>
              <ul className="list-disc list-inside text-yellow-800 space-y-1">
                {metadata.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 border-t border-blue-200">
            <p className="text-xs text-gray-600">
              Predictions are estimates based on historical data and market conditions. 
              Actual final prices may vary.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
