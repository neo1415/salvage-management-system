import { NextResponse } from 'next/server';
import { businessPolicyService } from '@/features/business-policy';

export async function GET() {
  try {
    const policy = await businessPolicyService.getPublicPolicy();

    return NextResponse.json(
      {
        success: true,
        policy,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Business-Policy-Version': policy.version,
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch public business policy:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch public business policy',
      },
      { status: 500 }
    );
  }
}
