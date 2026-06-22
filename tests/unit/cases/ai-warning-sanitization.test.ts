import { describe, expect, it } from 'vitest';
import { sanitizeAiAssessmentWarnings } from '@/features/cases/services/ai-warning-sanitization';

describe('sanitizeAiAssessmentWarnings', () => {
  it('collapses repeated EXIF metadata warnings into one staff note', () => {
    const warnings = [
      'Photo 1: No EXIF/IPTC/XMP metadata was found; this can happen after browser compression or Cloudinary processing, but staff should rely on visual review.',
      'Photo 2: No EXIF/IPTC/XMP metadata was found; this can happen after browser compression or Cloudinary processing, but staff should rely on visual review.',
      'Photo 3: No EXIF/IPTC/XMP metadata was found; this can happen after browser compression or Cloudinary processing, but staff should rely on visual review.',
    ];

    const result = sanitizeAiAssessmentWarnings(warnings);

    expect(result).toHaveLength(1);
    expect(result[0]).toContain('3 photo(s)');
    expect(result[0]).toContain('visual review');
  });

  it('groups luxury jewelry review reasons into actionable checklist items', () => {
    const warnings = [
      'Manual review: Luxury or multi-item jewelry/watch valuation requires declared insured value, purchase receipt, hallmark/serial verification, and specialist appraisal.',
      'Manual review: Generic marketplace prices are not accepted for Rolex, Cartier, diamond, gold, or mixed jewelry lots.',
      'Manual review: Market confidence 15% is below 65%.',
      'Manual review: Only 0 market source(s) met quality checks; 3 required.',
      'Manual review: Market evidence is not source-diverse.',
      'Manual review: Damage is labelled severe but calculated at 9% - confirm whether visible damage affects core functionality',
    ];

    const result = sanitizeAiAssessmentWarnings(warnings);

    expect(result.some((line) => line.includes('Luxury or multi-item jewelry/watch lot'))).toBe(true);
    expect(result.some((line) => /Market confidence 15%/i.test(line))).toBe(false);
    expect(result.some((line) => /Damage is labelled severe/i.test(line))).toBe(false);
    expect(result.length).toBeLessThan(warnings.length);
  });
});
