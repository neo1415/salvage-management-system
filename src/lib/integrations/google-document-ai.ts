/**
 * Google Document AI Integration
 * Extracts text from documents using OCR
 */

import { getGoogleCloudClientOptions } from '@/lib/integrations/google-cloud-client';

type DocumentProcessorServiceClient =
  import('@google-cloud/documentai').DocumentProcessorServiceClient;
type ImageAnnotatorClient = import('@google-cloud/vision').ImageAnnotatorClient;

const predictionEndpoint =
  process.env.GOOGLE_DOCUMENT_AI_PREDICTION_ENDPOINT?.trim() ||
  process.env.PREDICTION_ENDPOINT?.trim();

const documentAiApiEndpoint = predictionEndpoint?.match(/^https:\/\/([^/]+)/i)?.[1];

let documentAiClient: DocumentProcessorServiceClient | null = null;
let visionOcrClient: ImageAnnotatorClient | null = null;

async function getDocumentAiClient(): Promise<DocumentProcessorServiceClient | null> {
  if (documentAiClient) return documentAiClient;
  const options = getGoogleCloudClientOptions();
  if (!options) return null;
  const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai');
  documentAiClient = new DocumentProcessorServiceClient({
    ...options,
    ...(documentAiApiEndpoint ? { apiEndpoint: documentAiApiEndpoint } : {}),
  });
  return documentAiClient;
}

async function getVisionOcrClient(): Promise<ImageAnnotatorClient | null> {
  if (visionOcrClient) return visionOcrClient;
  const options = getGoogleCloudClientOptions();
  if (!options) return null;
  const { ImageAnnotatorClient } = await import('@google-cloud/vision');
  visionOcrClient = new ImageAnnotatorClient(options);
  return visionOcrClient;
}

function hasDocumentAiProcessor(): boolean {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();
  return Boolean(
    getProcessorNameFromPredictionEndpoint() ||
    (projectId && processorId && processorId.toLowerCase() !== 'default')
  );
}

function getDocumentAiProcessorName(): string {
  const endpointProcessorName = getProcessorNameFromPredictionEndpoint();
  if (endpointProcessorName) return endpointProcessorName;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID?.trim();
  const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION?.trim() || 'us';
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID?.trim();

  if (!projectId || !processorId || processorId.toLowerCase() === 'default') {
    throw new Error(
      'Google Document AI processor is not configured. Set GOOGLE_DOCUMENT_AI_PROCESSOR_ID to a real processor id.'
    );
  }

  return `projects/${projectId}/locations/${location}/processors/${processorId}`;
}

function getProcessorNameFromPredictionEndpoint(): string | null {
  if (!predictionEndpoint) return null;
  const match = predictionEndpoint.match(/\/v1\/(projects\/[^/]+\/locations\/[^/]+\/processors\/[^/:]+):process$/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function extractTextWithVision(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{ text: string; confidence: number }> {
  if (!mimeType.startsWith('image/')) {
    throw new Error('Google Vision OCR fallback only supports image uploads. Configure Google Document AI for PDF OCR.');
  }

  const client = await getVisionOcrClient();
  if (!client) {
    throw new Error('Google Vision OCR is not configured');
  }

  const [result] = await client.documentTextDetection({
    image: { content: imageBuffer },
  });
  const text = result.fullTextAnnotation?.text ?? result.textAnnotations?.[0]?.description ?? '';
  const pageConfidence = result.fullTextAnnotation?.pages?.[0]?.confidence;

  return {
    text,
    confidence: typeof pageConfidence === 'number' ? pageConfidence * 100 : text ? 70 : 0,
  };
}

export interface ExtractedNINData {
  nin: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  confidence: number;
  rawText: string;
}

/**
 * Extract NIN from uploaded ID document
 */
export async function extractNINFromDocument(
  imageBuffer: Buffer,
  mimeType: string
): Promise<ExtractedNINData> {
  try {
    if (!hasDocumentAiProcessor()) {
      const vision = await extractTextWithVision(imageBuffer, mimeType);
      const text = vision.text;
      const ninMatch = text.match(/\b\d{11}\b/);
      const nameMatch = text.match(/(?:Name|FULL NAME|Surname)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
      const dobMatch = text.match(/(?:Date of Birth|DOB|Born)[\s:]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
      return {
        nin: ninMatch ? ninMatch[0] : null,
        fullName: nameMatch ? nameMatch[1].trim() : null,
        dateOfBirth: dobMatch ? dobMatch[1] : null,
        confidence: vision.confidence,
        rawText: text,
      };
    }

    const name = getDocumentAiProcessorName();

    // Convert buffer to base64
    const encodedImage = imageBuffer.toString('base64');

    // Configure the request
    const request = {
      name,
      rawDocument: {
        content: encodedImage,
        mimeType,
      },
    };

    // Process the document
    const client = await getDocumentAiClient();
    if (!client) {
      throw new Error('Google Document AI is not configured');
    }

    const [result] = await client.processDocument(request);
    const { document } = result;

    if (!document || !document.text) {
      return {
        nin: null,
        fullName: null,
        dateOfBirth: null,
        confidence: 0,
        rawText: '',
      };
    }

    const text = document.text;
    
    interface DocumentPage {
      confidence?: number;
    }
    
    const confidence = (document.pages && document.pages[0] && (document.pages[0] as DocumentPage).confidence) || 0;

    // Extract NIN (11 digits)
    const ninMatch = text.match(/\b\d{11}\b/);
    const nin = ninMatch ? ninMatch[0] : null;

    // Extract full name (look for common patterns)
    const nameMatch = text.match(/(?:Name|FULL NAME|Surname)[\s:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
    const fullName = nameMatch ? nameMatch[1].trim() : null;

    // Extract date of birth (various formats)
    const dobMatch = text.match(/(?:Date of Birth|DOB|Born)[\s:]+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i);
    const dateOfBirth = dobMatch ? dobMatch[1] : null;

    return {
      nin,
      fullName,
      dateOfBirth,
      confidence: confidence * 100,
      rawText: text,
    };
  } catch (error) {
    console.error('Error extracting NIN from document:', error);
    throw new Error('Failed to extract NIN from document');
  }
}

/**
 * Extract text from any document (CAC certificate, bank statement, etc.)
 */
export async function extractTextFromDocument(
  imageBuffer: Buffer,
  mimeType: string
): Promise<{ text: string; confidence: number }> {
  try {
    if (!hasDocumentAiProcessor()) {
      return extractTextWithVision(imageBuffer, mimeType);
    }

    const name = getDocumentAiProcessorName();

    const encodedImage = imageBuffer.toString('base64');

    const request = {
      name,
      rawDocument: {
        content: encodedImage,
        mimeType,
      },
    };

    const client = await getDocumentAiClient();
    if (!client) {
      throw new Error('Google Document AI is not configured');
    }

    const [result] = await client.processDocument(request);
    const { document } = result;

    if (!document || !document.text) {
      return { text: '', confidence: 0 };
    }

    interface DocumentPage {
      confidence?: number;
    }
    
    const confidence = (document.pages && document.pages[0] && (document.pages[0] as DocumentPage).confidence) || 0;

    return {
      text: document.text,
      confidence: confidence * 100,
    };
  } catch (error) {
    console.error('Error extracting text from document:', error);
    throw new Error('Failed to extract text from document');
  }
}
