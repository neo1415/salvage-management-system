/**
 * Example Component: Cloudinary Upload
 * 
 * This component demonstrates how to upload files to Cloudinary using signed upload parameters.
 * It shows the complete flow from getting signed params to uploading the file.
 * 
 * Usage:
 * ```tsx
 * <CloudinaryUploadExample
 *   entityType="salvage-case"
 *   entityId="case-123"
 *   onUploadComplete={(result) => console.log('Uploaded:', result)}
 * />
 * ```
 */

'use client';

import { useState } from 'react';

interface CloudinaryUploadExampleProps {
  entityType: 'salvage-case' | 'kyc-document';
  entityId: string;
  transformation?: 'thumbnail' | 'medium' | 'large' | 'compressed';
  onUploadComplete?: (result: CloudinaryUploadResult) => void;
  onUploadError?: (error: string) => void;
}

interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

export function CloudinaryUploadExample({
  entityType,
  entityId,
  transformation,
  onUploadComplete,
  onUploadError,
}: CloudinaryUploadExampleProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      const errorMsg = 'File size exceeds 5MB limit';
      setError(errorMsg);
      onUploadError?.(errorMsg);
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      const errorMsg = `File type ${file.type} is not allowed`;
      setError(errorMsg);
      onUploadError?.(errorMsg);
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setProgress(0);

      // Step 1: Get signed upload parameters from server
      const signResponse = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType,
          entityId,
          transformation,
        }),
      });

      if (!signResponse.ok) {
        throw new Error('Failed to get signed upload parameters');
      }

      const signData = await signResponse.json();

      // Step 2: Upload file to Cloudinary using signed parameters
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', signData.signature);
      formData.append('timestamp', signData.timestamp.toString());
      formData.append('folder', signData.folder);
      formData.append('api_key', signData.apiKey);

      if (signData.transformation) {
        formData.append('transformation', signData.transformation);
      }

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise<CloudinaryUploadResult>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const result = JSON.parse(xhr.responseText);
            resolve(result);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.open('POST', signData.uploadUrl);
        xhr.send(formData);
      });

      const result = await uploadPromise;

      // Success
      setUploadedUrl(result.secure_url);
      setProgress(100);
      onUploadComplete?.(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMsg);
      onUploadError?.(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Upload to Cloudinary</h2>
      
      <div className="mb-4">
        <label
          htmlFor="file-upload"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Select File
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/jpeg,image/png,image/jpg,image/heic,application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">
          Max file size: 5MB. Allowed types: JPEG, PNG, HEIC, PDF
        </p>
      </div>

      {uploading && (
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium text-blue-700">Uploading...</span>
            <span className="text-sm font-medium text-blue-700">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {uploadedUrl && (
        <div className="mb-4">
          <p className="text-sm font-medium text-green-700 mb-2">Upload successful!</p>
          <div className="relative aspect-video bg-gray-100 rounded-md overflow-hidden">
            <img
              src={uploadedUrl}
              alt="Uploaded file"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 break-all">{uploadedUrl}</p>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>Entity Type: {entityType}</p>
        <p>Entity ID: {entityId}</p>
        {transformation && <p>Transformation: {transformation}</p>}
      </div>
    </div>
  );
}
