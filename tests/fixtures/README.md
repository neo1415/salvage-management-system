# Test Fixtures

This directory contains test files used by E2E tests.

## Required Files for Case Creation E2E Tests

The following image files are required for the case creation autocomplete E2E tests:

- `test-photo-1.jpg` - Test vehicle photo (any valid JPEG image)
- `test-photo-2.jpg` - Test vehicle photo (any valid JPEG image)
- `test-photo-3.jpg` - Test vehicle photo (any valid JPEG image)

These files should be actual image files (can be small placeholder images) to test the photo upload functionality.

## Creating Test Images

You can create simple test images using any of these methods:

1. **Using ImageMagick:**
   ```bash
   convert -size 800x600 xc:blue test-photo-1.jpg
   convert -size 800x600 xc:red test-photo-2.jpg
   convert -size 800x600 xc:green test-photo-3.jpg
   ```

2. **Using online tools:**
   - Visit https://placeholder.com/ or similar services
   - Download placeholder images
   - Rename them to match the required filenames

3. **Using existing photos:**
   - Copy any 3 JPEG images from your system
   - Rename them to match the required filenames

## File Requirements

- Format: JPEG (.jpg)
- Size: Any size (tests don't validate specific dimensions)
- Content: Any image content (can be solid colors or actual photos)

## Note

These are test fixtures only and are not committed to the repository. Each developer should create their own test images locally before running E2E tests.
