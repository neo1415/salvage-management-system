/**
 * Google Document AI Integration
 * Extracts text from documents using OCR
 */

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Initialize the Document AI client
const client = new DocumentProcessorServiceClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

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
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = 'us'; // or 'eu'
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || 'default';

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

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
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = 'us';
    const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || 'default';

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    const encodedImage = imageBuffer.toString('base64');

    const request = {
      name,
      rawDocument: {
        content: encodedImage,
        mimeType,
      },
    };

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
