/**
 * AI Assessment API Endpoint
 * 
 * Standalone endpoint for running AI assessment on photos
 * without creating a case. Used for real-time feedback during case creation.
 * 
 * Accepts base64 data URLs (data:image/jpeg;base64,...) or regular image URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { assessDamage } from '@/features/cases/services/ai-assessment.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { photos } = body;

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

    // For demo purposes, estimate market value from photo count
    // In production, this would use more sophisticated pricing models
    const estimatedMarketValue = 500000 + (photos.length * 50000);

    // Run AI assessment
    console.log(`Running AI assessment on ${photos.length} photos...`);
    const aiAssessment = await assessDamage(photos, estimatedMarketValue);
    console.log('AI Assessment Result:', aiAssessment);

    return NextResponse.json({
      success: true,
      data: {
        damageSeverity: aiAssessment.damageSeverity,
        confidenceScore: aiAssessment.confidenceScore,
        labels: aiAssessment.labels,
        estimatedSalvageValue: aiAssessment.estimatedSalvageValue,
        reservePrice: aiAssessment.reservePrice,
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
