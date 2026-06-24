import { describe, expect, it } from 'vitest';
import {
  formatStaffReviewNotes,
  sanitizeAiAssessmentWarnings,
} from '@/features/cases/services/ai-warning-sanitization';

describe('staff review note sanitization', () => {
  it('removes provider API errors and keeps a short staff message', () => {
    const notes = formatStaffReviewNotes(
      [
        'Only 2 accepted market source(s); 3 required.',
        'Gemini grounded price adjudication unavailable: [GoogleGenerativeAI Error] quota exceeded',
        'Claude web price adjudication unavailable: 400 invalid_request_error web_search_20260318',
      ],
      ['4 photo(s): Camera metadata was not embedded'],
      { confidenceScore: 72, manualReviewRequired: true }
    );

    expect(notes.length).toBeLessThanOrEqual(2);
    expect(notes.join(' ')).not.toMatch(/GoogleGenerativeAI|web_search_|quota exceeded/i);
    expect(notes.some((line) => /verify market value/i.test(line))).toBe(true);
  });

  it('keeps actionable specialist jewelry guidance when relevant', () => {
    const notes = sanitizeAiAssessmentWarnings(
      [
        'Luxury or multi-item jewelry/watch valuation requires declared insured value, purchase receipt, hallmark/serial verification, and specialist appraisal.',
      ],
      [],
      { confidenceScore: 40, manualReviewRequired: true }
    );

    expect(notes.some((line) => /specialist appraisal/i.test(line))).toBe(true);
    expect(notes.length).toBeLessThanOrEqual(2);
  });
});
