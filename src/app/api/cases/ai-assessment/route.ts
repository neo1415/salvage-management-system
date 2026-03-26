/**
 * AI Assessment API Endpoint
 * 
 * Standalone endpoint for running AI assessment on photos
 * without creating a case. Used for real-time feedback during case creation.
 * 
 * NOW USES ENHANCED AI SERVICE with:
 * - Real market data scraping from Jiji.ng
 * - Vehicle context (make/model/year/mileage/condition)
 * - Accurate salvage value calculations
 * - High confidence scores (90%+)
 * - Server-side rate limiting (5 requests per minute per user)
 * 
 * Accepts base64 data URLs (data:image/jpeg;base64,...) or regular image URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';
import type { VehicleInfo, UniversalItemInfo } from '@/features/cases/services/ai-assessment-enhanced.service';
import { auth } from '@/lib/auth/next-auth.config';

// In-memory rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, number[]>();

/**
 * Check rate limit for a user
 * Max 5 requests per minute
 */
function checkRateLimit(userId: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // Get user's request history
  const userRequests = rateLimitStore.get(userId) || [];
  
  // Filter out requests older than 1 minute
  const recentRequests = userRequests.filter(time => time > oneMinuteAgo);
  
  if (recentRequests.length >= 5) {
    // Calculate retry-after in seconds
    const oldestRequest = Math.min(...recentRequests);
    const retryAfter = Math.ceil((oldestRequest + 60000 - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Update store with new request
  recentRequests.push(now);
  rateLimitStore.set(userId, recentRequests);
  
  // Cleanup old entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [key, times] of rateLimitStore.entries()) {
      const validTimes = times.filter(t => t > oneMinuteAgo);
      if (validTimes.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, validTimes);
      }
    }
  }
  
  return { allowed: true, retryAfter: 0 };
}

// Helper functions to determine brand prestige
function getLuxuryBrandPrestige(make?: string): 'luxury' | 'premium' | 'standard' | 'budget' {
  if (!make) return 'standard';
  const luxuryBrands = ['Lamborghini', 'Ferrari', 'Porsche', 'Bentley', 'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Maserati'];
  const premiumBrands = ['BMW', 'Mercedes-Benz', 'Audi', 'Lexus', 'Infiniti', 'Acura', 'Cadillac', 'Lincoln', 'Volvo'];
  const budgetBrands = ['Dacia', 'Lada', 'Tata', 'Chery', 'Geely'];
  
  if (luxuryBrands.includes(make)) return 'luxury';
  if (premiumBrands.includes(make)) return 'premium';
  if (budgetBrands.includes(make)) return 'budget';
  return 'standard';
}

function getElectronicsBrandPrestige(brand?: string): 'luxury' | 'premium' | 'standard' | 'budget' {
  if (!brand) return 'standard';
  const luxuryBrands = ['Apple', 'Bang & Olufsen', 'Vertu', 'Goldvish'];
  const premiumBrands = ['Samsung', 'Sony', 'LG', 'Microsoft', 'Google', 'OnePlus', 'Huawei'];
  const budgetBrands = ['Tecno', 'Infinix', 'Itel', 'Oukitel', 'Blackview'];
  
  if (luxuryBrands.includes(brand)) return 'luxury';
  if (premiumBrands.includes(brand)) return 'premium';
  if (budgetBrands.includes(brand)) return 'budget';
  return 'standard';
}

function getApplianceBrandPrestige(brand?: string): 'luxury' | 'premium' | 'standard' | 'budget' {
  if (!brand) return 'standard';
  const luxuryBrands = ['Miele', 'Sub-Zero', 'Wolf', 'Viking', 'Thermador'];
  const premiumBrands = ['Bosch', 'Siemens', 'KitchenAid', 'Whirlpool', 'GE Profile', 'Samsung', 'LG'];
  const budgetBrands = ['Haier', 'Hisense', 'TCL', 'Midea'];
  
  if (luxuryBrands.includes(brand)) return 'luxury';
  if (premiumBrands.includes(brand)) return 'premium';
  if (budgetBrands.includes(brand)) return 'budget';
  return 'standard';
}

function getWatchBrandPrestige(brand?: string): 'luxury' | 'premium' | 'standard' | 'budget' {
  if (!brand) return 'standard';
  const luxuryBrands = ['Rolex', 'Patek Philippe', 'Audemars Piguet', 'Vacheron Constantin', 'Jaeger-LeCoultre', 'Richard Mille'];
  const premiumBrands = ['Omega', 'TAG Heuer', 'Breitling', 'IWC', 'Cartier', 'Panerai', 'Tudor'];
  const budgetBrands = ['Casio', 'Timex', 'Swatch', 'Fossil'];
  
  if (luxuryBrands.includes(brand)) return 'luxury';
  if (premiumBrands.includes(brand)) return 'premium';
  if (budgetBrands.includes(brand)) return 'budget';
  return 'standard';
}

export async function POST(request: NextRequest) {
  try {
    // Get user session for rate limiting
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }
    
    // Check rate limit
    const rateLimit = checkRateLimit(session.user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many analysis requests',
          message: `Please try again in ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter.toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + rateLimit.retryAfter * 1000).toISOString()
          }
        }
      );
    }
    
    const body = await request.json();
    const { photos, vehicleInfo, itemInfo } = body;

    // Validate photos
    if (!photos || !Array.isArray(photos) || photos.length < 3) {
      return NextResponse.json(
        { error: 'At least 3 photos are required for AI assessment' },
        { status: 400 }
      );
    }

    if (photos.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 photos allowed' },
        { status: 400 }
      );
    }

    // Build universal item info object from request (support both vehicleInfo and itemInfo formats)
    const universalItemData: UniversalItemInfo | undefined = (() => {
      // Try vehicleInfo first (legacy format)
      if (vehicleInfo) {
        return {
          type: 'vehicle',
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          year: vehicleInfo.year,
          mileage: vehicleInfo.mileage,
          condition: vehicleInfo.condition || 'Nigerian Used',
          age: vehicleInfo.year ? new Date().getFullYear() - vehicleInfo.year : undefined,
          brandPrestige: getLuxuryBrandPrestige(vehicleInfo.make),
        };
      }
      
      // Try itemInfo (new universal format)
      if (itemInfo) {
        const baseItem: UniversalItemInfo = {
          type: itemInfo.assetType || 'other',
          condition: itemInfo.condition || 'Nigerian Used',
          description: itemInfo.description,
        };

        // Add type-specific fields
        switch (itemInfo.assetType) {
          case 'vehicle':
            return {
              ...baseItem,
              make: itemInfo.make,
              model: itemInfo.model,
              year: itemInfo.year,
              mileage: itemInfo.mileage,
              age: itemInfo.year ? new Date().getFullYear() - itemInfo.year : undefined,
              brandPrestige: getLuxuryBrandPrestige(itemInfo.make),
            };
          
          case 'electronics':
            return {
              ...baseItem,
              brand: itemInfo.brand,
              model: itemInfo.model,
              storageCapacity: itemInfo.storage || itemInfo.storageCapacity, // Support both field names
              batteryHealth: itemInfo.batteryHealth,
              age: itemInfo.age || (itemInfo.year ? new Date().getFullYear() - itemInfo.year : undefined),
              brandPrestige: getElectronicsBrandPrestige(itemInfo.brand),
            };
          
          case 'appliance':
            return {
              ...baseItem,
              brand: itemInfo.brand,
              model: itemInfo.model,
              age: itemInfo.age || (itemInfo.year ? new Date().getFullYear() - itemInfo.year : undefined),
              brandPrestige: getApplianceBrandPrestige(itemInfo.brand),
            };
          
          case 'watch':
            return {
              ...baseItem,
              brand: itemInfo.brand,
              model: itemInfo.model,
              movementType: itemInfo.movementType,
              age: itemInfo.age || (itemInfo.year ? new Date().getFullYear() - itemInfo.year : undefined),
              brandPrestige: getWatchBrandPrestige(itemInfo.brand),
            };
          
          default:
            return {
              ...baseItem,
              brand: itemInfo.brand,
              model: itemInfo.model,
              age: itemInfo.age || (itemInfo.year ? new Date().getFullYear() - itemInfo.year : undefined),
            };
        }
      }
      
      return undefined;
    })();

    // Convert to VehicleInfo for backward compatibility (only for vehicles)
    const vehicleData: VehicleInfo | undefined = universalItemData?.type === 'vehicle' ? {
      type: 'vehicle',
      make: universalItemData.make,
      model: universalItemData.model,
      year: universalItemData.year,
      mileage: universalItemData.mileage,
      condition: universalItemData.condition,
      age: universalItemData.age,
      brandPrestige: universalItemData.brandPrestige,
    } : undefined;

    // Run ENHANCED AI assessment with universal item support
    console.log(`Running ENHANCED AI assessment on ${photos.length} photos...`);
    console.log('Universal item info:', universalItemData);
    
    const assessment = await assessDamageEnhanced({
      photos,
      vehicleInfo: vehicleData, // For backward compatibility
      universalItemInfo: universalItemData, // New universal support
    });
    
    console.log('Enhanced AI Assessment Result:', {
      severity: assessment.damageSeverity,
      confidence: assessment.confidenceScore,
      salvageValue: assessment.estimatedSalvageValue,
      marketValue: assessment.marketValue,
    });

    return NextResponse.json({
      success: true,
      data: {
        damageSeverity: assessment.damageSeverity,
        confidenceScore: assessment.confidenceScore,
        labels: assessment.labels,
        estimatedSalvageValue: assessment.estimatedSalvageValue,
        reservePrice: assessment.reservePrice,
        marketValue: assessment.marketValue,
        estimatedRepairCost: assessment.estimatedRepairCost,
        damagePercentage: assessment.damagePercentage,
        damageScore: assessment.damageScore, // CRITICAL FIX: Return actual damage scores
        isTotalLoss: assessment.isTotalLoss, // CRITICAL FIX: Return total loss indicator
        isRepairable: assessment.isRepairable,
        recommendation: assessment.recommendation,
        warnings: assessment.warnings,
        confidence: assessment.confidence,
        analysisMethod: assessment.analysisMethod, // CRITICAL FIX: Return analysis method
        qualityTier: assessment.qualityTier, // Return quality tier
        priceSource: assessment.priceSource, // CRITICAL FIX: Return price source
        // Add metadata for progress indicators
        dataSource: 'internet', // Default to internet search
        searchQuery: universalItemData ? 
          `${universalItemData.brand || universalItemData.make || ''} ${universalItemData.model || ''} ${universalItemData.year || ''} ${universalItemData.condition || 'used'} price Nigeria`.trim() :
          'market price search',
        processingTime: Date.now(), // Will be calculated on client side
      },
    });
  } catch (error) {
    console.error('AI assessment API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process AI assessment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
