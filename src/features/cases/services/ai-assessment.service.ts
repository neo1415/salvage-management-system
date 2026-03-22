/**
 * AI Damage Assessment Service
 * 
 * Implements a three-tier fallback chain for damage assessment:
 * 1. Gemini 2.0 Flash (primary) - Advanced multimodal AI with structured scoring
 * 2. Google Cloud Vision API (fallback) - Keyword-based damage detection
 * 3. Neutral scores (final fallback) - Safe defaults when all AI methods fail
 * 
 * Features:
 * - Optional vehicle context for improved Gemini accuracy
 * - Rate limiting to stay within Gemini free tier
 * - Automatic fallback on errors or quota exhaustion
 * - Backward compatible API (all existing fields preserved)
 * - New optional fields for enhanced damage details
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.3, 9.3
 */

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { 
  assessDamageWithGemini, 
  isGeminiEnabled,
  type VehicleContext,
} from '@/lib/integrations/gemini-damage-detection';
import { 
  assessDamageWithVision,
} from '@/lib/integrations/vision-damage-detection';
import { 
  getGeminiRateLimiter 
} from '@/lib/integrations/gemini-rate-limiter';
import {
  adaptGeminiResponse,
  adaptVisionResponse,
  generateNeutralResponse,
} from './damage-response-adapter';
import { type QualityTier } from '@/features/valuations/services/condition-mapping.service';

// Check if we should use mock mode (for development without billing)
const MOCK_MODE = process.env.MOCK_AI_ASSESSMENT === 'true';

// Initialize the Document AI client (only if not in mock mode)
const documentAIClient = MOCK_MODE ? null : new DocumentProcessorServiceClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export interface AIAssessment {
  labels: string[];
  confidenceScore: number; // 0-100
  damagePercentage: number; // 0-100
  processedAt: Date;
}

export interface DamageAssessmentResult extends AIAssessment {
  damageSeverity: 'minor' | 'moderate' | 'severe';
  estimatedSalvageValue: number;
  reservePrice: number;
  
  // New optional fields (backward compatible)
  method?: 'gemini' | 'vision' | 'neutral';
  detailedScores?: {
    structural: number;
    mechanical: number;
    cosmetic: number;
    electrical: number;
    interior: number;
  };
  airbagDeployed?: boolean;
  totalLoss?: boolean;
  summary?: string;
  
  // Quality tier assessment (Requirement 4.1)
  qualityTier: QualityTier;
}

export interface OCRResult {
  text: string;
  confidence: number;
  extractedFields: Record<string, string>;
}

/**
 * Assess damage from uploaded photos with three-tier fallback chain
 * 
 * Fallback Chain:
 * 1. Gemini 2.0 Flash (primary) - If enabled, rate limit not exceeded, and vehicle context provided
 * 2. Google Cloud Vision API (fallback) - If Gemini fails or is unavailable
 * 3. Neutral scores (final fallback) - If both Gemini and Vision fail
 * 
 * The function:
 * - Checks rate limiter before attempting Gemini
 * - Logs each fallback attempt with reason for failure
 * - Adds method field to response indicating which service was used
 * - Ensures total processing time does not exceed 30 seconds
 * - Maintains backward compatibility (vehicleContext is optional)
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.3, 9.3
 * 
 * @param imageUrls - Array of Cloudinary URLs or base64 data URLs for uploaded photos
 * @param marketValue - Market value of the asset
 * @param vehicleContext - Optional vehicle context (make, model, year) for improved Gemini accuracy
 * @returns Damage assessment with severity, estimated value, reserve price, and method used
 */
export async function assessDamage(
  imageUrls: string[],
  marketValue: number,
  vehicleContext?: VehicleContext
): Promise<DamageAssessmentResult> {
  const requestId = `assess-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  const startTime = Date.now();
  const timeoutMs = 30000; // 30 seconds total timeout
  
  // Track attempted methods for logging
  const attemptedMethods: string[] = [];
  const errors: Array<{ method: string; error: string }> = [];

  try {
    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('At least one image URL is required for damage assessment');
    }

    console.info(
      `[AI Assessment] Starting damage assessment. Photos: ${imageUrls.length}. ` +
      `Vehicle context: ${vehicleContext ? `${vehicleContext.year} ${vehicleContext.make} ${vehicleContext.model}` : 'not provided'}. ` +
      `Request ID: ${requestId}`
    );

    // Helper function to check if we've exceeded timeout
    const checkTimeout = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        throw new Error(`Assessment timeout exceeded (${elapsed}ms >= ${timeoutMs}ms)`);
      }
    };

    // ATTEMPT 1: Try Gemini 2.0 Flash (if enabled, rate limit allows, and vehicle context provided)
    if (isGeminiEnabled() && vehicleContext) {
      attemptedMethods.push('gemini');
      
      try {
        checkTimeout();
        
        // Check rate limiter before attempting Gemini
        const rateLimiter = getGeminiRateLimiter();
        const quotaStatus = rateLimiter.checkQuota();
        
        if (!quotaStatus.allowed) {
          const reason = quotaStatus.dailyRemaining === 0 
            ? `Daily quota exhausted (${quotaStatus.dailyRemaining} remaining)`
            : `Minute quota exhausted (${quotaStatus.minuteRemaining} remaining)`;
          
          console.warn(
            `[AI Assessment] Gemini rate limit exceeded. ${reason}. ` +
            `Falling back to Vision API. Request ID: ${requestId}`
          );
          
          errors.push({
            method: 'gemini',
            error: `Rate limit exceeded: ${reason}`,
          });
        } else {
          // Rate limit allows, attempt Gemini assessment
          console.info(
            `[AI Assessment] Attempting Gemini assessment. ` +
            `Quota remaining: ${quotaStatus.minuteRemaining}/minute, ${quotaStatus.dailyRemaining}/day. ` +
            `Request ID: ${requestId}`
          );
          
          const geminiStartTime = Date.now();
          const geminiAssessment = await assessDamageWithGemini(imageUrls, vehicleContext);
          const geminiDuration = Date.now() - geminiStartTime;
          
          // Record successful request
          rateLimiter.recordRequest();
          
          // Adapt Gemini response to unified format
          const result = adaptGeminiResponse(geminiAssessment, marketValue, vehicleContext);
          
          const totalDuration = Date.now() - startTime;
          console.info(
            `[AI Assessment] Gemini assessment succeeded. ` +
            `Severity: ${result.damageSeverity}. ` +
            `Gemini duration: ${geminiDuration}ms. Total duration: ${totalDuration}ms. ` +
            `Request ID: ${requestId}`
          );
          
          return result;
        }
      } catch (geminiError: any) {
        const geminiErrorMessage = geminiError?.message || 'Unknown error';
        const geminiDuration = Date.now() - startTime;
        
        console.error(
          `[AI Assessment] Gemini assessment failed after ${geminiDuration}ms. ` +
          `Error: ${geminiErrorMessage}. ` +
          `Falling back to Vision API. Request ID: ${requestId}`
        );
        
        errors.push({
          method: 'gemini',
          error: geminiErrorMessage,
        });
      }
    } else {
      // Gemini not attempted - log reason
      if (!isGeminiEnabled()) {
        console.info(
          `[AI Assessment] Gemini not enabled. Using Vision API. Request ID: ${requestId}`
        );
      } else if (!vehicleContext) {
        console.info(
          `[AI Assessment] Vehicle context not provided. Using Vision API. Request ID: ${requestId}`
        );
      }
    }

    // ATTEMPT 2: Try Vision API (fallback)
    attemptedMethods.push('vision');
    
    try {
      checkTimeout();
      
      console.info(
        `[AI Assessment] Attempting Vision API assessment. Request ID: ${requestId}`
      );
      
      const visionStartTime = Date.now();
      const visionAssessment = await assessDamageWithVision(imageUrls);
      const visionDuration = Date.now() - visionStartTime;
      
      // Adapt Vision response to unified format
      const result = adaptVisionResponse(visionAssessment, marketValue, vehicleContext);
      
      const totalDuration = Date.now() - startTime;
      console.info(
        `[AI Assessment] Vision API assessment succeeded. ` +
        `Severity: ${result.damageSeverity}. ` +
        `Vision duration: ${visionDuration}ms. Total duration: ${totalDuration}ms. ` +
        `Request ID: ${requestId}`
      );
      
      return result;
    } catch (visionError: any) {
      const visionErrorMessage = visionError?.message || 'Unknown error';
      const visionDuration = Date.now() - startTime;
      
      console.error(
        `[AI Assessment] Vision API assessment failed after ${visionDuration}ms. ` +
        `Error: ${visionErrorMessage}. ` +
        `Falling back to neutral scores. Request ID: ${requestId}`
      );
      
      errors.push({
        method: 'vision',
        error: visionErrorMessage,
      });
    }

    // ATTEMPT 3: Return neutral scores (final fallback)
    attemptedMethods.push('neutral');
    
    console.warn(
      `[AI Assessment] All AI methods failed. Returning neutral scores. ` +
      `Attempted methods: ${attemptedMethods.join(' → ')}. ` +
      `Request ID: ${requestId}`
    );
    
    const result = generateNeutralResponse(marketValue, vehicleContext);
    
    const totalDuration = Date.now() - startTime;
    console.info(
      `[AI Assessment] Neutral response generated. ` +
      `Total duration: ${totalDuration}ms. ` +
      `Request ID: ${requestId}`
    );
    
    return result;
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const totalDuration = Date.now() - startTime;
    
    console.error(
      `[AI Assessment] Assessment failed completely. ` +
      `Error: ${errorMessage}. ` +
      `Attempted methods: ${attemptedMethods.join(' → ')}. ` +
      `Duration: ${totalDuration}ms. ` +
      `Request ID: ${requestId}. ` +
      `Errors: ${JSON.stringify(errors)}`
    );
    
    throw new Error(`Failed to assess damage from images: ${errorMessage}`);
  }
}

/**
 * Extract text from document using Google Document AI OCR
 * @param imageUrl - Cloudinary URL of the document image
 * @returns Extracted text and confidence score
 */
export async function extractTextFromDocument(
  imageUrl: string
): Promise<OCRResult> {
  try {
    if (!documentAIClient) {
      throw new Error('Document AI client not initialized. Set MOCK_AI_ASSESSMENT=false and configure Google Cloud credentials.');
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = 'us'; // or 'eu'
    const processorId =
      process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || 'default';

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    // Fetch the image from Cloudinary
    const response = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Convert buffer to base64
    const encodedImage = imageBuffer.toString('base64');

    // Configure the request
    const request = {
      name,
      rawDocument: {
        content: encodedImage,
        mimeType: 'image/jpeg', // Assume JPEG, adjust if needed
      },
    };

    // Process the document
    const [result] = await documentAIClient.processDocument(request);
    const { document } = result;

    if (!document || !document.text) {
      return {
        text: '',
        confidence: 0,
        extractedFields: {},
      };
    }

    const text = document.text;

    interface DocumentPage {
      confidence?: number;
    }

    const confidence =
      (document.pages &&
        document.pages[0] &&
        (document.pages[0] as DocumentPage).confidence) ||
      0;

    // Extract common fields (can be customized based on document type)
    const extractedFields: Record<string, string> = {};

    // Example: Extract dates
    const dateMatch = text.match(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/);
    if (dateMatch) {
      extractedFields.date = dateMatch[0];
    }

    // Example: Extract numbers (could be amounts, IDs, etc.)
    const numberMatches = text.match(/\d+/g);
    if (numberMatches) {
      extractedFields.numbers = numberMatches.join(', ');
    }

    return {
      text,
      confidence: confidence * 100,
      extractedFields,
    };
  } catch (error) {
    console.error('Error extracting text from document:', error);
    throw new Error('Failed to extract text from document');
  }
}
