import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { businessPolicyService, validateBusinessPolicy } from '@/features/business-policy';
import type { BusinessPolicy } from '@/features/business-policy/types';

function getRequestMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'system_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const [policy, runtimePolicy, publishedPolicy, versions] = await Promise.all([
      businessPolicyService.getEffectivePolicy(),
      businessPolicyService.getRuntimeDefaultPolicy(),
      businessPolicyService.getPublishedPolicy(),
      businessPolicyService.listPolicyVersions(),
    ]);
    const validation = validateBusinessPolicy(policy);

    return NextResponse.json({
      success: true,
      policy,
      runtimePolicy,
      publishedPolicy,
      versions,
      publicPolicy: businessPolicyService.toPublicPolicy(policy),
      validation,
      mode: 'draft_publish_preview',
    });
  } catch (error) {
    console.error('[BusinessPolicy] Failed to load admin policy preview', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to load business policy preview' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'system_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const policy = body?.policy as BusinessPolicy | undefined;

    if (!policy || typeof policy !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Policy payload is required' },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = getRequestMeta(request);
    const result = await businessPolicyService.saveDraftPolicy({
      policy,
      actorId: session.user.id,
      notes: typeof body?.notes === 'string' ? body.notes : undefined,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[BusinessPolicy] Failed to save policy draft', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to save business policy draft' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'system_admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (body?.action !== 'publish' || typeof body?.id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Publish action and draft id are required' },
        { status: 400 }
      );
    }

    const { ipAddress, userAgent } = getRequestMeta(request);
    const result = await businessPolicyService.publishPolicy({
      id: body.id,
      actorId: session.user.id,
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    revalidatePath('/', 'layout');
    revalidatePath('/');
    revalidatePath('/login');
    revalidatePath('/register');
    revalidatePath('/manifest.webmanifest');

    return NextResponse.json(result);
  } catch (error) {
    console.error('[BusinessPolicy] Failed to publish policy', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { success: false, error: 'Failed to publish business policy' },
      { status: 500 }
    );
  }
}
