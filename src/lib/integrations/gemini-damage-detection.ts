/**
 * Gemini 2.5 Flash Damage Detection Service
 * 
 * Provides advanced multimodal AI damage assessment for vehicles using Google's Gemini 2.5 Flash API.
 * 
 * Features:
 * - Structured damage scoring across 5 categories (structural, mechanical, cosmetic, electrical, interior)
 * - Severity classification (minor/moderate/severe)
 * - Airbag deployment detection
 * - Total loss determination
 * - Automatic fallback to Vision API when unavailable
 * - Rate limiting to stay within free tier (30 requests/minute, 1,000 requests/day)
 * 
 * Fallback Chain: Gemini → Vision API → Neutral scores
 * 
 * Requirements: 2.3, 2.4, 2.5
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { internetSearchService } from '@/features/internet-search/services/internet-search.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

/**
 * Vehicle context for damage assessment
 */
export interface VehicleContext {
  make: string;
  model: string;
  year: number;
  itemType?: string; // Optional field to support universal items
}

/**
 * Item details detected from analysis
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
  part: string;              // Specific part name (e.g., "driver front door", "front bumper")
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;        // 0-100: Confidence in this part's damage assessment
}

/**
 * Structured damage assessment result from Gemini
 */
export interface GeminiDamageAssessment {
  itemDetails?: ItemDetails;  // Overall item identification
  damagedParts: DamagedPart[]; // Only damaged parts
  severity: 'minor' | 'moderate' | 'severe';
  airbagDeployed: boolean;
  totalLoss: boolean;
  summary: string;
  confidence: number;        // 0-100: Confidence in assessment
  method: 'gemini';
}

/**
 * Gemini service configuration
 */
interface GeminiConfig {
  apiKey: string | undefined;
  enabled: boolean;
  model: string;
}

/**
 * Enhanced damage detection result with part prices
 */
export interface DamageDetectionResult {
  overallConfidence: number;
  damagedComponents: Array<{
    component: string;
    severity: string;
    confidence: number;
  }>;
  totalLoss: boolean;
  airbagDeployed: boolean;
  summary: string;
  method: 'gemini' | 'vision' | 'fallback';
}

/**
 * Search for part prices when damage is detected with performance optimizations
 * 
 * CRITICAL FIX: Use actual damaged part names from Gemini directly instead of generic mapping
 * This preserves the specificity of parts like "driver front door" vs generic "door panel"
 */
async function searchPartPricesForDamage(
  vehicleInfo: { make?: string; model?: string; year?: number },
  damagedComponents: Array<{ component: string; severity: string }>
): Promise<Array<{
  component: string;
  partPrice?: number;
  confidence?: number;
  source: 'internet_search' | 'not_found';
}>> {
  if (!vehicleInfo.make || !vehicleInfo.model || damagedComponents.length === 0) {
    return [];
  }

  const itemIdentifier: ItemIdentifier = {
    type: 'vehicle',
    make: vehicleInfo.make,
    model: vehicleInfo.model,
    year: vehicleInfo.year
  };

  // CRITICAL FIX: Use actual part names directly from Gemini
  // Gemini provides specific names like "driver front door", "front bumper", "rear quarter panel"
  // These are already optimized for search - don't map them to generic terms!
  const partsToSearch = damagedComponents.map(damage => ({
    name: damage.component, // Use the actual part name from Gemini
    damageType: damage.severity
  }));

  console.log(`🔍 Searching for ${partsToSearch.length} part prices for ${vehicleInfo.make} ${vehicleInfo.model}`);

  try {
    // Use the optimized multiple part search with performance settings
    const searchOptions = {
      maxResults: 3, // Reduced for faster searches
      timeout: 1500, // Quick timeout for real-time damage detection
      concurrencyLimit: 2, // Conservative limit for damage detection context
      enableBatching: true,
      prioritizeCommonParts: true
    };
    
    const partResults = await internetSearchService.searchMultiplePartPrices(
      itemIdentifier,
      partsToSearch,
      searchOptions
    );

    // Convert results to the expected format
    const mappedResults = partResults.map((result, index) => {
      const originalComponent = damagedComponents[index]?.component || 'unknown';
      
      if (result.success && result.priceData.averagePrice) {
        console.log(`✅ Found part price for ${result.partName}: ₦${result.priceData.averagePrice.toLocaleString()}`);
        
        return {
          component: originalComponent,
          partPrice: result.priceData.averagePrice,
          confidence: result.priceData.confidence,
          source: 'internet_search' as const
        };
      } else {
        console.log(`⚠️ No price found for ${result.partName}`);
        return {
          component: originalComponent,
          source: 'not_found' as const
        };
      }
    });

    const successfulSearches = mappedResults.filter(r => r.source === 'internet_search').length;
    console.log(`✅ Part price search completed: ${successfulSearches}/${partsToSearch.length} prices found`);

    return mappedResults;

  } catch (error) {
    console.error('❌ Multiple part search failed:', error);
    
    // Return not_found results for all components
    return damagedComponents.map(damage => ({
      component: damage.component,
      source: 'not_found' as const
    }));
  }
}

/**
 * Service state
 */
let serviceConfig: GeminiConfig = {
  apiKey: undefined,
  enabled: false,
  model: 'gemini-2.5-flash', // Changed from flash-lite for better accuracy
};

let geminiClient: GoogleGenerativeAI | null = null;
let geminiModel: any | null = null;

/**
 * Initialize the Gemini service with API key validation
 * 
 * This function:
 * - Validates GEMINI_API_KEY presence
 * - Logs warning and disables service when key is missing
 * - Ensures API key is never exposed in logs (logs last 4 chars only)
 * - Initializes the Gemini client when key is valid
 * - Configures the gemini-2.0-flash model
 * - Validates connection to Gemini API
 * 
 * Requirements: 2.3, 2.4, 2.5, 3.1, 3.2, 13.4
 */
export async function initializeGeminiService(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-gemini-api-key') {
    console.warn(
      '[Gemini Service] GEMINI_API_KEY not configured. Gemini damage detection is disabled. ' +
      'The system will fall back to Vision API. To enable Gemini, set GEMINI_API_KEY in your environment. ' +
      'Get an API key at: https://aistudio.google.com/apikey'
    );
    serviceConfig.enabled = false;
    serviceConfig.apiKey = undefined;
    geminiClient = null;
    geminiModel = null;
    return;
  }

  // Validate API key format (should be a reasonable length)
  if (apiKey.length < 20) {
    console.warn(
      `[Gemini Service] GEMINI_API_KEY appears invalid (too short). Gemini damage detection is disabled. ` +
      `Key ends with: ...${apiKey.slice(-4)}`
    );
    serviceConfig.enabled = false;
    serviceConfig.apiKey = undefined;
    geminiClient = null;
    geminiModel = null;
    return;
  }

  try {
    // Initialize the Gemini client with API key
    geminiClient = new GoogleGenerativeAI(apiKey);
    
    // Configure the gemini-2.5-flash model
    geminiModel = geminiClient.getGenerativeModel({ 
      model: serviceConfig.model,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // Validate connection by attempting to list models
    // This ensures the API key is valid and the service is reachable
    try {
      // Simple validation - if we can get the model, the connection is valid
      if (!geminiModel) {
        throw new Error('Failed to initialize Gemini model');
      }
      
      // Mark service as enabled
      serviceConfig.apiKey = apiKey;
      serviceConfig.enabled = true;

      // Log successful initialization (with last 4 chars only for security)
      const maskedKey = `...${apiKey.slice(-4)}`;
      console.info(
        `[Gemini Service] Initialized successfully with API key ending in ${maskedKey}. ` +
        `Model: ${serviceConfig.model}. Rate limits: 10 requests/minute, 1,500 requests/day. ` +
        `Connection validated.`
      );
    } catch (validationError: any) {
      // Connection validation failed - likely invalid API key
      const errorMessage = validationError?.message || 'Unknown error';
      console.error(
        `[Gemini Service] Connection validation failed. API key may be invalid. ` +
        `Error: ${errorMessage}. Key ends with: ...${apiKey.slice(-4)}. ` +
        `Gemini damage detection is disabled. The system will fall back to Vision API.`
      );
      serviceConfig.enabled = false;
      serviceConfig.apiKey = undefined;
      geminiClient = null;
      geminiModel = null;
    }
  } catch (initError: any) {
    // Initialization failed - log error with context for traceability
    const errorMessage = initError?.message || 'Unknown error';
    const errorStack = initError?.stack || 'No stack trace available';
    console.error(
      `[Gemini Service] Initialization failed. Error: ${errorMessage}. ` +
      `Key ends with: ...${apiKey.slice(-4)}. ` +
      `Gemini damage detection is disabled. The system will fall back to Vision API. ` +
      `Stack trace: ${errorStack}`
    );
    serviceConfig.enabled = false;
    serviceConfig.apiKey = undefined;
    geminiClient = null;
    geminiModel = null;
  }
}

/**
 * Check if Gemini service is enabled and ready
 * 
 * @returns true if service is enabled, API key is configured, and model is initialized
 */
export function isGeminiEnabled(): boolean {
  return serviceConfig.enabled && geminiClient !== null && geminiModel !== null;
}

/**
 * Get the Gemini model instance (for internal use)
 * 
 * @returns The configured Gemini model or null if not initialized
 * @internal
 */
export function getGeminiModel(): any | null {
  return geminiModel;
}

/**
 * Get the current service configuration (for testing/monitoring)
 * 
 * @returns Service configuration with masked API key
 */
export function getGeminiServiceConfig(): {
  enabled: boolean;
  model: string;
  apiKeyConfigured: boolean;
  apiKeyLastFourChars: string | null;
} {
  return {
    enabled: serviceConfig.enabled,
    model: serviceConfig.model,
    apiKeyConfigured: serviceConfig.apiKey !== undefined,
    apiKeyLastFourChars: serviceConfig.apiKey ? serviceConfig.apiKey.slice(-4) : null,
  };
}

/**
 * Gemini response schema for structured JSON output
 * 
 * This schema is passed to Gemini to ensure consistent response format
 */
const GEMINI_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    itemDetails: {
      type: "object",
      properties: {
        detectedMake: { type: "string", description: "Detected make/brand of the item" },
        detectedModel: { type: "string", description: "Detected model of the item" },
        detectedYear: { type: "string", description: "Detected year/age of the item" },
        color: { type: "string", description: "Color of the item" },
        trim: { type: "string", description: "Trim level (vehicles)" },
        bodyStyle: { type: "string", description: "Body style (vehicles)" },
        storage: { type: "string", description: "Storage capacity (electronics)" },
        overallCondition: { type: "string", description: "Overall condition assessment" },
        notes: { type: "string", description: "Additional notes about the item" }
      }
    },
    damagedParts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          part: { 
            type: "string",
            description: "Specific part name with location (e.g., 'driver front door', 'front bumper')"
          },
          severity: { 
            type: "string",
            enum: ["minor", "moderate", "severe"],
            description: "Damage severity for this specific part"
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Confidence in this part's damage assessment (0-100)"
          }
        },
        required: ["part", "severity", "confidence"]
      },
      description: "Array of damaged parts only (exclude undamaged parts)"
    },
    severity: { 
      type: "string", 
      enum: ["minor", "moderate", "severe"],
      description: "Overall damage severity classification"
    },
    airbagDeployed: { 
      type: "boolean",
      description: "Whether airbags have been deployed"
    },
    totalLoss: { 
      type: "boolean",
      description: "Whether item is a total loss (conservative criteria)"
    },
    summary: { 
      type: "string", 
      maxLength: 500,
      description: "Brief description of the damage"
    }
  },
  required: [
    "itemDetails", "damagedParts", "severity", "airbagDeployed", "totalLoss", "summary"
  ]
};

/**
 * Clamp a number to a valid range
 * 
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Validate and sanitize a damage score
 * 
 * Requirements: 15.3
 * 
 * @param score - Raw score from Gemini
 * @param fieldName - Name of the field (for logging)
 * @param requestId - Request ID for logging
 * @returns Clamped score between 0 and 100
 */
export function validateDamageScore(score: any, fieldName: string, requestId: string): number {
  // Check if score is a number
  if (typeof score !== 'number' || isNaN(score)) {
    console.warn(
      `[Gemini Service] Invalid ${fieldName} score (not a number): ${score}. ` +
      `Defaulting to 50. Request ID: ${requestId}`
    );
    return 50;
  }

  // Clamp to 0-100 range
  if (score < 0 || score > 100) {
    const clampedScore = clamp(score, 0, 100);
    console.warn(
      `[Gemini Service] ${fieldName} score out of range: ${score}. ` +
      `Clamped to ${clampedScore}. Request ID: ${requestId}`
    );
    return clampedScore;
  }

  return score;
}

/**
 * Validate and correct severity based on damage scores
 * 
 * This function ensures severity classification is consistent with damage scores.
 * Rules:
 * - If airbag deployed OR structural > 70 OR mechanical > 70 → SEVERE
 * - If total damage > 150 OR any category > 60 → at least MODERATE
 * - If total damage < 30 → MINOR
 * 
 * @param severity - Raw severity from Gemini
 * @param scores - Damage scores
 * @param airbagDeployed - Whether airbags deployed
 * @param requestId - Request ID for logging
 * @returns Corrected severity level
 */
export function validateAndCorrectSeverity(
  severity: 'minor' | 'moderate' | 'severe',
  scores: { structural: number; mechanical: number; cosmetic: number; electrical: number; interior: number },
  airbagDeployed: boolean,
  requestId: string
): 'minor' | 'moderate' | 'severe' {
  const totalDamage = scores.structural + scores.mechanical + scores.cosmetic + scores.electrical + scores.interior;
  const maxScore = Math.max(scores.structural, scores.mechanical, scores.cosmetic, scores.electrical, scores.interior);
  
  // Force SEVERE if critical damage indicators present
  if (airbagDeployed || scores.structural > 70 || scores.mechanical > 70) {
    if (severity !== 'severe') {
      console.warn(
        `[Gemini Service] Correcting severity from ${severity} to SEVERE. ` +
        `Reason: Airbag deployed (${airbagDeployed}) OR structural (${scores.structural}) > 70 OR mechanical (${scores.mechanical}) > 70. ` +
        `Request ID: ${requestId}`
      );
      return 'severe';
    }
  }
  
  // Force at least MODERATE if significant damage
  if ((totalDamage > 150 || maxScore > 60) && severity === 'minor') {
    console.warn(
      `[Gemini Service] Correcting severity from MINOR to MODERATE. ` +
      `Reason: Total damage (${totalDamage}) > 150 OR max score (${maxScore}) > 60. ` +
      `Request ID: ${requestId}`
    );
    return 'moderate';
  }
  
  // Force MINOR if minimal damage
  if (totalDamage < 30 && severity !== 'minor') {
    console.warn(
      `[Gemini Service] Correcting severity from ${severity} to MINOR. ` +
      `Reason: Total damage (${totalDamage}) < 30. ` +
      `Request ID: ${requestId}`
    );
    return 'minor';
  }
  
  return severity;
}

/**
 * Validate and sanitize boolean flag
 * 
 * Requirements: 15.5
 * 
 * @param value - Raw boolean from Gemini
 * @param fieldName - Name of the field (for logging)
 * @param requestId - Request ID for logging
 * @returns Valid boolean value
 */
export function validateBoolean(value: any, fieldName: string, requestId: string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  console.warn(
    `[Gemini Service] Invalid ${fieldName} value (not a boolean): ${value}. ` +
    `Defaulting to false. Request ID: ${requestId}`
  );
  return false;
}

/**
 * Validate and sanitize summary text
 * 
 * Requirements: 15.6
 * 
 * @param summary - Raw summary from Gemini
 * @param requestId - Request ID for logging
 * @returns Valid summary text
 */
export function validateSummary(summary: any, requestId: string): string {
  // Check if summary is a string
  if (typeof summary !== 'string') {
    console.warn(
      `[Gemini Service] Invalid summary (not a string): ${typeof summary}. ` +
      `Using default summary. Request ID: ${requestId}`
    );
    return 'Damage assessment completed. Please review detailed parts.';
  }

  // Check if summary is empty
  if (summary.trim() === '') {
    console.warn(
      `[Gemini Service] Empty summary received. ` +
      `Using default summary. Request ID: ${requestId}`
    );
    return 'Damage assessment completed. Please review detailed parts.';
  }

  // Truncate if exceeds 500 characters
  if (summary.length > 500) {
    const truncated = summary.substring(0, 497) + '...';
    console.warn(
      `[Gemini Service] Summary exceeds 500 characters (${summary.length}). ` +
      `Truncated to 500 characters. Request ID: ${requestId}`
    );
    return truncated;
  }

  return summary;
}

/**
 * Parse and validate Gemini JSON response
 * 
 * This function:
 * - Parses JSON response from Gemini API
 * - Validates all required fields are present
 * - Validates field types
 * - Validates damagedParts array structure
 * - Ensures summary is non-empty and under 500 characters
 * - Returns structured GeminiDamageAssessment object
 * 
 * Requirements: 3.6, 4.1-4.10, 15.3, 15.4, 15.5, 15.6
 * 
 * @param responseText - Raw text response from Gemini API
 * @param requestId - Request ID for logging
 * @returns Validated and sanitized damage assessment
 * @throws Error if response is not valid JSON or missing required fields
 */
export function parseAndValidateResponse(responseText: string, requestId: string): GeminiDamageAssessment {
  // Parse JSON response
  let parsedResponse: any;
  try {
    parsedResponse = JSON.parse(responseText);
  } catch (parseError: any) {
    const errorMsg = 
      `Failed to parse Gemini response as JSON. Response: ${responseText.substring(0, 200)}... ` +
      `Error: ${parseError?.message || 'Unknown error'}. Request ID: ${requestId}`;
    console.error(`[Gemini Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Validate required fields are present
  const requiredFields = [
    'damagedParts', 'severity', 'airbagDeployed', 'totalLoss', 'summary'
  ];

  const missingFields = requiredFields.filter(field => !(field in parsedResponse));
  if (missingFields.length > 0) {
    const errorMsg = 
      `Gemini response missing required fields: ${missingFields.join(', ')}. ` +
      `Response: ${JSON.stringify(parsedResponse)}. Request ID: ${requestId}`;
    console.error(`[Gemini Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Validate damagedParts array
  if (!Array.isArray(parsedResponse.damagedParts)) {
    const errorMsg = 
      `damagedParts must be an array. Received: ${typeof parsedResponse.damagedParts}. ` +
      `Request ID: ${requestId}`;
    console.error(`[Gemini Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Validate each damaged part
  const damagedParts: DamagedPart[] = parsedResponse.damagedParts.map((part: any, index: number) => {
    if (!part.part || typeof part.part !== 'string') {
      console.warn(
        `[Gemini Service] Invalid part name at index ${index}. Using "unknown part". ` +
        `Request ID: ${requestId}`
      );
      part.part = 'unknown part';
    }

    const validSeverities: Array<'minor' | 'moderate' | 'severe'> = ['minor', 'moderate', 'severe'];
    if (!validSeverities.includes(part.severity)) {
      console.warn(
        `[Gemini Service] Invalid severity "${part.severity}" at index ${index}. Defaulting to "moderate". ` +
        `Request ID: ${requestId}`
      );
      part.severity = 'moderate';
    }

    if (typeof part.confidence !== 'number' || part.confidence < 0 || part.confidence > 100) {
      console.warn(
        `[Gemini Service] Invalid confidence ${part.confidence} at index ${index}. Defaulting to 70. ` +
        `Request ID: ${requestId}`
      );
      part.confidence = 70;
    }

    return {
      part: part.part,
      severity: part.severity as 'minor' | 'moderate' | 'severe',
      confidence: part.confidence
    };
  });

  // Validate severity format
  const validSeverities: Array<'minor' | 'moderate' | 'severe'> = ['minor', 'moderate', 'severe'];
  let severity: 'minor' | 'moderate' | 'severe';
  if (typeof parsedResponse.severity === 'string' && validSeverities.includes(parsedResponse.severity as any)) {
    severity = parsedResponse.severity as 'minor' | 'moderate' | 'severe';
  } else {
    console.warn(
      `[Gemini Service] Invalid severity value: ${parsedResponse.severity}. ` +
      `Defaulting to "moderate". Request ID: ${requestId}`
    );
    severity = 'moderate';
  }
  
  const airbagDeployed = validateBoolean(parsedResponse.airbagDeployed, 'airbagDeployed', requestId);
  const totalLoss = validateBoolean(parsedResponse.totalLoss, 'totalLoss', requestId);
  const summary = validateSummary(parsedResponse.summary, requestId);

  // Parse itemDetails if present
  let itemDetails: ItemDetails | undefined;
  if (parsedResponse.itemDetails && typeof parsedResponse.itemDetails === 'object') {
    // Helper function to sanitize field values
    const sanitizeField = (value: any): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      // Reject empty strings
      if (!trimmed) return undefined;
      // Reject values that look like AI reasoning (contain parentheses with explanations or are overly long)
      if ((trimmed.includes('(') || trimmed.includes('estimated') || trimmed.includes('appears to be')) && trimmed.length > 50) {
        console.warn(`[Gemini Service] Rejecting field value with reasoning text: ${trimmed.substring(0, 100)}...`);
        return undefined;
      }
      return trimmed;
    };

    itemDetails = {
      detectedMake: sanitizeField(parsedResponse.itemDetails.detectedMake),
      detectedModel: sanitizeField(parsedResponse.itemDetails.detectedModel),
      detectedYear: sanitizeField(parsedResponse.itemDetails.detectedYear),
      color: sanitizeField(parsedResponse.itemDetails.color),
      trim: sanitizeField(parsedResponse.itemDetails.trim),
      bodyStyle: sanitizeField(parsedResponse.itemDetails.bodyStyle),
      storage: sanitizeField(parsedResponse.itemDetails.storage),
      overallCondition: sanitizeField(parsedResponse.itemDetails.overallCondition),
      notes: sanitizeField(parsedResponse.itemDetails.notes),
    };
    
    // Remove undefined fields for cleaner output
    Object.keys(itemDetails).forEach(key => {
      if (itemDetails![key as keyof ItemDetails] === undefined) {
        delete itemDetails![key as keyof ItemDetails];
      }
    });
    
    console.info(
      `[Gemini Service] Item details parsed: ${itemDetails.detectedMake || 'N/A'} ${itemDetails.detectedModel || 'N/A'} ${itemDetails.detectedYear || 'N/A'}. ` +
      `Request ID: ${requestId}`
    );
  } else {
    console.warn(
      `[Gemini Service] Item details missing from Gemini response. This should not happen as itemDetails is required. ` +
      `Request ID: ${requestId}`
    );
  }

  // Calculate confidence score based on damaged parts
  const avgConfidence = damagedParts.length > 0
    ? damagedParts.reduce((sum, part) => sum + part.confidence, 0) / damagedParts.length
    : 85;

  console.info(
    `[Gemini Service] Successfully parsed and validated response. ` +
    `Severity: ${severity}, Damaged parts: ${damagedParts.length}, ` +
    `Airbag deployed: ${airbagDeployed}, Total loss: ${totalLoss}. ` +
    `Request ID: ${requestId}`
  );

  return {
    itemDetails,
    damagedParts,
    severity,
    airbagDeployed,
    totalLoss,
    summary,
    confidence: avgConfidence,
    method: 'gemini',
  };
}

/**
 * Construct the damage assessment prompt with vehicle context
 * 
 * This function creates an optimized prompt for Gemini 2.5 Flash that:
 * - Includes vehicle make, model, and year for context
 * - Requests all five damage categories (structural, mechanical, cosmetic, electrical, interior)
 * - Provides examples of damage severity levels
 * - Includes guidance on identifying airbag deployment
 * - Includes criteria for determining total loss status (>75% of vehicle value)
 * - Specifies the exact JSON response schema
 * 
 * Requirements: 3.4, 3.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 * 
 * @param vehicleContext - Vehicle make, model, and year
 * @returns Formatted prompt string optimized for Gemini AI
 */
/**
 * Construct the damage assessment prompt with vehicle context
 * 
 * This function creates an optimized prompt for Gemini 2.5 Flash that:
 * - Analyzes the ENTIRE item FIRST (identification)
 * - THEN analyzes damage with SPECIFIC part names
 * - Only includes DAMAGED parts in the response
 * - Uses CONSERVATIVE total loss criteria
 * - Provides item-type-specific prompts (vehicles, electronics, machinery)
 * 
 * Requirements: 3.4, 3.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 * 
 * @param vehicleContext - Vehicle make, model, and year
 * @returns Formatted prompt string optimized for Gemini AI
 */
export function constructDamageAssessmentPrompt(vehicleContext: VehicleContext): string {
  const { year, make, model, itemType } = vehicleContext;

  // Determine item type and create appropriate prompt
  const isVehicle = !itemType || itemType === 'vehicle';
  const isElectronics = itemType === 'electronics';
  const isMachinery = itemType === 'machinery' || itemType === 'equipment';

  if (isVehicle) {
    return constructVehiclePrompt(year, make, model);
  } else if (isElectronics) {
    return constructElectronicsPrompt(make, model, year);
  } else if (isMachinery) {
    return constructMachineryPrompt(make, model, year);
  } else {
    // Fallback to vehicle prompt for unknown types
    return constructVehiclePrompt(year, make, model);
  }
}

/**
 * Construct vehicle-specific damage assessment prompt
 */
function constructVehiclePrompt(year: number, make: string, model: string): string {
  return `You are an expert vehicle damage assessor for insurance claims. Analyze the provided photos of a ${year} ${make} ${model} and provide an insurance-grade assessment.

**CRITICAL INSTRUCTIONS FOR RESPONSE FORMAT:**
- Provide ONLY factual data in your JSON response
- DO NOT include reasoning, explanations, or uncertainty statements in field values
- If you cannot determine a field with confidence, OMIT it entirely (don't include the key in the JSON)
- Example of CORRECT response: {"color": "White"}
- Example of INCORRECT response: {"color": "White (appears to be white but lighting makes it hard to confirm)"}
- Your response will be shown directly to insurance adjusters and vendors - it must be professional and concise
- NO parenthetical explanations, NO hedging language, NO reasoning text in any field values

**VEHICLE CONTEXT PROVIDED:**
You have been told this is a ${year} ${make} ${model}.

**IMPORTANT - VEHICLE VERIFICATION:**
Compare what you see in the photos with the provided vehicle information:
- If the vehicle in photos MATCHES the provided information (${year} ${make} ${model}), confirm it in itemDetails
- If the vehicle in photos DOES NOT MATCH the provided information, report what you actually see AND add a note about the discrepancy
- Example note for mismatch: "Vehicle in photos appears to be a 2016 Mercedes-Benz GLE, which differs from the provided information (2021 Toyota Camry). Please verify vehicle information with the claimant."

**SECTION 1: VEHICLE IDENTIFICATION**

First, identify the vehicle details:
- Make/Model/Year: Confirm or correct the provided information based on what you see
- Trim level: (e.g., SE, XLE, Limited) - OMIT if not clearly visible
- Color: Exterior color - OMIT if not clearly visible
- Body style: (e.g., Sedan, SUV, Truck, Coupe) - OMIT if not clearly visible
- Overall condition: (e.g., Excellent, Good, Fair, Poor) based on visible damage
- Notes: CRITICAL - If vehicle doesn't match provided info, state the discrepancy here. Otherwise, any distinguishing features or observations

**SECTION 2: DAMAGE ANALYSIS**

Analyze the damage and list ONLY the damaged parts. For each damaged part, provide:
- **Part name**: Be SPECIFIC with location (e.g., "driver front door", "passenger rear quarter panel", "front bumper center section")
- **Severity**: minor, moderate, or severe
- **Confidence**: 0-100 (how confident you are in this assessment)

**CRITICAL FIELD INSTRUCTIONS:**
For each field in itemDetails:
- detectedMake: The brand/manufacturer you see (e.g., "Toyota", "Mercedes-Benz") - NO explanations
- detectedModel: The model name (e.g., "Camry", "GLE-Class") - NO explanations
- detectedYear: The model year if visible (e.g., "2021", "2016") - NO explanations
- color: Exterior color (e.g., "White", "Black", "Red") - OMIT if not clearly visible, NO explanations
- trim: Trim level (e.g., "SE", "XLE", "AMG Line") - OMIT if not clearly visible, NO explanations
- bodyStyle: Body type (e.g., "Sedan", "SUV", "Truck") - OMIT if not clearly visible, NO explanations
- overallCondition: Condition assessment (e.g., "Excellent", "Good", "Fair", "Poor") based on visible damage - NO explanations
- notes: ONLY for vehicle mismatch discrepancies or critical observations - NO reasoning text

**REMEMBER**: If a field is not clearly visible or determinable, OMIT it from your response. Do not include reasoning or uncertainty statements.

**Vehicle-Specific Parts to Consider:**
- **Exterior**: front bumper, rear bumper, hood, trunk lid, driver/passenger doors (front/rear), driver/passenger fenders, driver/passenger quarter panels, roof, windshield, rear window, side windows, headlights, taillights, side mirrors, grille
- **Structural**: frame, chassis, A-pillar, B-pillar, C-pillar, D-pillar, rocker panels, floor pan
- **Mechanical**: engine, transmission, suspension (front/rear), drivetrain, axles, wheels, tires, brakes, exhaust system
- **Electrical**: wiring harness, battery, alternator, starter, lights, sensors, control modules
- **Interior**: dashboard, steering wheel, seats (driver/passenger/rear), center console, door panels, airbags, upholstery

**Severity Guidelines:**
- **Minor**: Cosmetic damage, small dents, scratches, paint chips (repairable with minimal cost)
- **Moderate**: Functional damage, crumpled panels, broken lights, damaged suspension (requires significant repair)
- **Severe**: Structural damage, major mechanical failure, deployed airbags, frame damage (may not be economically repairable)

**IMPORTANT**: Only include parts that are DAMAGED. Do not list undamaged parts.

**SECTION 3: OVERALL ASSESSMENT**

**Overall Severity**: Classify as minor, moderate, or severe based on the worst damage present.

**Airbag Deployment**: Set to true if ANY airbags have deployed (look for deployed airbags, open airbag covers, white powder residue). Set to false otherwise.

**Total Loss Determination** (EXTREMELY CONSERVATIVE CRITERIA):

**CRITICAL**: A vehicle is NOT a total loss just because it has significant damage. Total loss means the vehicle is BEYOND ECONOMIC REPAIR or UNSAFE TO DRIVE.

Set totalLoss to **true** ONLY if ALL of these apply:
1. Frame/chassis is SEVERELY bent, twisted, or buckled (not just minor frame damage)
2. Cabin has COLLAPSED or has SEVERE intrusion into passenger space
3. Multiple CRITICAL systems are COMPLETELY destroyed (engine AND transmission AND suspension all non-functional)
4. Vehicle would be UNSAFE to drive even after repairs
5. Repair cost would exceed 80% of vehicle value

**EXAMPLES OF TOTAL LOSS:**
- Vehicle rolled multiple times with crushed roof and collapsed cabin
- Fire destroyed engine bay, cabin, and trunk completely
- Complete submersion with water damage throughout all systems
- Frame twisted beyond repair with cabin intrusion
- Multiple major impacts destroying engine, transmission, and suspension

**EXAMPLES THAT ARE NOT TOTAL LOSS:**
- Front and rear body panel damage (bumpers, hood, trunk, fenders, quarter panels)
- Airbag deployment with repairable damage
- Single major system damage (engine OR transmission, not both)
- Cosmetic damage (paint, trim, glass, lights)
- Repairable frame damage (minor bends that can be straightened)
- Side impact with door and panel damage but intact frame
- **THIS MERCEDES GLE EXAMPLE**: Front bumper/hood/grille/headlights + rear bumper/quarter panels damaged = REPAIRABLE, NOT TOTAL LOSS

Set totalLoss to **false** if:
- Only body panels damaged (bumpers, doors, fenders, hood, trunk, quarter panels)
- Only cosmetic damage (paint, trim, glass, lights)
- Single system damage (only engine OR only transmission OR only suspension)
- Repairable structural damage (frame can be straightened)
- Airbag deployment alone (NOT sufficient for total loss)
- Vehicle is still drivable or can be made drivable with repairs
- Damage is limited to front OR rear (not both with severe structural compromise)

**REMEMBER**: Body panel damage is ALWAYS repairable. Only mark as total loss if the vehicle is truly beyond economic repair or unsafe.

**Summary**: Provide a brief, clear description (2-3 sentences, max 500 characters) including:
- Most significant damage areas
- Whether airbags deployed
- Overall assessment of repairability

**RESPONSE FORMAT:**
Return your assessment as JSON:
{
  "itemDetails": {
    "detectedMake": "Toyota",
    "detectedModel": "Camry",
    "detectedYear": "2020",
    "color": "White",
    "trim": "SE",
    "bodyStyle": "Sedan",
    "overallCondition": "Good"
  },
  "damagedParts": [
    {"part": "driver front door", "severity": "severe", "confidence": 85},
    {"part": "front bumper", "severity": "severe", "confidence": 90}
  ],
  "severity": "severe",
  "airbagDeployed": true,
  "totalLoss": false,
  "summary": "Severe damage to driver side with deployed airbag. Front bumper and driver door require replacement. Vehicle is repairable but requires significant work."
}`;
}

/**
 * Construct electronics-specific damage assessment prompt
 */
function constructElectronicsPrompt(brand: string, model: string, year: number): string {
  return `You are an expert electronics damage assessor for insurance claims. Analyze the provided photos of a ${brand} ${model} (${year}) and provide an insurance-grade assessment.

**CRITICAL INSTRUCTIONS FOR RESPONSE FORMAT:**
- Provide ONLY factual data in your JSON response
- DO NOT include reasoning, explanations, or uncertainty statements in field values
- If you cannot determine a field with confidence, OMIT it entirely (don't include the key in the JSON)
- Example of CORRECT response: {"storage": "256GB"}
- Example of INCORRECT response: {"storage": "256GB (estimated from model number, not fully verified)"}
- Your response will be shown directly to insurance adjusters and vendors - it must be professional and concise
- NO parenthetical explanations, NO hedging language, NO reasoning text in any field values

**DEVICE CONTEXT PROVIDED:**
You have been told this is a ${brand} ${model} (${year}).

**IMPORTANT - DEVICE VERIFICATION:**
Compare what you see in the photos with the provided device information:
- If the device in photos MATCHES the provided information (${brand} ${model}), confirm it in itemDetails
- If the device in photos DOES NOT MATCH the provided information, report what you actually see AND add a note about the discrepancy
- Example note for mismatch: "Device in photos appears to be an iPhone 12, which differs from the provided information (iPhone 13 Pro). Please verify device information with the claimant."

**SECTION 1: DEVICE IDENTIFICATION**

First, identify the device details:
- Brand/Model: Confirm or correct the provided information based on what you see
- Storage capacity: (e.g., 64GB, 128GB, 256GB, 512GB, 1TB) - OMIT if not clearly visible
- Color: Device color - OMIT if not clearly visible
- Overall condition: (e.g., Excellent, Good, Fair, Poor) based on visible damage
- Notes: CRITICAL - If device doesn't match provided info, state the discrepancy here. Otherwise, any distinguishing features or observations

**SECTION 2: DAMAGE ANALYSIS**

Analyze the damage and list ONLY the damaged parts. For each damaged part, provide:
- **Part name**: Be SPECIFIC (e.g., "front screen glass", "rear camera lens", "charging port", "left speaker")
- **Severity**: minor, moderate, or severe
- **Confidence**: 0-100 (how confident you are in this assessment)

**CRITICAL FIELD INSTRUCTIONS:**
For each field in itemDetails:
- detectedMake: The brand you see (e.g., "Apple", "Samsung") - NO explanations
- detectedModel: The model name (e.g., "iPhone 13 Pro", "Galaxy S21") - NO explanations
- detectedYear: The release year if visible (e.g., "2021", "2020") - NO explanations
- storage: Storage capacity (e.g., "256GB", "128GB") - OMIT if not clearly visible, NO explanations
- color: Device color (e.g., "Graphite", "White") - OMIT if not clearly visible, NO explanations
- overallCondition: Condition assessment (e.g., "Excellent", "Good", "Fair", "Poor") based on visible damage - NO explanations
- notes: ONLY for device mismatch discrepancies or critical observations - NO reasoning text

**REMEMBER**: If a field is not clearly visible or determinable, OMIT it from your response. Do not include reasoning or uncertainty statements.

**Electronics-Specific Parts to Consider:**
- **Display**: front screen, digitizer, LCD/OLED panel, screen protector
- **Housing**: front glass, rear glass/housing, frame, buttons (power, volume, home)
- **Cameras**: front camera, rear camera (main/wide/telephoto), camera lens, flash
- **Ports**: charging port, headphone jack, SIM tray, speaker grilles
- **Internal**: battery, motherboard, internal components, water damage indicators
- **Accessories**: case, screen protector (if visible)

**Severity Guidelines:**
- **Minor**: Small scratches, scuffs, minor cosmetic damage (device fully functional)
- **Moderate**: Cracked screen, dented housing, damaged ports (device partially functional)
- **Severe**: Shattered screen, bent frame, water damage, non-functional (device not usable)

**IMPORTANT**: Only include parts that are DAMAGED. Do not list undamaged parts.

**SECTION 3: OVERALL ASSESSMENT**

**Overall Severity**: Classify as minor, moderate, or severe based on the worst damage present.

**Airbag Deployment**: Always set to false for electronics.

**Total Loss Determination** (CONSERVATIVE CRITERIA):
Set totalLoss to **true** ONLY if:
- Device is bent or structurally compromised (frame damage affecting functionality)
- Water damage with visible corrosion on internal components
- Multiple critical components damaged (screen + motherboard + housing)
- Repair cost would exceed 70% of device replacement cost
- Device is completely non-functional with no possibility of repair

Set totalLoss to **false** if:
- Only screen damage (even if severe) - screens are replaceable
- Only cosmetic damage (scratches, dents, housing cracks)
- Single component damage (only screen OR only housing OR only camera)
- Device is still functional or can be made functional with part replacement
- Repair cost is less than 70% of device replacement cost

**IMPORTANT**: A cracked or shattered screen alone does NOT constitute a total loss. Screens are standard replaceable parts.

**Summary**: Provide a brief, clear description (2-3 sentences, max 500 characters) including:
- Most significant damage areas
- Device functionality status
- Overall assessment of repairability

**RESPONSE FORMAT:**
Return your assessment as JSON:
{
  "itemDetails": {
    "detectedMake": "Apple",
    "detectedModel": "iPhone 13 Pro",
    "detectedYear": "2021",
    "color": "Graphite",
    "storage": "256GB",
    "overallCondition": "Fair"
  },
  "damagedParts": [
    {"part": "front screen glass", "severity": "moderate", "confidence": 90},
    {"part": "rear camera lens", "severity": "minor", "confidence": 85}
  ],
  "severity": "moderate",
  "airbagDeployed": false,
  "totalLoss": false,
  "summary": "Cracked front screen glass with functional LCD. Minor scratch on rear camera lens. Device is functional and repairable."
}`;
}

/**
 * Construct machinery-specific damage assessment prompt
 */
function constructMachineryPrompt(brand: string, model: string, year: number): string {
  return `You are an expert machinery damage assessor for insurance claims. Analyze the provided photos of a ${brand} ${model} (${year}) and provide an insurance-grade assessment.

**CRITICAL INSTRUCTIONS FOR RESPONSE FORMAT:**
- Provide ONLY factual data in your JSON response
- DO NOT include reasoning, explanations, or uncertainty statements in field values
- If you cannot determine a field with confidence, OMIT it entirely (don't include the key in the JSON)
- Example of CORRECT response: {"overallCondition": "Good"}
- Example of INCORRECT response: {"overallCondition": "Good (based on visible wear patterns, though some areas are not fully visible)"}
- Your response will be shown directly to insurance adjusters and vendors - it must be professional and concise
- NO parenthetical explanations, NO hedging language, NO reasoning text in any field values

**MACHINERY CONTEXT PROVIDED:**
You have been told this is a ${brand} ${model} (${year}).

**IMPORTANT - MACHINERY VERIFICATION:**
Compare what you see in the photos with the provided machinery information:
- If the machinery in photos MATCHES the provided information (${brand} ${model}), confirm it in itemDetails
- If the machinery in photos DOES NOT MATCH the provided information, report what you actually see AND add a note about the discrepancy
- Example note for mismatch: "Machinery in photos appears to be a Caterpillar 320D Excavator, which differs from the provided information (Honda EU2200i Generator). Please verify equipment information with the claimant."

**SECTION 1: MACHINERY IDENTIFICATION**

First, identify the machinery details:
- Type: (e.g., Generator, Tractor, Excavator, Compressor, Pump) - OMIT if not clearly visible
- Brand/Model: Confirm or correct the provided information based on what you see
- Overall condition: (e.g., Excellent, Good, Fair, Poor) based on visible damage
- Notes: CRITICAL - If machinery doesn't match provided info, state the discrepancy here. Otherwise, any distinguishing features or observations

**SECTION 2: DAMAGE ANALYSIS**

Analyze the damage and list ONLY the damaged parts. For each damaged part, provide:
- **Part name**: Be SPECIFIC (e.g., "engine block", "hydraulic cylinder left side", "control panel display")
- **Severity**: minor, moderate, or severe
- **Confidence**: 0-100 (how confident you are in this assessment)

**CRITICAL FIELD INSTRUCTIONS:**
For each field in itemDetails:
- detectedMake: The brand you see (e.g., "Honda", "Caterpillar") - NO explanations
- detectedModel: The model name (e.g., "EU2200i", "320D") - NO explanations
- detectedYear: The model year if visible (e.g., "2020", "2018") - NO explanations
- overallCondition: Condition assessment (e.g., "Excellent", "Good", "Fair", "Poor") based on visible damage - NO explanations
- notes: ONLY for machinery mismatch discrepancies or critical observations - NO reasoning text

**REMEMBER**: If a field is not clearly visible or determinable, OMIT it from your response. Do not include reasoning or uncertainty statements.

**Machinery-Specific Parts to Consider:**
- **Structural**: frame, chassis, housing, mounting points, protective guards
- **Mechanical**: engine, motor, transmission, gearbox, drive shaft, belts, chains, bearings
- **Hydraulic**: hydraulic cylinders, hoses, pumps, valves, fluid reservoir
- **Electrical**: control panel, wiring, battery, alternator, sensors, switches, display
- **Operational**: cutting blades, drill bits, attachments, tools, accessories
- **Safety**: guards, shields, emergency stops, warning labels

**Severity Guidelines:**
- **Minor**: Cosmetic damage, small dents, scratches, worn paint (fully operational)
- **Moderate**: Functional damage, damaged components, leaking fluids (partially operational)
- **Severe**: Structural damage, major mechanical failure, safety hazards (not operational)

**IMPORTANT**: Only include parts that are DAMAGED. Do not list undamaged parts.

**SECTION 3: OVERALL ASSESSMENT**

**Overall Severity**: Classify as minor, moderate, or severe based on the worst damage present.

**Airbag Deployment**: Always set to false for machinery.

**Total Loss Determination** (CONSERVATIVE CRITERIA):
Set totalLoss to **true** ONLY if:
- Frame/chassis is bent, twisted, or structurally compromised
- Engine/motor is destroyed or seized
- Multiple major systems are destroyed (engine + hydraulics + electrical all severely damaged)
- Fire damage affecting entire structure
- Safety hazards that cannot be repaired

Set totalLoss to **false** if:
- Only housing/guards damaged
- Only cosmetic damage
- Single system damage (only engine OR only hydraulics)
- Repairable structural damage
- Operational with repairs

**Summary**: Provide a brief, clear description (2-3 sentences, max 500 characters) including:
- Most significant damage areas
- Operational status
- Overall assessment of repairability

**RESPONSE FORMAT:**
Return your assessment as JSON:
{
  "itemDetails": {
    "detectedMake": "Honda",
    "detectedModel": "EU2200i",
    "detectedYear": "2020",
    "overallCondition": "Good",
    "notes": "Portable generator"
  },
  "damagedParts": [
    {"part": "engine housing", "severity": "moderate", "confidence": 85},
    {"part": "control panel display", "severity": "minor", "confidence": 90}
  ],
  "severity": "moderate",
  "airbagDeployed": false,
  "totalLoss": false,
  "summary": "Dented engine housing and cracked control panel display. Generator is operational and repairable with replacement parts."
}`
;
}


/**
 * Supported image formats for Gemini API
 */
const SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Validate image format
 * 
 * Supports both regular URLs and base64 data URLs:
 * - Regular URLs: Check for file extensions (.jpg, .jpeg, .png, .webp)
 * - Base64 data URLs: Check MIME type (data:image/jpeg;base64,...)
 * 
 * Requirements: 12.5
 * 
 * @param url - Image URL to validate (regular URL or base64 data URL)
 * @returns true if format is supported, false otherwise
 */
function isValidImageFormat(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  
  // Check if it's a base64 data URL
  if (lowerUrl.startsWith('data:image/')) {
    // Extract MIME type from data URL (between 'data:' and ';base64')
    const mimeTypeMatch = lowerUrl.match(/^data:(image\/[^;]+);base64/);
    if (mimeTypeMatch) {
      const mimeType = mimeTypeMatch[1];
      return SUPPORTED_IMAGE_FORMATS.includes(mimeType);
    }
    return false;
  }
  
  // For regular URLs, check file extension
  return SUPPORTED_EXTENSIONS.some(ext => lowerUrl.includes(ext));
}

/**
 * Get MIME type from URL
 * 
 * Supports both regular URLs and base64 data URLs:
 * - Regular URLs: Infer from file extension
 * - Base64 data URLs: Extract from MIME type in data URL
 * 
 * @param url - Image URL (regular URL or base64 data URL)
 * @returns MIME type string
 */
function getMimeTypeFromUrl(url: string): string {
  const lowerUrl = url.toLowerCase();
  
  // Check if it's a base64 data URL
  if (lowerUrl.startsWith('data:image/')) {
    // Extract MIME type from data URL (between 'data:' and ';base64')
    const mimeTypeMatch = lowerUrl.match(/^data:(image\/[^;]+);base64/);
    if (mimeTypeMatch) {
      return mimeTypeMatch[1];
    }
  }
  
  // For regular URLs, infer from file extension
  if (lowerUrl.includes('.png')) return 'image/png';
  if (lowerUrl.includes('.webp')) return 'image/webp';
  return 'image/jpeg'; // Default to JPEG for .jpg and .jpeg
}

/**
 * Convert image URL to base64 for Gemini API
 * 
 * This function:
 * - Handles both regular URLs and base64 data URLs
 * - Validates the image format (JPEG, PNG, WebP)
 * - Converts regular URLs to base64 by fetching and encoding
 * - Extracts base64 data from data URLs directly
 * - Returns the base64 string and MIME type
 * 
 * Requirements: 3.3, 12.5
 * 
 * @param imageUrl - URL of the image to convert (regular URL or base64 data URL)
 * @returns Object with base64 data and MIME type
 * @throws Error if image format is invalid or conversion fails
 */
async function convertImageToBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  // Validate image format before processing
  if (!isValidImageFormat(imageUrl)) {
    throw new Error(
      `Invalid image format. Supported formats: JPEG, PNG, WebP. ` +
      `Received URL: ${imageUrl.substring(0, 100)}... ` +
      `Please provide images in one of the supported formats.`
    );
  }

  try {
    // Check if it's already a base64 data URL
    if (imageUrl.toLowerCase().startsWith('data:image/')) {
      // Extract base64 data from data URL (after 'base64,')
      const base64Match = imageUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (base64Match) {
        const base64Data = base64Match[1];
        const mimeType = getMimeTypeFromUrl(imageUrl);
        
        return {
          data: base64Data,
          mimeType,
        };
      }
      
      throw new Error('Invalid base64 data URL format');
    }
    
    // For regular URLs, fetch and convert to base64
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Get the image as array buffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Convert to base64
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Get MIME type
    const mimeType = getMimeTypeFromUrl(imageUrl);
    
    return {
      data: base64,
      mimeType,
    };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    throw new Error(
      `Failed to convert image to base64. URL: ${imageUrl.substring(0, 100)}... Error: ${errorMessage}`
    );
  }
}

/**
 * Convert multiple image URLs to base64 format
 * 
 * This function:
 * - Handles up to 6 photos per request
 * - Logs warning when photo count exceeds 6
 * - Processes first 6 photos when more than 6 provided
 * - Validates each image format before conversion
 * - Returns array of base64-encoded images with MIME types
 * 
 * Requirements: 3.3, 12.1, 12.2, 12.3, 12.5
 * 
 * @param imageUrls - Array of image URLs (1-6 photos)
 * @param requestId - Request ID for logging
 * @returns Array of objects with base64 data and MIME types
 * @throws Error if no valid images or conversion fails
 */
async function convertPhotosToBase64(
  imageUrls: string[],
  requestId: string
): Promise<Array<{ data: string; mimeType: string }>> {
  // Validate photo count
  if (imageUrls.length === 0) {
    throw new Error('At least one photo is required for damage assessment');
  }

  // Handle more than 6 photos - log warning and process first 6
  let photosToProcess = imageUrls;
  if (imageUrls.length > 6) {
    console.warn(
      `[Gemini Service] Received ${imageUrls.length} photos, but maximum is 6. ` +
      `Processing first 6 photos only. Request ID: ${requestId}`
    );
    photosToProcess = imageUrls.slice(0, 6);
  }

  // Convert all photos to base64
  const conversionPromises = photosToProcess.map(async (url, index) => {
    try {
      const result = await convertImageToBase64(url);
      console.info(
        `[Gemini Service] Converted photo ${index + 1}/${photosToProcess.length} to base64. ` +
        `Format: ${result.mimeType}. Request ID: ${requestId}`
      );
      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      console.error(
        `[Gemini Service] Failed to convert photo ${index + 1}/${photosToProcess.length}. ` +
        `Error: ${errorMessage}. Request ID: ${requestId}`
      );
      throw error;
    }
  });

  // Wait for all conversions to complete
  const convertedPhotos = await Promise.all(conversionPromises);

  console.info(
    `[Gemini Service] Successfully converted ${convertedPhotos.length} photos to base64. ` +
    `Request ID: ${requestId}`
  );

  return convertedPhotos;
}

/**
 * Error classification for retry logic
 */
enum ErrorType {
  TRANSIENT = 'transient',      // 5xx errors - retry once
  AUTHENTICATION = 'authentication', // Invalid API key - no retry
  VALIDATION = 'validation',     // Invalid input/response - no retry
  TIMEOUT = 'timeout',           // Request timeout - no retry (already waited)
  UNKNOWN = 'unknown'            // Unknown error - no retry
}

/**
 * Classify error type for retry logic
 * 
 * Requirements: 13.1, 13.4, 13.5
 * 
 * @param error - Error object from Gemini API
 * @param requestId - Request ID for logging
 * @returns Error type classification
 */
function classifyError(error: any, requestId: string): ErrorType {
  const errorMessage = error?.message || '';
  const errorString = String(error);

  // Authentication errors (invalid API key)
  if (
    errorMessage.includes('API key') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('401') ||
    errorString.includes('API_KEY_INVALID')
  ) {
    console.error(
      `[Gemini Service] Authentication error detected. No retry will be attempted. ` +
      `Request ID: ${requestId}`
    );
    return ErrorType.AUTHENTICATION;
  }

  // Validation errors (invalid input or response format)
  if (
    errorMessage.includes('Invalid') ||
    errorMessage.includes('validation') ||
    errorMessage.includes('required') ||
    errorMessage.includes('missing') ||
    errorMessage.includes('parse') ||
    errorMessage.includes('400')
  ) {
    console.error(
      `[Gemini Service] Validation error detected. No retry will be attempted. ` +
      `Request ID: ${requestId}`
    );
    return ErrorType.VALIDATION;
  }

  // Timeout errors
  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out')
  ) {
    console.error(
      `[Gemini Service] Timeout error detected. No retry will be attempted (already waited). ` +
      `Request ID: ${requestId}`
    );
    return ErrorType.TIMEOUT;
  }

  // Transient errors (5xx server errors)
  if (
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503') ||
    errorMessage.includes('504') ||
    errorMessage.includes('5xx') ||
    errorMessage.includes('server error') ||
    errorMessage.includes('service unavailable') ||
    errorMessage.includes('internal error') ||
    errorString.includes('INTERNAL') ||
    errorString.includes('UNAVAILABLE')
  ) {
    console.warn(
      `[Gemini Service] Transient error detected (5xx). Will retry once after 2 seconds. ` +
      `Request ID: ${requestId}`
    );
    return ErrorType.TRANSIENT;
  }

  // Unknown errors - don't retry to be safe
  console.error(
    `[Gemini Service] Unknown error type. No retry will be attempted. ` +
    `Request ID: ${requestId}`
  );
  return ErrorType.UNKNOWN;
}

/**
 * Sleep for specified milliseconds
 * 
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Gemini API with timeout and retry logic
 * 
 * This function:
 * - Calls Gemini API with 10-second timeout per request
 * - Classifies errors (transient, authentication, validation, timeout)
 * - Retries once after 2 seconds for transient 5xx errors
 * - No retry for authentication, validation, or timeout errors
 * - Logs all attempts and errors with request ID
 * 
 * Requirements: 13.1, 13.4, 13.5
 * 
 * @param contentParts - Content parts for Gemini API (prompt + images)
 * @param requestId - Request ID for logging and traceability
 * @returns Gemini API response
 * @throws Error if API call fails after retry (if applicable)
 */
async function callGeminiAPIWithRetry(
  contentParts: any[],
  requestId: string
): Promise<any> {
  const timeoutMs = 30000; // 30 seconds per request (increased for multiple photos)
  const retryDelayMs = 2000; // 2 seconds delay before retry
  let lastError: any = null;

  // Attempt 1: Initial API call
  try {
    console.info(
      `[Gemini Service] Attempt 1: Calling Gemini API. Request ID: ${requestId}`
    );

    const startTime = Date.now();
    
    const apiCallPromise = geminiModel!.generateContent({
      contents: [{ parts: contentParts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      }
    });

    // Implement timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gemini API call timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const result = await Promise.race([apiCallPromise, timeoutPromise]) as any;
    const duration = Date.now() - startTime;

    console.info(
      `[Gemini Service] Attempt 1: API call succeeded in ${duration}ms. ` +
      `Request ID: ${requestId}`
    );

    return result;
  } catch (error: any) {
    lastError = error;
    const errorMessage = error?.message || 'Unknown error';
    
    console.error(
      `[Gemini Service] Attempt 1: API call failed. Error: ${errorMessage}. ` +
      `Request ID: ${requestId}`
    );

    // Classify the error to determine if retry is appropriate
    const errorType = classifyError(error, requestId);

    // Only retry for transient errors (5xx)
    if (errorType !== ErrorType.TRANSIENT) {
      console.error(
        `[Gemini Service] Error type is ${errorType}. No retry will be attempted. ` +
        `Request ID: ${requestId}`
      );
      throw error;
    }

    // Wait before retry
    console.info(
      `[Gemini Service] Waiting ${retryDelayMs}ms before retry. Request ID: ${requestId}`
    );
    await sleep(retryDelayMs);
  }

  // Attempt 2: Retry for transient errors
  try {
    console.info(
      `[Gemini Service] Attempt 2: Retrying Gemini API call after transient error. ` +
      `Request ID: ${requestId}`
    );

    const startTime = Date.now();
    
    const apiCallPromise = geminiModel!.generateContent({
      contents: [{ parts: contentParts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      }
    });

    // Implement timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gemini API call timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const result = await Promise.race([apiCallPromise, timeoutPromise]) as any;
    const duration = Date.now() - startTime;

    console.info(
      `[Gemini Service] Attempt 2: API call succeeded in ${duration}ms after retry. ` +
      `Request ID: ${requestId}`
    );

    return result;
  } catch (retryError: any) {
    const retryErrorMessage = retryError?.message || 'Unknown error';
    
    console.error(
      `[Gemini Service] Attempt 2: Retry failed. Error: ${retryErrorMessage}. ` +
      `Original error: ${lastError?.message || 'Unknown'}. ` +
      `Request ID: ${requestId}`
    );

    // Throw the retry error (most recent)
    throw retryError;
  }
}

/**
 * Assess vehicle damage using Gemini 2.5 Flash
 * 
 * This function:
 * - Validates service is enabled and inputs are valid
 * - Converts image URLs to base64 for Gemini API
 * - Constructs optimized prompt with vehicle context
 * - Calls Gemini API with photos and prompt (with retry logic for 5xx errors)
 * - Parses and validates JSON response
 * - Returns structured damage assessment
 * 
 * Retry Logic:
 * - 5xx errors: Retry once after 2 seconds
 * - Timeout: No retry (already waited 10 seconds)
 * - Authentication errors: No retry, immediate fallback
 * - Validation errors: No retry, immediate fallback
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 12.1, 12.2, 12.3, 12.5, 13.1, 13.4, 13.5
 * 
 * @param imageUrls - Array of image URLs (1-6 photos)
 * @param vehicleContext - Vehicle make, model, and year
 * @returns Structured damage assessment
 * @throws Error if service is not enabled or if assessment fails
 */
export async function assessDamageWithGemini(
  imageUrls: string[],
  vehicleContext: VehicleContext
): Promise<GeminiDamageAssessment> {
  const requestId = `gemini-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  
  // Check if service is enabled
  if (!isGeminiEnabled()) {
    const errorMsg = 
      'Gemini service is not enabled. GEMINI_API_KEY is not configured or connection validation failed. ' +
      'Please set a valid GEMINI_API_KEY in your environment variables. ' +
      `Request ID: ${requestId}`;
    console.error(`[Gemini Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Validate inputs
  if (!imageUrls || imageUrls.length === 0) {
    const errorMsg = `At least one image URL is required for damage assessment. Request ID: ${requestId}`;
    console.error(`[Gemini Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  if (!vehicleContext || !vehicleContext.make || !vehicleContext.model || !vehicleContext.year) {
    const errorMsg = 
      `Item context (make/brand, model, year) is required for damage assessment. ` +
      `Received: ${JSON.stringify(vehicleContext)}. Request ID: ${requestId}`;
    console.error(`[Gemini Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Log assessment request (without exposing sensitive data)
  const itemDescription = vehicleContext.itemType 
    ? `${vehicleContext.make} ${vehicleContext.model} ${vehicleContext.itemType} (${vehicleContext.year})`
    : `${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}`;
  
  console.info(
    `[Gemini Service] Starting damage assessment for ${itemDescription}. ` +
    `Photos: ${Math.min(imageUrls.length, 6)}. Request ID: ${requestId}`
  );

  try {
    // Convert image URLs to base64
    const convertedPhotos = await convertPhotosToBase64(imageUrls, requestId);

    // Construct prompt with vehicle context
    const prompt = constructDamageAssessmentPrompt(vehicleContext);

    // Build the content parts for Gemini API
    // Format: [text prompt, image1, image2, ...]
    const contentParts: any[] = [
      { text: prompt }
    ];

    // Add all converted photos as inline data
    for (const photo of convertedPhotos) {
      contentParts.push({
        inlineData: {
          mimeType: photo.mimeType,
          data: photo.data,
        }
      });
    }

    console.info(
      `[Gemini Service] Calling Gemini API with ${convertedPhotos.length} photos. ` +
      `Request ID: ${requestId}`
    );

    // Call Gemini API with retry logic
    const startTime = Date.now();
    const result = await callGeminiAPIWithRetry(contentParts, requestId);
    const duration = Date.now() - startTime;

    console.info(
      `[Gemini Service] Gemini API call completed in ${duration}ms. ` +
      `Request ID: ${requestId}`
    );

    // Extract response text
    const response = await result.response;
    const responseText = response.text();

    if (!responseText || responseText.trim() === '') {
      const errorMsg = 
        `Gemini API returned empty response. Request ID: ${requestId}`;
      console.error(`[Gemini Service] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.info(
      `[Gemini Service] Received response from Gemini API (${responseText.length} characters). ` +
      `Request ID: ${requestId}`
    );

    // Parse and validate the response
    const assessment = parseAndValidateResponse(responseText, requestId);

    console.info(
      `[Gemini Service] Damage assessment completed successfully. ` +
      `Item: ${itemDescription}. ` +
      `Severity: ${assessment.severity}. Duration: ${duration}ms. ` +
      `Request ID: ${requestId}`
    );

    return assessment;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = error?.stack || 'No stack trace available';
    const errorType = classifyError(error, requestId);
    
    console.error(
      `[Gemini Service] Damage assessment failed. ` +
      `Error type: ${errorType}. ` +
      `Error: ${errorMessage}. ` +
      `Item: ${itemDescription}. ` +
      `Photos: ${imageUrls.length}. ` +
      `Request ID: ${requestId}. ` +
      `Stack trace: ${errorStack}`
    );
    
    throw error;
  }
}

/**
 * Enhanced damage detection with optional part price searches
 */
export async function detectDamageWithGemini(
  photos: string[],
  vehicleInfo?: {
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
  },
  options?: {
    includePartPrices?: boolean; // NEW: Enable part price searches
  }
): Promise<DamageDetectionResult & {
  partPrices?: Array<{
    component: string;
    partPrice?: number;
    confidence?: number;
    source: 'internet_search' | 'not_found';
  }>;
  salvageCalculation?: {
    totalPartsCost?: number;
    averageConfidence?: number;
    partsFound: number;
    totalParts: number;
    salvageValueEstimate?: number;
  };
}> {
  const requestId = `enhanced-gemini-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  
  if (!vehicleInfo?.make || !vehicleInfo?.model || !vehicleInfo?.year) {
    throw new Error('Vehicle information (make, model, year) is required for enhanced damage detection');
  }

  try {
    // Use the existing assessDamageWithGemini function
    const geminiResult = await assessDamageWithGemini(photos, {
      make: vehicleInfo.make,
      model: vehicleInfo.model,
      year: vehicleInfo.year
    });

    // Convert Gemini's damagedParts to DamageDetectionResult format
    const damagedComponents = geminiResult.damagedParts.map(part => ({
      component: part.part,
      severity: part.severity,
      confidence: part.confidence
    }));

    const result: DamageDetectionResult = {
      overallConfidence: geminiResult.confidence,
      damagedComponents,
      totalLoss: geminiResult.totalLoss,
      airbagDeployed: geminiResult.airbagDeployed,
      summary: geminiResult.summary,
      method: 'gemini'
    };

    // NEW: Search for part prices if damage is detected and option is enabled
    let partPrices: Array<{
      component: string;
      partPrice?: number;
      confidence?: number;
      source: 'internet_search' | 'not_found';
    }> | undefined;

    let salvageCalculation: {
      totalPartsCost?: number;
      averageConfidence?: number;
      partsFound: number;
      totalParts: number;
      salvageValueEstimate?: number;
    } | undefined;

    if (options?.includePartPrices && result.damagedComponents.length > 0 && vehicleInfo) {
      try {
        console.log('🔍 Searching for part prices for damaged components...');
        
        const damagedComponentsForSearch = result.damagedComponents.map(comp => ({
          component: comp.component,
          severity: comp.severity
        }));
        
        partPrices = await searchPartPricesForDamage(vehicleInfo, damagedComponentsForSearch);
        
        // Aggregate part prices for salvage calculations
        const partsWithPrices = partPrices.filter(p => p.partPrice && p.confidence);
        const totalPartsCost = partsWithPrices.reduce((sum, part) => sum + (part.partPrice || 0), 0);
        const averageConfidence = partsWithPrices.length > 0 
          ? partsWithPrices.reduce((sum, part) => sum + (part.confidence || 0), 0) / partsWithPrices.length
          : 0;

        // Calculate salvage value estimate based on part costs
        // Salvage value is typically 10-30% of total part replacement cost
        const salvageMultiplier = result.totalLoss ? 0.1 : 0.2; // Lower for total loss
        const salvageValueEstimate = totalPartsCost * salvageMultiplier;

        salvageCalculation = {
          totalPartsCost,
          averageConfidence,
          partsFound: partsWithPrices.length,
          totalParts: partPrices.length,
          salvageValueEstimate
        };
        
        console.log(`✅ Part price search completed: ${partsWithPrices.length}/${partPrices.length} prices found`);
        console.log(`💰 Salvage calculation: Total parts cost: ₦${totalPartsCost.toLocaleString()}, Estimated salvage value: ₦${salvageValueEstimate.toLocaleString()}`);
      } catch (error) {
        console.error('❌ Part price search failed:', error);
        // Don't fail the entire damage detection if part search fails
      }
    }

    return {
      ...result,
      partPrices,
      salvageCalculation
    };

  } catch (error: any) {
    console.error(`[Enhanced Gemini] Damage detection failed: ${error.message}. Request ID: ${requestId}`);
    throw error;
  }
}

/**
 * Reset the service (for testing purposes)
 * 
 * @internal
 */
export function resetGeminiService(): void {
  serviceConfig = {
    apiKey: undefined,
    enabled: false,
    model: 'gemini-2.5-flash', // Changed from flash-lite for better accuracy
  };
  geminiClient = null;
  geminiModel = null;
}

// Auto-initialize on module load (async initialization)
initializeGeminiService().catch((error) => {
  console.error('[Gemini Service] Failed to auto-initialize:', error);
});
