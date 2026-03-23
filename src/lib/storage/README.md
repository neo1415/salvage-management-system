# Cloudinary Storage Service

This module provides secure file upload, deletion, and transformation capabilities for the Salvage Management System using Cloudinary.

## Features

- ✅ Secure file uploads with signed URLs
- ✅ Automatic image compression and optimization
- ✅ Organized folder structure by entity type
- ✅ Multiple image transformation presets
- ✅ Batch file deletion
- ✅ File validation (size and type)
- ✅ CDN-optimized delivery

## Configuration

The service requires the following environment variables:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Folder Structure

Files are organized in the following folder structure:

- `/salvage-cases/{caseId}/` - Photos and documents for salvage cases
- `/kyc-documents/{vendorId}/` - KYC verification documents for vendors

## Transformation Presets

The service provides several image transformation presets:

### THUMBNAIL
- Size: 200x200px
- Crop: Fill
- Quality: Auto (good)
- Use case: List views, thumbnails

### MEDIUM
- Size: 800x600px
- Crop: Fit
- Quality: Auto (good)
- Use case: Detail views, modals

### LARGE
- Size: 1920x1080px
- Crop: Fit
- Quality: Auto (best)
- Use case: Full-screen views, downloads

### COMPRESSED
- Quality: Auto (eco)
- Flags: Lossy compression
- Use case: Mobile data savings, fast loading

## Usage Examples

### Server-Side Upload

```typescript
import { uploadFile, getSalvageCaseFolder, TRANSFORMATION_PRESETS } from '@/lib/storage/cloudinary';

// Upload a salvage case photo
const result = await uploadFile('/path/to/photo.jpg', {
  folder: getSalvageCaseFolder('case-123'),
  transformation: TRANSFORMATION_PRESETS.COMPRESSED,
  tags: ['vehicle', 'front-damage'],
});

console.log('Uploaded:', result.secureUrl);
```

### Client-Side Upload with Signed URL

```typescript
// Server-side: Generate signed upload parameters
import { generateSignedUploadParams, getSalvageCaseFolder } from '@/lib/storage/cloudinary';

export async function POST(request: Request) {
  const { caseId } = await request.json();
  
  const params = generateSignedUploadParams(
    getSalvageCaseFolder(caseId)
  );
  
  return Response.json(params);
}

// Client-side: Upload file using signed parameters
async function uploadPhoto(file: File, caseId: string) {
  // Get signed parameters from server
  const params = await fetch('/api/upload/sign', {
    method: 'POST',
    body: JSON.stringify({ caseId }),
  }).then(r => r.json());
  
  // Upload to Cloudinary
  const formData = new FormData();
  formData.append('file', file);
  formData.append('signature', params.signature);
  formData.append('timestamp', params.timestamp.toString());
  formData.append('folder', params.folder);
  formData.append('api_key', params.apiKey);
  
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${params.cloudName}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  );
  
  return response.json();
}
```

### Delete Files

```typescript
import { deleteFile, deleteMultipleFiles } from '@/lib/storage/cloudinary';

// Delete a single file
await deleteFile('salvage-cases/case-123/photo-1', 'image');

// Delete multiple files
await deleteMultipleFiles([
  'salvage-cases/case-123/photo-1',
  'salvage-cases/case-123/photo-2',
  'salvage-cases/case-123/photo-3',
]);
```

### Get Transformed URLs

```typescript
import { getTransformedUrl, TRANSFORMATION_PRESETS } from '@/lib/storage/cloudinary';

// Get thumbnail URL
const thumbnailUrl = getTransformedUrl(
  'salvage-cases/case-123/photo-1',
  TRANSFORMATION_PRESETS.THUMBNAIL
);

// Get custom transformation
const customUrl = getTransformedUrl(
  'salvage-cases/case-123/photo-1',
  {
    width: 400,
    height: 300,
    crop: 'fill',
    quality: 'auto:best',
    effect: 'sharpen',
  }
);
```

### File Validation

```typescript
import { validateFile } from '@/lib/storage/cloudinary';

// Validate file before upload
const validation = validateFile(
  file,
  5, // Max 5MB
  ['image/jpeg', 'image/png', 'image/jpg']
);

if (!validation.valid) {
  console.error(validation.error);
  return;
}

// Proceed with upload
```

## API Reference

### `uploadFile(file, options)`

Uploads a file to Cloudinary.

**Parameters:**
- `file` (string | Buffer) - File path or buffer to upload
- `options` (UploadOptions) - Upload configuration
  - `folder` (string) - Cloudinary folder path
  - `publicId` (string, optional) - Custom public ID
  - `transformation` (object, optional) - Transformation preset
  - `resourceType` ('image' | 'raw' | 'video' | 'auto', optional) - Resource type
  - `tags` (string[], optional) - Tags for organization

**Returns:** `Promise<UploadResult>`

### `generateSignedUploadParams(folder, publicId?, transformation?)`

Generates signed upload parameters for secure client-side uploads.

**Parameters:**
- `folder` (string) - Cloudinary folder path
- `publicId` (string, optional) - Custom public ID
- `transformation` (object, optional) - Transformation preset

**Returns:** `SignedUploadParams`

### `deleteFile(publicId, resourceType?)`

Deletes a single file from Cloudinary.

**Parameters:**
- `publicId` (string) - The public ID of the file
- `resourceType` ('image' | 'raw' | 'video', optional) - Resource type (default: 'image')

**Returns:** `Promise<{ result: string }>`

### `deleteMultipleFiles(publicIds, resourceType?)`

Deletes multiple files from Cloudinary.

**Parameters:**
- `publicIds` (string[]) - Array of public IDs
- `resourceType` ('image' | 'raw' | 'video', optional) - Resource type (default: 'image')

**Returns:** `Promise<{ deleted: Record<string, string> }>`

### `getTransformedUrl(publicId, transformation)`

Gets a transformed image URL.

**Parameters:**
- `publicId` (string) - The public ID of the image
- `transformation` (object) - Transformation configuration

**Returns:** `string` - Transformed image URL

### `getSalvageCaseFolder(caseId)`

Helper to build folder path for salvage cases.

**Parameters:**
- `caseId` (string) - The salvage case ID

**Returns:** `string` - Folder path

### `getKycDocumentFolder(vendorId)`

Helper to build folder path for KYC documents.

**Parameters:**
- `vendorId` (string) - The vendor ID

**Returns:** `string` - Folder path

### `validateFile(file, maxSizeMB?, allowedTypes?)`

Validates file size and type.

**Parameters:**
- `file` (object) - File object with `size` and `type` properties
- `maxSizeMB` (number, optional) - Maximum file size in MB (default: 5)
- `allowedTypes` (string[], optional) - Allowed MIME types

**Returns:** `{ valid: boolean; error?: string }`

## Security Considerations

1. **Signed Uploads**: Always use signed upload parameters for client-side uploads to prevent unauthorized uploads.

2. **Folder Isolation**: Files are organized by entity ID to prevent cross-entity access.

3. **File Validation**: Always validate file size and type before upload.

4. **Secure URLs**: All URLs use HTTPS for secure delivery.

5. **API Secret**: Never expose `CLOUDINARY_API_SECRET` to the client. Only use it server-side.

## Performance Optimization

1. **Automatic Format**: The `fetch_format: 'auto'` parameter automatically delivers WebP to supported browsers.

2. **Quality Optimization**: The `quality: 'auto'` parameter automatically optimizes quality based on content.

3. **CDN Delivery**: All files are delivered via Cloudinary's global CDN for fast loading.

4. **Lazy Loading**: Use transformation presets to load appropriate sizes for different contexts.

5. **Compression**: The COMPRESSED preset reduces file size for mobile data savings.

## Error Handling

All functions throw errors with descriptive messages. Always wrap calls in try-catch blocks:

```typescript
try {
  const result = await uploadFile(file, options);
  console.log('Success:', result.secureUrl);
} catch (error) {
  console.error('Upload failed:', error.message);
  // Handle error appropriately
}
```

## Testing

See `tests/unit/storage/cloudinary.test.ts` for unit tests.

## Requirements

This module satisfies the following requirements:
- Requirement 12.8: Photo upload to cloud storage
- Requirement 12.9: Image compression
- Enterprise Standards Section 14.2: File storage and CDN
