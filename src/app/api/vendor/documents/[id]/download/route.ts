/**
 * GET /api/vendor/documents/[id]/download
 * Download a document PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { downloadDocument } from '@/features/documents/services/document.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id || !session.user.vendorId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get client information for audit logging
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.includes('Mobile') ? 'mobile' : 'desktop';

    // Download document (with audit logging)
    const { pdfUrl, title, documentType, assetDescription, createdAt } = await downloadDocument(
      documentId,
      session.user.vendorId,
      'direct_download',
      ipAddress,
      deviceType,
      userAgent
    );

    // Fetch the PDF from Cloudinary
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error('Failed to fetch PDF from storage');
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Generate useful filename: {assetDescription}_{documentType}_{date}.pdf
    const date = new Date(createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedAsset = assetDescription.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    const sanitizedType = documentType.replace(/_/g, '_');
    const filename = `${sanitizedAsset}_${sanitizedType}_${date}.pdf`;

    // Return PDF with proper headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error downloading document:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('unauthorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }
      
      if (error.message.includes('not available')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}
