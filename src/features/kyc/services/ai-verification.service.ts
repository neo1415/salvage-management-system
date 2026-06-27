import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { isClaudeKycFallbackEnabled } from '@/lib/ai/provider-cost-controls';

interface VerificationInput {
  businessName: string;
  businessType: string;
  nin: string;
  bvn: string;
  address: string;
  documents: {
    ninCard: string;
    utilityBill: string;
    bankStatement: string;
    photoId: string;
    cacCertificate: string | null;
  };
}

interface VerificationResult {
  score: number; // 0-100
  recommendation: 'approve' | 'review' | 'reject';
  findings: {
    documentQuality: string;
    dataConsistency: string;
    authenticity: string;
    concerns: string[];
  };
  details: {
    ninCardAnalysis: string;
    utilityBillAnalysis: string;
    bankStatementAnalysis: string;
    photoIdAnalysis: string;
    cacCertificateAnalysis?: string;
  };
}

/**
 * AI Verification Service
 * 
 * Uses Gemini 2.0 Flash (primary) or Claude Sonnet 4.6 (fallback) to verify KYC documents.
 * 
 * Cost per verification:
 * - Gemini: ~$0.01 (10 requests/min, 1,500/day free tier)
 * - Claude: ~$0.60-$1.20 (if Gemini fails)
 * 
 * This is significantly cheaper than Dojah (₦510-630 per verification).
 */
export class AIVerificationService {
  private claude: Anthropic | null = null;
  private gemini: GoogleGenerativeAI | null = null;

  constructor() {
    // Initialize Claude (fallback)
    if (process.env.CLAUDE_API_KEY && isClaudeKycFallbackEnabled()) {
      this.claude = new Anthropic({
        apiKey: process.env.CLAUDE_API_KEY,
      });
    }

    // Initialize Gemini (primary)
    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
  }

  async verifyDocuments(input: VerificationInput): Promise<VerificationResult> {
    try {
      // Try Gemini first (cheaper, faster)
      if (this.gemini) {
        console.log('[AI Verification] Using Gemini 2.0 Flash');
        return await this.verifyWithGemini(input);
      }

      // Fallback to Claude
      if (this.claude) {
        console.log('[AI Verification] Using Claude Sonnet 4.6');
        return await this.verifyWithClaude(input);
      }

      throw new Error('No AI service available');
    } catch (error) {
      console.error('[AI Verification] Error:', error);
      
      // Return a default "needs review" result if AI fails
      return {
        score: 50,
        recommendation: 'review',
        findings: {
          documentQuality: 'Unable to verify automatically',
          dataConsistency: 'Manual review required',
          authenticity: 'Manual review required',
          concerns: ['AI verification failed - manual review required'],
        },
        details: {
          ninCardAnalysis: 'Manual review required',
          utilityBillAnalysis: 'Manual review required',
          bankStatementAnalysis: 'Manual review required',
          photoIdAnalysis: 'Manual review required',
        },
      };
    }
  }

  private async verifyWithGemini(input: VerificationInput): Promise<VerificationResult> {
    const model = this.gemini!.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = this.buildVerificationPrompt(input);

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return this.parseAIResponse(response);
  }

  private async verifyWithClaude(input: VerificationInput): Promise<VerificationResult> {
    const prompt = this.buildVerificationPrompt(input);

    const message = await this.claude!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const response = message.content[0].type === 'text' ? message.content[0].text : '';

    return this.parseAIResponse(response);
  }

  private buildVerificationPrompt(input: VerificationInput): string {
    return `You are a KYC verification expert. Analyze the following documents and data for a Tier 2 KYC application.

**Applicant Information:**
- Business Name: ${input.businessName}
- Business Type: ${input.businessType}
- NIN: ${input.nin}
- BVN: ${input.bvn}
- Address: ${input.address}

**Documents Provided:**
- NIN Card: ${input.documents.ninCard}
- Utility Bill: ${input.documents.utilityBill}
- Bank Statement: ${input.documents.bankStatement}
- Photo ID: ${input.documents.photoId}
${input.documents.cacCertificate ? `- CAC Certificate: ${input.documents.cacCertificate}` : ''}

**Your Task:**
1. Assess document quality (clear, readable, not tampered)
2. Check data consistency (names, addresses match across documents)
3. Evaluate authenticity (look for signs of forgery)
4. Identify any concerns or red flags

**Output Format (JSON):**
{
  "score": <0-100>,
  "recommendation": "<approve|review|reject>",
  "findings": {
    "documentQuality": "<assessment>",
    "dataConsistency": "<assessment>",
    "authenticity": "<assessment>",
    "concerns": ["<concern1>", "<concern2>"]
  },
  "details": {
    "ninCardAnalysis": "<analysis>",
    "utilityBillAnalysis": "<analysis>",
    "bankStatementAnalysis": "<analysis>",
    "photoIdAnalysis": "<analysis>"
    ${input.documents.cacCertificate ? ', "cacCertificateAnalysis": "<analysis>"' : ''}
  }
}

**Scoring Guidelines:**
- 80-100: Approve (all documents clear, data consistent, no concerns)
- 50-79: Review (minor issues, needs human verification)
- 0-49: Reject (major concerns, likely fraud)

Provide your analysis in JSON format only.`;
  }

  private parseAIResponse(response: string): VerificationResult {
    try {
      // Extract JSON from response (AI might wrap it in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and return
      return {
        score: Math.max(0, Math.min(100, parsed.score || 50)),
        recommendation: ['approve', 'review', 'reject'].includes(parsed.recommendation)
          ? parsed.recommendation
          : 'review',
        findings: {
          documentQuality: parsed.findings?.documentQuality || 'Unknown',
          dataConsistency: parsed.findings?.dataConsistency || 'Unknown',
          authenticity: parsed.findings?.authenticity || 'Unknown',
          concerns: Array.isArray(parsed.findings?.concerns) ? parsed.findings.concerns : [],
        },
        details: {
          ninCardAnalysis: parsed.details?.ninCardAnalysis || 'No analysis',
          utilityBillAnalysis: parsed.details?.utilityBillAnalysis || 'No analysis',
          bankStatementAnalysis: parsed.details?.bankStatementAnalysis || 'No analysis',
          photoIdAnalysis: parsed.details?.photoIdAnalysis || 'No analysis',
          cacCertificateAnalysis: parsed.details?.cacCertificateAnalysis,
        },
      };
    } catch (error) {
      console.error('[AI Verification] Failed to parse response:', error);
      
      // Return default "needs review" if parsing fails
      return {
        score: 50,
        recommendation: 'review',
        findings: {
          documentQuality: 'Unable to parse AI response',
          dataConsistency: 'Manual review required',
          authenticity: 'Manual review required',
          concerns: ['AI response parsing failed'],
        },
        details: {
          ninCardAnalysis: 'Manual review required',
          utilityBillAnalysis: 'Manual review required',
          bankStatementAnalysis: 'Manual review required',
          photoIdAnalysis: 'Manual review required',
        },
      };
    }
  }
}
