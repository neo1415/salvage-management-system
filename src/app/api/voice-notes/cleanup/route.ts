import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * POST /api/voice-notes/cleanup
 * 
 * Clean up voice transcription text using Gemini AI:
 * - Add proper punctuation
 * - Fix capitalization
 * - Remove filler words
 * - Improve readability
 */
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Use Gemini to clean up the text
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a professional text editor. Clean up the following voice transcription text:

INSTRUCTIONS:
1. Add proper punctuation (periods, commas, question marks, etc.)
2. Fix capitalization (proper sentence case)
3. Remove filler words (um, uh, like, you know, etc.)
4. Improve readability while preserving the original meaning
5. Keep timestamps in [HH:MM] format if present
6. Do NOT add or change any factual information
7. Do NOT add commentary or explanations
8. Return ONLY the cleaned text, nothing else

TEXT TO CLEAN:
${text}

CLEANED TEXT:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const cleanedText = response.text().trim();

    return NextResponse.json({
      cleanedText,
      originalLength: text.length,
      cleanedLength: cleanedText.length,
    });
  } catch (error) {
    console.error('Voice note cleanup error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clean up text',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
