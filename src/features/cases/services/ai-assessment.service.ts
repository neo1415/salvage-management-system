/**
 * AI Damage Assessment Service
 * Uses Google Cloud Vision API to analyze damage from photos
 */

import { ImageAnnotatorClient } from '@google-cloud/vision';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Initialize the Vision API client
const visionClient = new ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Initialize the Document AI client
const documentAIClient = new DocumentProcessorServiceClient({
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
}

export interface OCRResult {
  text: string;
  confidence: number;
  extractedFields: Record<string, string>;
}

/**
 * Assess damage from uploaded photos using Google Cloud Vision API
 * @param imageUrls - Array of Cloudinary URLs for uploaded photos
 * @param marketValue - Market value of the asset
 * @returns Damage assessment with severity, estimated value, and reserve price
 */
export async function assessDamage(
  imageUrls: string[],
  marketValue: number
): Promise<DamageAssessmentResult> {
  try {
    if (!imageUrls || imageUrls.length === 0) {
      throw new Error('At least one image URL is required for damage assessment');
    }

    // Analyze all images and collect labels
    const allLabels: Array<{ description: string; score: number }> = [];
    let totalConfidence = 0;

    for (const imageUrl of imageUrls) {
      const [result] = await visionClient.labelDetection(imageUrl);
      const labels = result.labelAnnotations || [];

      // Collect labels with their confidence scores
      labels.forEach((label) => {
        if (label.description && label.score !== undefined && label.score !== null && !isNaN(label.score)) {
          allLabels.push({
            description: label.description,
            score: label.score,
          });
        }
      });

      // Calculate average confidence for this image
      if (labels.length > 0) {
        const validLabels = labels.filter(l => l.score !== undefined && l.score !== null && !isNaN(l.score));
        if (validLabels.length > 0) {
          const imageConfidence =
            validLabels.reduce((sum, label) => sum + (label.score ?? 0), 0) / validLabels.length;
          totalConfidence += imageConfidence;
        }
      }
    }

    // Calculate overall confidence score (0-100)
    const confidenceScore =
      imageUrls.length > 0 ? (totalConfidence / imageUrls.length) * 100 : 0;

    // Extract unique damage-related labels
    const damageKeywords = [
      'damage',
      'broken',
      'crack',
      'dent',
      'scratch',
      'shattered',
      'bent',
      'rust',
      'collision',
      'accident',
      'wreck',
      'destroyed',
      'smashed',
      'crushed',
      'torn',
      'burned',
      'fire',
      'water damage',
      'flood',
    ];

    const damageLabels = allLabels
      .filter((label) =>
        damageKeywords.some((keyword) =>
          label.description.toLowerCase().includes(keyword)
        )
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Top 10 damage-related labels
      .map((label) => label.description);

    // If no specific damage labels found, use general labels
    const labels =
      damageLabels.length > 0
        ? damageLabels
        : allLabels
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map((label) => label.description);

    // Calculate damage percentage based on label analysis
    // More damage-related labels = higher damage percentage
    const damagePercentage = calculateDamagePercentage(allLabels, damageKeywords);

    // Determine damage severity based on percentage
    // Minor: 40-60% of value remains (40-60% damage)
    // Moderate: 20-40% of value remains (60-80% damage)
    // Severe: 5-20% of value remains (80-95% damage)
    let damageSeverity: 'minor' | 'moderate' | 'severe';
    if (damagePercentage >= 40 && damagePercentage <= 60) {
      damageSeverity = 'minor';
    } else if (damagePercentage >= 60 && damagePercentage <= 80) {
      damageSeverity = 'moderate';
    } else {
      damageSeverity = 'severe';
    }

    // Calculate estimated salvage value: marketValue × (100 - damagePercentage) / 100
    const estimatedSalvageValue = marketValue * ((100 - damagePercentage) / 100);

    // Calculate reserve price: estimatedValue × 0.7
    const reservePrice = estimatedSalvageValue * 0.7;

    return {
      labels,
      confidenceScore: Math.round(confidenceScore),
      damagePercentage: Math.round(damagePercentage),
      processedAt: new Date(),
      damageSeverity,
      estimatedSalvageValue: Math.round(estimatedSalvageValue * 100) / 100,
      reservePrice: Math.round(reservePrice * 100) / 100,
    };
  } catch (error) {
    console.error('Error assessing damage:', error);
    throw new Error('Failed to assess damage from images');
  }
}

/**
 * Calculate damage percentage based on label analysis
 * @param labels - All labels detected in images
 * @param damageKeywords - Keywords indicating damage
 * @returns Damage percentage (0-100)
 */
function calculateDamagePercentage(
  labels: Array<{ description: string; score: number }>,
  damageKeywords: string[]
): number {
  // Count damage-related labels and their confidence
  let damageScore = 0;
  let damageCount = 0;

  labels.forEach((label) => {
    const isDamageRelated = damageKeywords.some((keyword) =>
      label.description.toLowerCase().includes(keyword)
    );

    if (isDamageRelated) {
      damageScore += label.score;
      damageCount++;
    }
  });

  // If no damage labels found, assume minor damage (50%)
  if (damageCount === 0) {
    return 50;
  }

  // Calculate average damage confidence
  const avgDamageConfidence = damageScore / damageCount;

  // Map confidence to damage percentage
  // High confidence in damage labels = high damage percentage
  // Scale: 0.5 confidence = 50% damage, 1.0 confidence = 90% damage
  const damagePercentage = 50 + avgDamageConfidence * 40;

  // Also factor in the number of damage labels
  // More damage labels = higher damage
  const labelCountFactor = Math.min(damageCount / 5, 1); // Cap at 5 labels
  const adjustedDamage = damagePercentage + labelCountFactor * 10;

  // Ensure damage is within valid range (40-95%)
  return Math.max(40, Math.min(95, adjustedDamage));
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
