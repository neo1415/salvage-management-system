import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { 
  uploadFile, 
  deleteFile, 
  getProfilePictureFolder,
  PROFILE_PICTURE_PRESETS,
  validateFile 
} from '@/lib/storage/cloudinary';

/**
 * POST /api/users/profile-picture
 * Upload or update user profile picture
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(
      { size: file.size, type: file.type },
      5, // 5MB max
      ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get current user data
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete old profile picture if exists
    if (currentUser.profilePictureUrl) {
      try {
        // Extract public ID from URL
        const urlParts = currentUser.profilePictureUrl.split('/');
        const publicIdWithExt = urlParts.slice(-3).join('/'); // folder/userId/filename.ext
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, ''); // Remove extension
        
        await deleteFile(publicId, 'image');
      } catch (error) {
        console.error('Failed to delete old profile picture:', error);
        // Continue with upload even if deletion fails
      }
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const folder = getProfilePictureFolder(session.user.id, currentUser.role);
    const uploadResult = await uploadFile(buffer, {
      folder,
      publicId: 'avatar',
      resourceType: 'image',
      transformation: PROFILE_PICTURE_PRESETS.MEDIUM,
      tags: ['profile-picture', currentUser.role],
      compress: true,
      compressionPreset: 'MOBILE',
    });

    // Update user record
    await db
      .update(users)
      .set({
        profilePictureUrl: uploadResult.secureUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      url: uploadResult.secureUrl,
      message: 'Profile picture uploaded successfully',
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/profile-picture
 * Remove user profile picture
 */
export async function DELETE() {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user data
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser || !currentUser.profilePictureUrl) {
      return NextResponse.json(
        { error: 'No profile picture to delete' },
        { status: 404 }
      );
    }

    // Delete from Cloudinary
    try {
      const urlParts = currentUser.profilePictureUrl.split('/');
      const publicIdWithExt = urlParts.slice(-3).join('/');
      const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
      
      await deleteFile(publicId, 'image');
    } catch (error) {
      console.error('Failed to delete from Cloudinary:', error);
    }

    // Update user record
    await db
      .update(users)
      .set({
        profilePictureUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      message: 'Profile picture deleted successfully',
    });
  } catch (error) {
    console.error('Profile picture deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete profile picture' },
      { status: 500 }
    );
  }
}
