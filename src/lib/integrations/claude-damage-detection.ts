/**
 * Claude Damage Detection Service
 * 
 * UPDATED: Now using Claude Sonnet 4.6 (February 2026)
 * - Model: claude-sonnet-4-6
 * - Pricing: $3/MTok input, $15/MTok output
 * - Context: 200K tokens (1M available)
 * - Max output: 64K tokens
 * 
 * Provides advanced multimodal AI damage assessment using Anthropic's Claude API.
 * 
 * Features:
 * - Structured damage scoring with specific part detection
 * - Severity classification (minor/moderate/severe)
 * - Airbag deployment detection
 * - Conservative total loss determination
 * - Prompt caching and per-request token usage logging
 * - Local request limiting as an additional safety mechanism
 * 
 * Claude is an optional fallback after Gemini, never an automatic paid default.
 * 
 * Paid use is disabled unless CLAUDE_DAMAGE_FALLBACK_ENABLED=true.
 */

import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { isClaudeDamageFallbackEnabled } from '@/lib/ai/provider-cost-controls';
import { normalizeDamageEvidence, type DamageAction } from '@/lib/ai/damage-evidence';

/**
 * Vehicle context for damage assessment
 */
export interface VehicleContext {
  make: string;
  model: string;
  year?: number;
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
  part: string;
  damageType?: string;
  description?: string;
  recommendedAction?: DamageAction;
  actionConfidence?: number;
  severity: 'minor' | 'moderate' | 'severe';
  confidence: number;
}

/**
 * Structured damage assessment result from Claude
 */
export interface ClaudeDamageAssessment {
  itemDetails?: ItemDetails;
  damagedParts: DamagedPart[];
  severity: 'minor' | 'moderate' | 'severe';
  airbagDeployed: boolean;
  totalLoss: boolean;
  summary: string;
  confidence: number;
  method: 'claude';
}

/**
 * Claude service configuration
 */
interface ClaudeConfig {
  apiKey: string | undefined;
  enabled: boolean;
  model: string;
}

/**
 * Service state
 */
let serviceConfig: ClaudeConfig = {
  apiKey: undefined,
  enabled: false,
  model: process.env.CLAUDE_DAMAGE_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
};

let claudeClient: Anthropic | null = null;

/**
 * Initialize the Claude service with API key validation
 */
export async function initializeClaudeService(): Promise<void> {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your-claude-api-key') {
    console.warn(
      '[Claude Service] CLAUDE_API_KEY not configured. Claude damage detection is disabled. ' +
      'The system will fall back to Gemini. To enable Claude, set CLAUDE_API_KEY in your environment. ' +
      'Get an API key at: https://console.anthropic.com/'
    );
    serviceConfig.enabled = false;
    serviceConfig.apiKey = undefined;
    claudeClient = null;
    return;
  }

  // Validate API key format (should start with sk-ant-)
  if (!apiKey.startsWith('sk-ant-')) {
    console.warn(
      `[Claude Service] CLAUDE_API_KEY appears invalid (should start with sk-ant-). ` +
      `Claude damage detection is disabled. Key starts with: ${apiKey.substring(0, 7)}...`
    );
    serviceConfig.enabled = false;
    serviceConfig.apiKey = undefined;
    claudeClient = null;
    return;
  }

  if (serviceConfig.enabled && serviceConfig.apiKey === apiKey && claudeClient) {
    return;
  }

  try {
    // Initialize the Claude client with API key
    claudeClient = new Anthropic({
      apiKey: apiKey,
    });

    // Mark service as enabled
    serviceConfig.apiKey = apiKey;
    serviceConfig.enabled = true;

    // Log successful initialization (with last 4 chars only for security)
    const maskedKey = `...${apiKey.slice(-4)}`;
    console.info(
      `[Claude Service] Initialized successfully with API key ending in ${maskedKey}. ` +
      `Model: ${serviceConfig.model}. Prompt caching enabled for cost optimization.`
    );
  } catch (initError: any) {
    const errorMessage = initError?.message || 'Unknown error';
    console.error(
      `[Claude Service] Initialization failed. Error: ${errorMessage}. ` +
      `Key starts with: ${apiKey.substring(0, 7)}... ` +
      `Claude damage detection is disabled. The system will fall back to Gemini.`
    );
    serviceConfig.enabled = false;
    serviceConfig.apiKey = undefined;
    claudeClient = null;
  }
}

/**
 * Check if Claude service is enabled and ready
 */
export function isClaudeEnabled(): boolean {
  return serviceConfig.enabled && claudeClient !== null;
}

/**
 * Get the Claude client instance for adjacent multimodal workflows.
 * Keep usage server-side only; never expose the API key or client to the browser.
 */
export function getClaudeClient(): Anthropic | null {
  return claudeClient;
}

export function getClaudeModelName(): string {
  return serviceConfig.model;
}

/**
 * Get the current service configuration (for testing/monitoring)
 */
export function getClaudeServiceConfig(): {
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
 * Claude response schema for structured JSON output
 * This matches Gemini's schema exactly for compatibility
 */
const CLAUDE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    itemDetails: {
      type: "object",
      properties: {
        detectedMake: { type: "string" },
        detectedModel: { type: "string" },
        detectedYear: { type: "string" },
        color: { type: "string" },
        trim: { type: "string" },
        bodyStyle: { type: "string" },
        storage: { type: "string" },
        overallCondition: { type: "string" },
        notes: { type: "string" }
      }
    },
    damagedParts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          part: { type: "string" },
          damageType: { type: "string" },
          description: { type: "string" },
          recommendedAction: { type: "string", enum: ["repair", "replace", "clean_or_restore", "sort_or_recover", "dispose", "specialist_review"] },
          actionConfidence: { type: "number", minimum: 0, maximum: 100 },
          severity: { type: "string", enum: ["minor", "moderate", "severe"] },
          confidence: { type: "number", minimum: 0, maximum: 100 }
        },
        required: ["part", "damageType", "description", "recommendedAction", "actionConfidence", "severity", "confidence"]
      }
    },
    severity: { type: "string", enum: ["minor", "moderate", "severe"] },
    airbagDeployed: { type: "boolean" },
    totalLoss: { type: "boolean" },
    summary: { type: "string", maxLength: 1500 }
  },
  required: ["itemDetails", "damagedParts", "severity", "airbagDeployed", "totalLoss", "summary"]
};

/**
 * Parse and validate Claude JSON response
 * Reuses Gemini's validation logic for consistency
 */
export function parseAndValidateClaudeResponse(responseText: string, requestId: string): ClaudeDamageAssessment {
  // Parse JSON response - Claude sometimes wraps JSON in markdown code blocks
  let parsedResponse: any;
  try {
    // Remove markdown code blocks if present (```json ... ``` or ``` ... ```)
    let cleanedResponse = responseText.trim();
    
    // Check if response starts with markdown code block
    if (cleanedResponse.startsWith('```')) {
      console.info(`[Claude Service] Detected markdown code blocks in response. Removing... Request ID: ${requestId}`);
      
      // Remove opening ```json or ``` (with optional newline)
      cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '');
      
      // Remove closing ``` (with optional newline before it)
      cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, '');
      
      // Trim again after removal
      cleanedResponse = cleanedResponse.trim();
      
      console.info(`[Claude Service] Cleaned response (first 100 chars): ${cleanedResponse.substring(0, 100)}... Request ID: ${requestId}`);
    }
    
    parsedResponse = JSON.parse(cleanedResponse);
  } catch (parseError: any) {
    const errorMsg = 
      `Failed to parse Claude response as JSON. Response: ${responseText.substring(0, 200)}... ` +
      `Cleaned: ${responseText.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').substring(0, 200)}... ` +
      `Error: ${parseError?.message || 'Unknown error'}. Request ID: ${requestId}`;
    console.error(`[Claude Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Validate required fields
  const requiredFields = ['damagedParts', 'severity', 'airbagDeployed', 'totalLoss', 'summary'];
  const missingFields = requiredFields.filter(field => !(field in parsedResponse));
  if (missingFields.length > 0) {
    const errorMsg = 
      `Claude response missing required fields: ${missingFields.join(', ')}. ` +
      `Response: ${JSON.stringify(parsedResponse)}. Request ID: ${requestId}`;
    console.error(`[Claude Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Validate and sanitize damaged parts
  const damagedParts: DamagedPart[] = Array.isArray(parsedResponse.damagedParts)
    ? parsedResponse.damagedParts.map((part: any, index: number) => {
        if (!part.part || typeof part.part !== 'string') {
          console.warn(`[Claude Service] Invalid part name at index ${index}. Using "unknown part". Request ID: ${requestId}`);
          part.part = 'unknown part';
        }

        const validSeverities: Array<'minor' | 'moderate' | 'severe'> = ['minor', 'moderate', 'severe'];
        if (!validSeverities.includes(part.severity)) {
          console.warn(`[Claude Service] Invalid severity "${part.severity}" at index ${index}. Defaulting to "moderate". Request ID: ${requestId}`);
          part.severity = 'moderate';
        }

        if (typeof part.confidence !== 'number' || part.confidence < 0 || part.confidence > 100) {
          console.warn(`[Claude Service] Invalid confidence ${part.confidence} at index ${index}. Defaulting to 70. Request ID: ${requestId}`);
          part.confidence = 70;
        }

        return normalizeDamageEvidence({
          part: part.part,
          damageType: typeof part.damageType === 'string' ? part.damageType : undefined,
          description: typeof part.description === 'string' ? part.description : undefined,
          recommendedAction: part.recommendedAction,
          actionConfidence: part.actionConfidence,
          severity: part.severity as 'minor' | 'moderate' | 'severe',
          confidence: part.confidence
        });
      })
    : [];

  // Validate severity
  const validSeverities: Array<'minor' | 'moderate' | 'severe'> = ['minor', 'moderate', 'severe'];
  let severity: 'minor' | 'moderate' | 'severe';
  if (typeof parsedResponse.severity === 'string' && validSeverities.includes(parsedResponse.severity as any)) {
    severity = parsedResponse.severity as 'minor' | 'moderate' | 'severe';
  } else {
    console.warn(`[Claude Service] Invalid severity value: ${parsedResponse.severity}. Defaulting to "moderate". Request ID: ${requestId}`);
    severity = 'moderate';
  }

  // Validate booleans
  const airbagDeployed = typeof parsedResponse.airbagDeployed === 'boolean' ? parsedResponse.airbagDeployed : false;
  const totalLoss = typeof parsedResponse.totalLoss === 'boolean' ? parsedResponse.totalLoss : false;

  // Validate summary
  let summary = typeof parsedResponse.summary === 'string' ? parsedResponse.summary : 'Damage assessment completed. Please review detailed parts.';
  if (summary.length > 1500) {
    summary = summary.substring(0, 1497) + '...';
    console.warn(`[Claude Service] Summary exceeds 1500 characters. Truncated. Request ID: ${requestId}`);
  }

  // Parse itemDetails if present
  let itemDetails: ItemDetails | undefined;
  if (parsedResponse.itemDetails && typeof parsedResponse.itemDetails === 'object') {
    const sanitizeField = (value: any): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      if ((trimmed.includes('(') || trimmed.includes('estimated') || trimmed.includes('appears to be')) && trimmed.length > 50) {
        console.warn(`[Claude Service] Rejecting field value with reasoning text: ${trimmed.substring(0, 100)}...`);
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

    Object.keys(itemDetails).forEach(key => {
      if (itemDetails![key as keyof ItemDetails] === undefined) {
        delete itemDetails![key as keyof ItemDetails];
      }
    });
  }

  // Calculate confidence
  const avgConfidence = damagedParts.length > 0
    ? damagedParts.reduce((sum, part) => sum + part.confidence, 0) / damagedParts.length
    : 85;

  console.info(
    `[Claude Service] Successfully parsed and validated response. ` +
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
    method: 'claude',
  };
}

/**
 * Construct the damage assessment prompt (reuses Gemini's prompts exactly)
 */
export function constructDamageAssessmentPrompt(vehicleContext: VehicleContext): string {
  const { year, make, model, itemType } = vehicleContext;

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
    return constructGeneralAssetPrompt(make, model, itemType || 'other', year);
  }
}

// Import prompt construction functions from Gemini (they're identical)
import {
  constructDamageAssessmentPrompt as geminiConstructPrompt
} from './gemini-damage-detection';

// Use Gemini's prompt construction directly
const constructVehiclePrompt = (year: number | undefined, make: string, model: string) => {
  return geminiConstructPrompt({ year, make, model }).replace(/Gemini/g, 'Claude');
};

const constructElectronicsPrompt = (brand: string, model: string, year?: number) => {
  return geminiConstructPrompt({ year, make: brand, model, itemType: 'electronics' }).replace(/Gemini/g, 'Claude');
};

const constructMachineryPrompt = (brand: string, model: string, year?: number) => {
  return geminiConstructPrompt({ year, make: brand, model, itemType: 'machinery' }).replace(/Gemini/g, 'Claude');
};

const constructGeneralAssetPrompt = (category: string, description: string, itemType: string, year?: number) => {
  return geminiConstructPrompt({ year, make: category, model: description, itemType }).replace(/Gemini/g, 'Claude');
};

/**
 * Convert image URL to base64 for Claude API
 */
async function convertImageToBase64(imageUrl: string): Promise<{ data: string; mimeType: string }> {
  let sourceBuffer: Buffer;

  // Check if it's already a base64 data URL
  if (imageUrl.toLowerCase().startsWith('data:image/')) {
    const base64Match = imageUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (base64Match) {
      sourceBuffer = Buffer.from(base64Match[2], 'base64');
    } else {
      throw new Error('Invalid base64 data URL format');
    }
  } else {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    sourceBuffer = Buffer.from(await response.arrayBuffer());
  }

  // Anthropic recommends keeping images near 1.15 MP and within 1568 px.
  // Normalizing once avoids paying vision tokens for camera-resolution pixels
  // that the model downsizes internally without improving the assessment.
  const normalized = await sharp(sourceBuffer, { failOn: 'none' })
    .rotate()
    .resize({ width: 1100, height: 1100, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  return { data: normalized.toString('base64'), mimeType: 'image/jpeg' };
}

/**
 * Convert multiple image URLs to base64 format
 */
async function convertPhotosToBase64(
  imageUrls: string[],
  requestId: string
): Promise<Array<{ data: string; mimeType: string }>> {
  if (imageUrls.length === 0) {
    throw new Error('At least one photo is required for damage assessment');
  }

  // Handle more than 10 photos - log warning and process first 10
  let photosToProcess = imageUrls;
  if (imageUrls.length > 10) {
    console.warn(
      `[Claude Service] Received ${imageUrls.length} photos, but maximum is 10. ` +
      `Processing first 10 photos only. Request ID: ${requestId}`
    );
    photosToProcess = imageUrls.slice(0, 10);
  }

  const conversionPromises = photosToProcess.map(async (url, index) => {
    try {
      const result = await convertImageToBase64(url);
      console.info(
        `[Claude Service] Converted photo ${index + 1}/${photosToProcess.length} to base64. ` +
        `Format: ${result.mimeType}. Request ID: ${requestId}`
      );
      return result;
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error';
      console.error(
        `[Claude Service] Failed to convert photo ${index + 1}/${photosToProcess.length}. ` +
        `Error: ${errorMessage}. Request ID: ${requestId}`
      );
      throw error;
    }
  });

  const convertedPhotos = await Promise.all(conversionPromises);

  console.info(
    `[Claude Service] Successfully converted ${convertedPhotos.length} photos to base64. ` +
    `Request ID: ${requestId}`
  );

  return convertedPhotos;
}

/**
 * Error classification for retry logic
 */
enum ErrorType {
  TRANSIENT = 'transient',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

/**
 * Classify error type for retry logic
 */
function classifyError(error: any, requestId: string): ErrorType {
  const errorMessage = error?.message || '';
  const errorString = String(error);

  if (
    errorMessage.includes('API key') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('401')
  ) {
    console.error(`[Claude Service] Authentication error detected. No retry will be attempted. Request ID: ${requestId}`);
    return ErrorType.AUTHENTICATION;
  }

  if (
    errorMessage.includes('Invalid') ||
    errorMessage.includes('validation') ||
    errorMessage.includes('required') ||
    errorMessage.includes('missing') ||
    errorMessage.includes('parse') ||
    errorMessage.includes('400')
  ) {
    console.error(`[Claude Service] Validation error detected. No retry will be attempted. Request ID: ${requestId}`);
    return ErrorType.VALIDATION;
  }

  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    console.error(`[Claude Service] Timeout error detected. No retry will be attempted. Request ID: ${requestId}`);
    return ErrorType.TIMEOUT;
  }

  if (
    errorMessage.includes('500') ||
    errorMessage.includes('502') ||
    errorMessage.includes('503') ||
    errorMessage.includes('504') ||
    errorMessage.includes('5xx') ||
    errorMessage.includes('server error') ||
    errorMessage.includes('service unavailable')
  ) {
    console.warn(`[Claude Service] Transient error detected (5xx). Will retry once after 2 seconds. Request ID: ${requestId}`);
    return ErrorType.TRANSIENT;
  }

  console.error(`[Claude Service] Unknown error type. No retry will be attempted. Request ID: ${requestId}`);
  return ErrorType.UNKNOWN;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function logClaudeUsage(response: Anthropic.Message, requestId: string): void {
  const usage = response.usage as Anthropic.Message['usage'] & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const usesSonnetPricing = serviceConfig.model.toLowerCase().includes('sonnet');
  const estimatedCostUsd = usesSonnetPricing
    ? (input * 3 + output * 15 + cacheWrite * 3.75 + cacheRead * 0.3) / 1_000_000
    : null;

  console.info('[Claude Service] Usage', {
    requestId,
    model: serviceConfig.model,
    inputTokens: input,
    outputTokens: output,
    cacheWriteTokens: cacheWrite,
    cacheReadTokens: cacheRead,
    estimatedCostUsd: estimatedCostUsd === null ? null : Number(estimatedCostUsd.toFixed(6)),
    pricingBasis: usesSonnetPricing ? 'Claude Sonnet published token rates' : 'token counts only',
  });
}

/**
 * Assess asset damage using the configured Claude model with prompt caching.
 * 
 * This function:
 * - Validates service is enabled and inputs are valid
 * - Converts image URLs to base64 for Claude API
 * - Constructs optimized prompt with vehicle context
 * - Uses Anthropic prompt caching to reduce repeated prompt-input costs
 * - Calls Claude API with photos and prompt (with retry logic for 5xx errors)
 * - Parses and validates JSON response
 * - Returns structured damage assessment
 * 
 * Prompt Caching:
 * - System prompt is cached for 1 hour
 * - Reduces input token costs by ~50%
 * - Estimated cost: $0.43/month for 45 assessments
 * 
 * Retry Logic:
 * - 5xx errors: Retry once after 2 seconds
 * - Timeout: No retry (already waited)
 * - Authentication errors: No retry, immediate fallback
 * - Validation errors: No retry, immediate fallback
 */
export async function assessDamageWithClaude(
  imageUrls: string[],
  vehicleContext: VehicleContext
): Promise<ClaudeDamageAssessment> {
  const requestId = `claude-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  // Check if service is enabled
  if (!isClaudeEnabled()) {
    const errorMsg = 
      'Claude service is not enabled. CLAUDE_API_KEY is not configured or initialization failed. ' +
      'Please set a valid CLAUDE_API_KEY in your environment variables. ' +
      `Request ID: ${requestId}`;
    console.error(`[Claude Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Validate inputs
  if (!imageUrls || imageUrls.length === 0) {
    const errorMsg = `At least one image URL is required for damage assessment. Request ID: ${requestId}`;
    console.error(`[Claude Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const requiresYear = !vehicleContext?.itemType || vehicleContext.itemType === 'vehicle' || vehicleContext.itemType === 'machinery' || vehicleContext.itemType === 'equipment';

  if (!vehicleContext || !vehicleContext.make || !vehicleContext.model || (requiresYear && !vehicleContext.year)) {
    const errorMsg = 
      `Item context (make/brand, model${requiresYear ? ', year' : ''}) is required for damage assessment. ` +
      `Received: ${JSON.stringify(vehicleContext)}. Request ID: ${requestId}`;
    console.error(`[Claude Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const itemDescription = vehicleContext.itemType 
    ? `${vehicleContext.make} ${vehicleContext.model} ${vehicleContext.itemType}${vehicleContext.year ? ` (${vehicleContext.year})` : ''}`
    : `${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}`;

  console.info(
    `[Claude Service] Starting damage assessment for ${itemDescription}. ` +
    `Photos: ${Math.min(imageUrls.length, 10)}. Request ID: ${requestId}`
  );

  try {
    // Convert image URLs to base64
    const convertedPhotos = await convertPhotosToBase64(imageUrls, requestId);

    // Construct prompt with vehicle context
    const prompt = constructDamageAssessmentPrompt(vehicleContext);

    // Build content array for Claude API with prompt caching
    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [
      {
        type: 'text',
        text: prompt,
        cache_control: { type: 'ephemeral' } // Cache the system prompt for 1 hour
      },
      ...convertedPhotos.map(photo => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: photo.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: photo.data,
        }
      }))
    ];

    console.info(
      `[Claude Service] Calling Claude API with ${convertedPhotos.length} photos and prompt caching enabled. ` +
      `Request ID: ${requestId}`
    );

    // Call Claude API with retry logic
    const startTime = Date.now();
    let lastError: any = null;

    // Attempt 1: Initial API call
    try {
      const response = await claudeClient!.messages.create({
        model: serviceConfig.model,
        max_tokens: Math.max(800, Number(process.env.CLAUDE_DAMAGE_MAX_TOKENS) || 1600),
        messages: [{
          role: 'user',
          content
        }],
        system: [
          {
            type: 'text',
            text: 'You are an expert damage assessor. Respond ONLY with valid JSON matching the specified schema. Do not include any explanatory text outside the JSON.',
            cache_control: { type: 'ephemeral' } // Cache system message
          }
        ]
      });

      const duration = Date.now() - startTime;
      logClaudeUsage(response, requestId);
      console.info(`[Claude Service] API call succeeded in ${duration}ms. Request ID: ${requestId}`);

      // Extract text from response
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      const responseText = textContent.text;

      if (!responseText || responseText.trim() === '') {
        throw new Error('Claude API returned empty response');
      }

      console.info(
        `[Claude Service] Received response from Claude API (${responseText.length} characters). ` +
        `Request ID: ${requestId}`
      );

      // Parse and validate the response
      const assessment = parseAndValidateClaudeResponse(responseText, requestId);

      console.info(
        `[Claude Service] Damage assessment completed successfully. ` +
        `Item: ${itemDescription}. ` +
        `Severity: ${assessment.severity}. Duration: ${duration}ms. ` +
        `Request ID: ${requestId}`
      );

      return assessment;

    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || 'Unknown error';
      console.error(`[Claude Service] Attempt 1: API call failed. Error: ${errorMessage}. Request ID: ${requestId}`);

      // Classify the error
      const errorType = classifyError(error, requestId);

      // Only retry for transient errors
      if (errorType !== ErrorType.TRANSIENT) {
        console.error(`[Claude Service] Error type is ${errorType}. No retry will be attempted. Request ID: ${requestId}`);
        throw error;
      }

      // Wait before retry
      console.info(`[Claude Service] Waiting 2000ms before retry. Request ID: ${requestId}`);
      await sleep(2000);
    }

    // Attempt 2: Retry for transient errors
    try {
      console.info(`[Claude Service] Attempt 2: Retrying Claude API call after transient error. Request ID: ${requestId}`);

      const response = await claudeClient!.messages.create({
        model: serviceConfig.model,
        max_tokens: Math.max(800, Number(process.env.CLAUDE_DAMAGE_MAX_TOKENS) || 1600),
        messages: [{
          role: 'user',
          content
        }],
        system: [
          {
            type: 'text',
            text: 'You are an expert damage assessor. Respond ONLY with valid JSON matching the specified schema. Do not include any explanatory text outside the JSON.',
            cache_control: { type: 'ephemeral' }
          }
        ]
      });

      const duration = Date.now() - startTime;
      logClaudeUsage(response, requestId);
      console.info(`[Claude Service] Attempt 2: API call succeeded in ${duration}ms after retry. Request ID: ${requestId}`);

      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      const responseText = textContent.text;
      const assessment = parseAndValidateClaudeResponse(responseText, requestId);

      console.info(
        `[Claude Service] Damage assessment completed successfully after retry. ` +
        `Item: ${itemDescription}. Severity: ${assessment.severity}. Duration: ${duration}ms. ` +
        `Request ID: ${requestId}`
      );

      return assessment;

    } catch (retryError: any) {
      const retryErrorMessage = retryError?.message || 'Unknown error';
      console.error(
        `[Claude Service] Attempt 2: Retry failed. Error: ${retryErrorMessage}. ` +
        `Original error: ${lastError?.message || 'Unknown'}. Request ID: ${requestId}`
      );
      throw retryError;
    }

  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const errorStack = error?.stack || 'No stack trace available';
    const errorType = classifyError(error, requestId);

    console.error(
      `[Claude Service] Damage assessment failed. ` +
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
 * Reset the service (for testing purposes)
 */
export function resetClaudeService(): void {
  serviceConfig = {
    apiKey: undefined,
    enabled: false,
    model: process.env.CLAUDE_DAMAGE_MODEL || process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
  };
  claudeClient = null;
}

if (isClaudeDamageFallbackEnabled()) {
  initializeClaudeService().catch((error) => {
    console.error('[Claude Service] Failed to auto-initialize:', error);
  });
}
