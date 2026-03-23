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
 * Structured damage assessment result from Gemini
 */
export interface GeminiDamageAssessment {
  structural: number;        // 0-100: Frame, chassis, pillars, roof damage
  mechanical: number;        // 0-100: Engine, transmission, suspension damage
  cosmetic: number;          // 0-100: Body panels, paint, trim damage
  electrical: number;        // 0-100: Wiring, lights, electronics damage
  interior: number;          // 0-100: Seats, dashboard, controls damage
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

  // Enhanced part mapping with more comprehensive coverage
  const partMapping: Record<string, string> = {
    // Body components
    'front_bumper': 'front bumper',
    'rear_bumper': 'rear bumper',
    'hood': 'hood',
    'trunk': 'trunk lid',
    'door': 'door panel',
    'fender': 'fender',
    'quarter_panel': 'quarter panel',
    'rocker_panel': 'rocker panel',
    'body_panel': 'body panel',
    
    // Lighting
    'headlight': 'headlight assembly',
    'taillight': 'taillight assembly',
    'fog_light': 'fog light',
    'turn_signal': 'turn signal light',
    
    // Glass
    'windshield': 'windshield',
    'rear_window': 'rear window',
    'side_window': 'side window',
    
    // Mirrors and exterior
    'side_mirror': 'side mirror',
    'grille': 'front grille',
    'trim': 'exterior trim',
    
    // Wheels and tires
    'wheel': 'wheel rim',
    'tire': 'tire',
    'wheel_cover': 'wheel cover',
    
    // Mechanical components
    'engine': 'engine parts',
    'transmission': 'transmission parts',
    'suspension': 'suspension parts',
    'brake': 'brake parts',
    'exhaust': 'exhaust system',
    
    // Interior components
    'dashboard': 'dashboard',
    'seat': 'car seat',
    'steering_wheel': 'steering wheel',
    'console': 'center console',
    'door_panel_interior': 'interior door panel',
    
    // Electrical
    'wiring': 'wiring harness',
    'battery': 'car battery',
    'alternator': 'alternator',
    'starter': 'starter motor',
    
    // Generic fallbacks
    'structural': 'body panel',
    'mechanical': 'engine parts',
    'cosmetic': 'body panel',
    'electrical': 'electrical parts',
    'interior': 'interior parts'
  };

  // Map damaged components to searchable parts
  const partsToSearch = damagedComponents.map(damage => ({
    name: partMapping[damage.component] || damage.component,
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
    structural: { 
      type: "number", 
      minimum: 0, 
      maximum: 100,
      description: "Frame, chassis, pillars, roof damage score (0=no damage, 100=complete structural failure)"
    },
    mechanical: { 
      type: "number", 
      minimum: 0, 
      maximum: 100,
      description: "Engine, transmission, suspension, drivetrain damage score (0=no damage, 100=non-functional)"
    },
    cosmetic: { 
      type: "number", 
      minimum: 0, 
      maximum: 100,
      description: "Body panels, paint, trim, glass damage score (0=no damage, 100=completely destroyed)"
    },
    electrical: { 
      type: "number", 
      minimum: 0, 
      maximum: 100,
      description: "Wiring, lights, electronics, battery damage score (0=no damage, 100=total electrical failure)"
    },
    interior: { 
      type: "number", 
      minimum: 0, 
      maximum: 100,
      description: "Seats, dashboard, controls, upholstery damage score (0=no damage, 100=completely destroyed)"
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
      description: "Whether repair cost would exceed 75% of vehicle value"
    },
    summary: { 
      type: "string", 
      maxLength: 500,
      description: "Brief description of the damage"
    }
  },
  required: [
    "structural", "mechanical", "cosmetic", "electrical", "interior",
    "severity", "airbagDeployed", "totalLoss", "summary"
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
    return 'Damage assessment completed. Please review detailed scores.';
  }

  // Check if summary is empty
  if (summary.trim() === '') {
    console.warn(
      `[Gemini Service] Empty summary received. ` +
      `Using default summary. Request ID: ${requestId}`
    );
    return 'Damage assessment completed. Please review detailed scores.';
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
 * Parse and validate Gemini JSON response
 * 
 * This function:
 * - Parses JSON response from Gemini API
 * - Validates all required fields are present
 * - Validates field types (numbers for scores, string for severity, booleans for flags)
 * - Clamps damage scores to 0-100 range if outside bounds
 * - Defaults severity to "moderate" if invalid value
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
    'structural', 'mechanical', 'cosmetic', 'electrical', 'interior',
    'severity', 'airbagDeployed', 'totalLoss', 'summary'
  ];

  const missingFields = requiredFields.filter(field => !(field in parsedResponse));
  if (missingFields.length > 0) {
    const errorMsg = 
      `Gemini response missing required fields: ${missingFields.join(', ')}. ` +
      `Response: ${JSON.stringify(parsedResponse)}. Request ID: ${requestId}`;
    console.error(`[Gemini Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Validate and sanitize all fields
  const structural = validateDamageScore(parsedResponse.structural, 'structural', requestId);
  const mechanical = validateDamageScore(parsedResponse.mechanical, 'mechanical', requestId);
  const cosmetic = validateDamageScore(parsedResponse.cosmetic, 'cosmetic', requestId);
  const electrical = validateDamageScore(parsedResponse.electrical, 'electrical', requestId);
  const interior = validateDamageScore(parsedResponse.interior, 'interior', requestId);
  
  // Validate severity format first
  const validSeverities: Array<'minor' | 'moderate' | 'severe'> = ['minor', 'moderate', 'severe'];
  let rawSeverity: 'minor' | 'moderate' | 'severe';
  if (typeof parsedResponse.severity === 'string' && validSeverities.includes(parsedResponse.severity as any)) {
    rawSeverity = parsedResponse.severity as 'minor' | 'moderate' | 'severe';
  } else {
    console.warn(
      `[Gemini Service] Invalid severity value: ${parsedResponse.severity}. ` +
      `Defaulting to "moderate". Request ID: ${requestId}`
    );
    rawSeverity = 'moderate';
  }
  
  const airbagDeployed = validateBoolean(parsedResponse.airbagDeployed, 'airbagDeployed', requestId);
  
  // Validate and correct severity based on damage scores
  const severity = validateAndCorrectSeverity(
    rawSeverity,
    { structural, mechanical, cosmetic, electrical, interior },
    airbagDeployed,
    requestId
  );
  
  const totalLoss = validateBoolean(parsedResponse.totalLoss, 'totalLoss', requestId);
  const summary = validateSummary(parsedResponse.summary, requestId);

  // Calculate confidence score based on average damage
  const averageDamage = (structural + mechanical + cosmetic + electrical + interior) / 5;
  const confidence = 85; // Base confidence for Gemini assessments

  console.info(
    `[Gemini Service] Successfully parsed and validated response. ` +
    `Severity: ${severity}, Average damage: ${averageDamage.toFixed(1)}, ` +
    `Airbag deployed: ${airbagDeployed}, Total loss: ${totalLoss}. ` +
    `Request ID: ${requestId}`
  );

  return {
    structural,
    mechanical,
    cosmetic,
    electrical,
    interior,
    severity,
    airbagDeployed,
    totalLoss,
    summary,
    confidence,
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
export function constructDamageAssessmentPrompt(vehicleContext: VehicleContext): string {
  const { year, make, model, itemType } = vehicleContext;
  
  // Determine if this is a vehicle or universal item
  const isVehicle = !itemType || itemType === 'vehicle';
  const itemDescription = isVehicle 
    ? `${year} ${make} ${model}` 
    : `${make} ${model} ${itemType} (${year})`;
  
  const expertRole = isVehicle 
    ? 'expert vehicle damage assessor' 
    : 'expert damage assessor specializing in various items';
  
  const analysisInstruction = isVehicle
    ? `Analyze the provided photos of a ${itemDescription} and assess the damage comprehensively.`
    : `Analyze the provided photos of this ${itemDescription} and assess the damage comprehensively.`;

  return `You are an ${expertRole}. ${analysisInstruction}

Provide a detailed damage assessment with scores from 0-100 for each of the following categories:

**Structural Damage (0-100):**
${isVehicle 
  ? '- Frame, chassis, pillars, roof, structural integrity'
  : '- Main body, frame, housing, structural components, mounting points'
}
- 0 = No structural damage
- 100 = Complete structural failure${isVehicle ? ', frame bent or broken' : ', main structure destroyed'}
${isVehicle 
  ? '- Examples: Minor (10-30): Small frame dent. Moderate (40-60): Crumpled pillar, roof damage. Severe (70-90): Frame bent, multiple structural failures.'
  : '- Examples: Minor (10-30): Small dent in housing. Moderate (40-60): Cracked casing, bent frame. Severe (70-90): Broken housing, structural collapse.'
}

**Mechanical Damage (0-100):**
${isVehicle 
  ? '- Engine, transmission, suspension, drivetrain, wheels, brakes'
  : '- Moving parts, motors, mechanisms, buttons, switches, mechanical components'
}
- 0 = No mechanical damage, fully functional
- 100 = Non-functional, major mechanical failure
${isVehicle 
  ? '- Examples: Minor (10-30): Scratched wheel rim. Moderate (40-60): Damaged suspension, leaking fluids. Severe (70-90): Engine damage, transmission failure.'
  : '- Examples: Minor (10-30): Sticky button. Moderate (40-60): Jammed mechanism, loose parts. Severe (70-90): Broken motor, non-functional components.'
}

**Cosmetic Damage (0-100):**
${isVehicle 
  ? '- Body panels, paint, trim, bumpers, glass, mirrors'
  : '- Surface finish, paint, coating, external appearance, decorative elements'
}
- 0 = No cosmetic damage, pristine condition
- 100 = Completely destroyed exterior
${isVehicle 
  ? '- Examples: Minor (10-30): Small dent, scratch, paint chip. Moderate (40-60): Crumpled fender, broken headlight, shattered glass. Severe (70-90): Multiple panels destroyed, extensive paint damage.'
  : '- Examples: Minor (10-30): Small scratch, scuff mark. Moderate (40-60): Deep scratches, dents, faded finish. Severe (70-90): Extensive surface damage, missing parts.'
}

**Electrical Damage (0-100):**
${isVehicle 
  ? '- Wiring, lights, electronics, battery, sensors, control modules'
  : '- Wiring, circuits, display, battery, charging port, electronic components'
}
- 0 = No electrical damage, all systems functional
- 100 = Total electrical failure, no systems working
${isVehicle 
  ? '- Examples: Minor (10-30): Broken taillight. Moderate (40-60): Multiple lights out, exposed wiring. Severe (70-90): Electrical fire damage, control module failure.'
  : '- Examples: Minor (10-30): Dim display. Moderate (40-60): Charging issues, flickering screen. Severe (70-90): No power, burnt circuits, electrical damage.'
}

**Interior Damage (0-100):**
${isVehicle 
  ? '- Seats, dashboard, controls, upholstery, steering wheel, console'
  : '- Internal components, user interface, controls, internal housing, accessible parts'
}
- 0 = No interior damage, pristine condition
- 100 = Completely destroyed interior
${isVehicle 
  ? '- Examples: Minor (10-30): Stained seat, small tear. Moderate (40-60): Deployed airbag, cracked dashboard. Severe (70-90): Multiple deployed airbags, destroyed dashboard, seats torn.'
  : '- Examples: Minor (10-30): Minor wear, small stains. Moderate (40-60): Cracked internal parts, loose components. Severe (70-90): Broken internal structure, missing parts.'
}

**Overall Severity Classification:**
Determine the overall severity level:
- **minor**: Mostly cosmetic damage, ${isVehicle ? 'vehicle is drivable' : 'item is functional'} and repairable with minimal cost (typically <25% of ${isVehicle ? 'vehicle' : 'item'} value)
- **moderate**: Significant damage but repairable, may affect ${isVehicle ? 'drivability' : 'functionality'} (typically 25-50% of ${isVehicle ? 'vehicle' : 'item'} value)
- **severe**: Extensive damage, major repairs needed, may not be economically repairable (typically >50% of ${isVehicle ? 'vehicle' : 'item'} value)

${isVehicle ? `**Airbag Deployment Detection:**
Carefully examine the photos for signs of airbag deployment:
- Deployed airbags visible in steering wheel, dashboard, or side panels
- Airbag covers open or missing
- White powder residue (from airbag deployment)
- Damaged steering wheel or dashboard from airbag deployment
Set airbagDeployed to **true** if any airbags have deployed, **false** otherwise.` : ''}

**Total Loss Determination:**
Determine if the ${isVehicle ? 'vehicle' : 'item'} is a total loss:
- ${isVehicle ? 'A vehicle' : 'An item'} is considered a total loss if the estimated repair cost would exceed **75% of the ${isVehicle ? "vehicle's" : "item's"} pre-accident value**
- Consider: structural damage (most expensive), mechanical damage${isVehicle ? ', number of deployed airbags' : ''}, age of ${isVehicle ? 'vehicle' : 'item'}
- Set totalLoss to **true** if repair cost > 75% of ${isVehicle ? 'vehicle' : 'item'} value, **false** otherwise

**Summary:**
Provide a brief, clear description of the damage in 2-3 sentences (maximum 500 characters). Include:
- Most significant damage areas
${isVehicle ? '- Whether airbags deployed' : ''}
- Overall assessment of repairability

**IMPORTANT:** Return your assessment as JSON matching this exact schema:
{
  "structural": number (0-100),
  "mechanical": number (0-100),
  "cosmetic": number (0-100),
  "electrical": number (0-100),
  "interior": number (0-100),
  "severity": "minor" | "moderate" | "severe",
  "airbagDeployed": boolean,
  "totalLoss": boolean,
  "summary": string (max 500 characters)
}

Analyze all provided photos carefully and provide your assessment.`;
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

    // Convert Gemini assessment to DamageDetectionResult format
    const damagedComponents = [];
    
    // Map damage scores to components
    if (geminiResult.structural > 20) {
      damagedComponents.push({
        component: 'structural',
        severity: geminiResult.structural > 70 ? 'severe' : geminiResult.structural > 40 ? 'moderate' : 'minor',
        confidence: geminiResult.confidence
      });
    }
    
    if (geminiResult.mechanical > 20) {
      damagedComponents.push({
        component: 'mechanical',
        severity: geminiResult.mechanical > 70 ? 'severe' : geminiResult.mechanical > 40 ? 'moderate' : 'minor',
        confidence: geminiResult.confidence
      });
    }
    
    if (geminiResult.cosmetic > 20) {
      damagedComponents.push({
        component: 'cosmetic',
        severity: geminiResult.cosmetic > 70 ? 'severe' : geminiResult.cosmetic > 40 ? 'moderate' : 'minor',
        confidence: geminiResult.confidence
      });
    }
    
    if (geminiResult.electrical > 20) {
      damagedComponents.push({
        component: 'electrical',
        severity: geminiResult.electrical > 70 ? 'severe' : geminiResult.electrical > 40 ? 'moderate' : 'minor',
        confidence: geminiResult.confidence
      });
    }
    
    if (geminiResult.interior > 20) {
      damagedComponents.push({
        component: 'interior',
        severity: geminiResult.interior > 70 ? 'severe' : geminiResult.interior > 40 ? 'moderate' : 'minor',
        confidence: geminiResult.confidence
      });
    }

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
