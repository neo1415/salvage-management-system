import { db } from '@/lib/db';
import { cases } from '@/lib/db/schema/cases';
import { sql, and, eq } from 'drizzle-orm';
import { geminiAnalyzeImages } from '@/lib/integrations/gemini-damage-detection';
import { claudeAnalyzeImages } from '@/lib/integrations/claude-damage-detection';

interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: number; // 0-1
  matchedCase: any | null;
  reasoning: string;
}

interface VehicleData {
  photos: string[];
  assetDetails: {
    make?: string;
    model?: string;
    year?: string;
    color?: string;
    vin?: string;
    licensePlate?: string;
    [key: string]: any;
  };
}

/**
 * Check if a vehicle has already been submitted
 * Uses AI to compare photos and detect duplicate submissions
 */
export async function checkForDuplicateVehicle(data: VehicleData): Promise<DuplicateCheckResult> {
  console.log('🔍 Starting duplicate vehicle detection...');
  
  // Step 1: Quick checks (no AI needed)
  const quickCheck = await performQuickChecks(data);
  if (quickCheck.isDuplicate) {
    return quickCheck;
  }
  
  // Step 2: Find similar vehicles (same make/model/year/color)
  const similarVehicles = await findSimilarVehicles(data.assetDetails);
  
  if (similarVehicles.length === 0) {
    console.log('✅ No similar vehicles found - not a duplicate');
    return {
      isDuplicate: false,
      confidence: 0,
      matchedCase: null,
      reasoning: 'No similar vehicles found in database',
    };
  }
  
  console.log(`🔍 Found ${similarVehicles.length} similar vehicles, checking with AI...`);
  
  // Step 3: Use AI to compare photos
  for (const existingCase of similarVehicles) {
    const aiComparison = await compareVehiclePhotos({
      newPhotos: data.photos,
      existingPhotos: existingCase.photos || [],
      newDetails: data.assetDetails,
      existingDetails: existingCase.assetDetails,
    });
    
    if (aiComparison.confidence > 0.85) {
      console.log(`🚨 DUPLICATE DETECTED! Confidence: ${aiComparison.confidence}`);
      return {
        isDuplicate: true,
        confidence: aiComparison.confidence,
        matchedCase: existingCase,
        reasoning: aiComparison.reasoning,
      };
    }
  }
  
  console.log('✅ No duplicates found after AI analysis');
  return {
    isDuplicate: false,
    confidence: 0,
    matchedCase: null,
    reasoning: 'No duplicate found after AI photo comparison',
  };
}

/**
 * Perform quick checks for exact matches (VIN, license plate)
 */
async function performQuickChecks(data: VehicleData): Promise<DuplicateCheckResult> {
  // Check VIN
  if (data.assetDetails.vin) {
    const vinMatch = await db
      .select()
      .from(cases)
      .where(sql`asset_details->>'vin' = ${data.assetDetails.vin}`)
      .limit(1);
    
    if (vinMatch.length > 0) {
      console.log('🚨 DUPLICATE: Exact VIN match found');
      return {
        isDuplicate: true,
        confidence: 1.0,
        matchedCase: vinMatch[0],
        reasoning: 'Exact VIN match found',
      };
    }
  }
  
  // Check license plate
  if (data.assetDetails.licensePlate) {
    const plateMatch = await db
      .select()
      .from(cases)
      .where(sql`asset_details->>'licensePlate' = ${data.assetDetails.licensePlate}`)
      .limit(1);
    
    if (plateMatch.length > 0) {
      console.log('🚨 DUPLICATE: License plate match found');
      return {
        isDuplicate: true,
        confidence: 0.95,
        matchedCase: plateMatch[0],
        reasoning: 'License plate match found',
      };
    }
  }
  
  return {
    isDuplicate: false,
    confidence: 0,
    matchedCase: null,
    reasoning: 'No quick matches found',
  };
}

/**
 * Find vehicles with similar characteristics
 */
async function findSimilarVehicles(assetDetails: any) {
  if (!assetDetails.make || !assetDetails.model || !assetDetails.year) {
    return [];
  }
  
  const similarVehicles = await db
    .select()
    .from(cases)
    .where(
      and(
        sql`asset_details->>'make' = ${assetDetails.make}`,
        sql`asset_details->>'model' = ${assetDetails.model}`,
        sql`asset_details->>'year' = ${assetDetails.year}`,
        assetDetails.color ? sql`asset_details->>'color' = ${assetDetails.color}` : undefined
      )
    )
    .limit(10);
  
  return similarVehicles;
}

/**
 * Use AI to compare vehicle photos and determine if they're the same vehicle
 */
async function compareVehiclePhotos(data: {
  newPhotos: string[];
  existingPhotos: string[];
  newDetails: any;
  existingDetails: any;
}): Promise<{ confidence: number; reasoning: string }> {
  
  const prompt = `Compare these two vehicles to determine if they are the EXACT SAME vehicle:

Vehicle A (New Submission):
- Make: ${data.newDetails.make}
- Model: ${data.newDetails.model}
- Year: ${data.newDetails.year}
- Color: ${data.newDetails.color}
- Photos: ${data.newPhotos.length} images

Vehicle B (Existing Case):
- Make: ${data.existingDetails.make}
- Model: ${data.existingDetails.model}
- Year: ${data.existingDetails.year}
- Color: ${data.existingDetails.color}
- Photos: ${data.existingPhotos.length} images

CRITICAL ANALYSIS REQUIRED:
Analyze these specific features to determine if this is the EXACT SAME vehicle:

1. UNIQUE DAMAGE PATTERNS:
   - Specific scratches, dents, or damage locations
   - Damage severity and patterns
   - Any unique collision damage

2. INTERIOR FEATURES:
   - Seats condition and wear patterns
   - Dashboard condition
   - Steering wheel wear
   - Interior color and material

3. MODIFICATIONS & ACCESSORIES:
   - Aftermarket parts
   - Custom modifications
   - Accessories or add-ons
   - Non-standard features

4. PAINT & BODY:
   - Paint condition and wear
   - Rust patterns
   - Body panel alignment
   - Paint color variations

5. IDENTIFIERS:
   - Any visible VIN numbers
   - License plate (if visible)
   - Stickers or decals
   - Unique markings

6. TIRES & WHEELS:
   - Tire brand and condition
   - Wheel type and condition
   - Tire wear patterns

Return ONLY valid JSON (no markdown):
{
  "isSameVehicle": boolean,
  "confidence": 0.0-1.0,
  "reasoning": "Detailed explanation of why they match or don't match",
  "matchingFeatures": ["list", "of", "matching", "features"],
  "differingFeatures": ["list", "of", "differences"]
}`;

  try {
    // Try Gemini first (free tier)
    console.log('🤖 Using Gemini for photo comparison...');
    const result = await geminiAnalyzeImages(
      [...data.newPhotos, ...data.existingPhotos],
      prompt
    );
    
    const parsed = JSON.parse(result);
    return {
      confidence: parsed.isSameVehicle ? parsed.confidence : 0,
      reasoning: parsed.reasoning,
    };
  } catch (error) {
    console.log('⚠️ Gemini failed, falling back to Claude...');
    // Fallback to Claude
    try {
      const result = await claudeAnalyzeImages(
        [...data.newPhotos, ...data.existingPhotos],
        prompt
      );
      
      const parsed = JSON.parse(result);
      return {
        confidence: parsed.isSameVehicle ? parsed.confidence : 0,
        reasoning: parsed.reasoning,
      };
    } catch (claudeError) {
      console.error('❌ Both AI services failed:', claudeError);
      // Return low confidence if both fail
      return {
        confidence: 0,
        reasoning: 'AI analysis failed - manual review required',
      };
    }
  }
}
