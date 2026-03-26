'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { Camera, Trash2, Upload, X } from 'lucide-react';
import Image from 'next/image';

export default function ProfilePicturePage() {
  const { data: session, update: updateSession } = useSession();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFullImage, setShowFullImage] = useState(false);

  const currentProfilePicture = session?.user?.profilePictureUrl;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setError(null);
    setSelectedFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/users/profile-picture', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Update session with new profile picture
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          profilePictureUrl: data.url,
        },
      });

      // Clear preview
      setPreviewUrl(null);
      setSelectedFile(null);

      // Show success message
      alert('Profile picture updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/users/profile-picture', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Deletion failed');
      }

      // Update session
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          profilePictureUrl: null,
        },
      });

      alert('Profile picture removed successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelPreview = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Profile Picture
        </h1>

        {/* Current Profile Picture */}
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            {currentProfilePicture ? 'Current Picture' : 'No Picture Yet'}
          </h2>
          <div className="flex items-center gap-4">
            <div 
              className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity border-2 border-gray-200"
              onClick={() => currentProfilePicture && setShowFullImage(true)}
            >
              {currentProfilePicture ? (
                <Image
                  src={currentProfilePicture}
                  alt="Profile"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-2">
              {currentProfilePicture && (
                <>
                  <p className="text-sm text-gray-600">
                    Click to view full size
                  </p>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isDeleting ? 'Removing...' : 'Remove Picture'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Upload New Picture */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            {currentProfilePicture ? 'Change Picture' : 'Upload Picture'}
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {currentProfilePicture 
              ? 'Upload a new image to replace your current profile picture' 
              : 'Upload an image to set as your profile picture'}
          </p>

          {previewUrl ? (
            <div className="space-y-4">
              <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100">
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="px-4 py-2 bg-[#800020] text-white rounded-lg hover:bg-[#600018] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isUploading ? 'Uploading...' : (currentProfilePicture ? 'Replace Picture' : 'Upload Picture')}
                </button>

                <button
                  onClick={cancelPreview}
                  disabled={isUploading}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-[#800020] transition-colors">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-1">
                    Click to select an image
                  </p>
                  <p className="text-xs text-gray-500">
                    JPEG, PNG, or WebP (max 5MB)
                  </p>
                </div>
              </label>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Guidelines */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Guidelines
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Use a clear, professional photo</li>
            <li>• Face should be clearly visible</li>
            <li>• Maximum file size: 5MB</li>
            <li>• Supported formats: JPEG, PNG, WebP</li>
          </ul>
        </div>
      </div>

      {/* Full Image Modal */}
      {showFullImage && currentProfilePicture && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 999999 }}>
          <div 
            className="fixed inset-0 bg-black bg-opacity-75"
            onClick={() => setShowFullImage(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="relative max-w-4xl max-h-[90vh] pointer-events-auto">
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300"
            >
              <X className="w-8 h-8" />
            </button>
            <Image
              src={currentProfilePicture}
              alt="Profile"
              width={800}
              height={800}
              className="rounded-lg"
            />
          </div>
        </div>
      </div>,
        document.body
      )}
    </div>
  );
}
