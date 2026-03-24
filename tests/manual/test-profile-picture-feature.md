# Manual Test: Profile Picture Feature

## Prerequisites
- ✅ Database migration completed (`npx tsx scripts/run-profile-picture-migration.ts`)
- ✅ Cloudinary credentials configured in `.env`
- ✅ TinyPNG API key configured (optional but recommended)
- ✅ Development server running (`npm run dev`)

## Test 1: Upload Profile Picture (Vendor)

### Steps
1. Log in as a vendor user
2. Navigate to Settings → Profile Picture (`/vendor/settings/profile-picture`)
3. Drag and drop an image OR click "Choose File"
4. Select a JPEG/PNG image (< 5MB)
5. Click "Upload Profile Picture"

### Expected Results
- ✅ Image preview shows before upload
- ✅ Upload progress indicator appears
- ✅ Success message: "Profile picture uploaded successfully!"
- ✅ Image displays in preview area
- ✅ "Delete Profile Picture" button appears
- ✅ Sidebar shows profile picture (desktop)
- ✅ Mobile header shows profile picture (top-right)
- ✅ Mobile sidebar shows profile picture

### Verify
- Check Cloudinary dashboard for uploaded image
- Check database: `SELECT profile_picture_url FROM users WHERE id = 'your-user-id'`
- Refresh page - picture should persist

## Test 2: View Full-Size Image

### Steps
1. After uploading, click on the profile picture preview
2. Modal should open with full-size image
3. Click outside modal or press ESC to close

### Expected Results
- ✅ Modal opens with full-size image
- ✅ Image is centered and responsive
- ✅ Modal closes on click outside
- ✅ Modal closes on ESC key

## Test 3: Delete Profile Picture

### Steps
1. Click "Delete Profile Picture" button
2. Confirm deletion in browser prompt
3. Wait for deletion to complete

### Expected Results
- ✅ Confirmation prompt appears
- ✅ Success message: "Profile picture deleted successfully!"
- ✅ Fallback icon appears (burgundy circle with user icon)
- ✅ Sidebar shows fallback icon
- ✅ Mobile header shows fallback icon
- ✅ "Delete Profile Picture" button disappears

### Verify
- Check Cloudinary dashboard - image should be deleted
- Check database: `profile_picture_url` should be NULL
- Refresh page - fallback icon should persist

## Test 4: File Validation

### Test 4.1: File Too Large
1. Try to upload an image > 5MB
2. Expected: Error message "File size exceeds 5MB limit"

### Test 4.2: Invalid File Type
1. Try to upload a PDF or other non-image file
2. Expected: Error message "File type not allowed"

### Test 4.3: Valid File Types
1. Upload JPEG - should work ✅
2. Upload PNG - should work ✅
3. Upload HEIC (iPhone) - should work ✅

## Test 5: Sidebar Display (Desktop)

### Steps
1. Log in and view dashboard
2. Check left sidebar

### Expected Results
- ✅ Profile picture shows next to user name (56x56px)
- ✅ Circular border with hover effect
- ✅ Clicking navigates to `/vendor/settings/profile-picture`
- ✅ If no picture: burgundy icon with user symbol

## Test 6: Mobile Header Display

### Steps
1. Resize browser to mobile width (< 1024px)
2. Check top header bar

### Expected Results
- ✅ Profile picture shows in top-right corner (40x40px)
- ✅ Circular border
- ✅ Clicking navigates to profile picture settings
- ✅ If no picture: burgundy icon

## Test 7: Mobile Sidebar Display

### Steps
1. On mobile, click hamburger menu to open sidebar
2. Check sidebar header

### Expected Results
- ✅ Profile picture shows next to user info (48x48px)
- ✅ Circular border
- ✅ Clicking navigates to profile picture settings
- ✅ If no picture: burgundy icon

## Test 8: Admin Users List

### Steps
1. Log in as admin user
2. Navigate to Users page (`/admin/users`)
3. Check user list table

### Expected Results
- ✅ Profile pictures show in first column (40x40px)
- ✅ Circular thumbnails
- ✅ Users without pictures show gray fallback icon
- ✅ Works in both regular table and virtualized list (>50 users)

## Test 9: Session Persistence

### Steps
1. Upload profile picture
2. Refresh page
3. Open new tab and navigate to dashboard
4. Log out and log back in

### Expected Results
- ✅ Picture persists after refresh
- ✅ Picture shows in new tab
- ✅ Picture shows after re-login
- ✅ No extra database queries (cached in session)

## Test 10: Compression Verification

### Steps
1. Upload a large image (e.g., 2.5MB)
2. Check browser Network tab
3. Check Cloudinary dashboard

### Expected Results
- ✅ Uploaded file is smaller than original (60-80% reduction)
- ✅ Image quality is still good
- ✅ Cloudinary shows compressed size
- ✅ Console logs compression stats

Example console output:
```
Image compressed: 2621440 bytes → 524288 bytes (80% reduction)
```

## Test 11: Error Handling

### Test 11.1: Network Error
1. Disconnect internet
2. Try to upload image
3. Expected: Error message "Failed to upload profile picture"

### Test 11.2: Cloudinary Error
1. Set invalid Cloudinary credentials in `.env`
2. Restart server
3. Try to upload image
4. Expected: Error message with details

### Test 11.3: Database Error
1. Stop database
2. Try to upload image
3. Expected: Error message "Failed to update database"

## Test 12: Multiple Roles

### Steps
1. Create profile picture pages for other roles (see PROFILE_PICTURE_IMPLEMENTATION_COMPLETE.md)
2. Test with adjuster, manager, finance, admin users
3. Verify each role can upload/delete their own picture

### Expected Results
- ✅ All roles can access `/[role]/settings/profile-picture`
- ✅ Upload works for all roles
- ✅ Delete works for all roles
- ✅ Pictures show in sidebar for all roles
- ✅ Pictures show in admin users list

## Test 13: Responsive Design

### Desktop (>1024px)
- ✅ Sidebar shows 56x56px picture
- ✅ Settings page has centered layout
- ✅ Upload area is spacious

### Tablet (768px - 1024px)
- ✅ Sidebar shows 56x56px picture
- ✅ Settings page adapts to width
- ✅ Upload area is readable

### Mobile (<768px)
- ✅ Header shows 40x40px picture (top-right)
- ✅ Sidebar shows 48x48px picture
- ✅ Settings page is single column
- ✅ Upload area is touch-friendly
- ✅ Buttons are large enough for touch

## Test 14: Accessibility

### Keyboard Navigation
1. Tab through profile picture settings page
2. Expected: All interactive elements are focusable
3. Press Enter on "Choose File" button
4. Expected: File picker opens

### Screen Reader
1. Use screen reader (NVDA, JAWS, VoiceOver)
2. Navigate to profile picture settings
3. Expected: All elements are announced correctly
4. Image has alt text: "Profile picture of [User Name]"

## Test 15: Performance

### Page Load Time
1. Open profile picture settings page
2. Check Network tab
3. Expected: Page loads in < 2 seconds

### Upload Time
1. Upload 2MB image
2. Check time to complete
3. Expected: Upload completes in < 5 seconds (with compression)

### Image Load Time
1. Check sidebar image load time
2. Expected: Image loads in < 500ms (Cloudinary CDN)

## Troubleshooting

### Issue: Profile picture not showing in sidebar
- Check: Is `profilePictureUrl` in session? (DevTools → Application → Cookies)
- Fix: Log out and log back in to refresh session

### Issue: Upload fails with "Failed to upload"
- Check: Cloudinary credentials in `.env`
- Check: TinyPNG API key (optional)
- Check: File size and type
- Check: Network connection

### Issue: Image quality is poor
- Check: TinyPNG compression settings
- Adjust: `COMPRESSION_PRESETS.MOBILE` in `cloudinary.ts`
- Try: Disable compression with `compress: false`

### Issue: Migration failed
- Check: Database connection
- Run: `npx tsx scripts/run-profile-picture-migration.ts`
- Verify: Column exists with `\d users` in psql

## Success Criteria

All tests pass:
- ✅ Upload works
- ✅ Delete works
- ✅ Display works (sidebar, mobile, admin list)
- ✅ Validation works
- ✅ Session persistence works
- ✅ Compression works
- ✅ Responsive design works
- ✅ Accessibility works
- ✅ Performance is acceptable

## Notes

- Profile pictures are optional - users can skip this feature
- Fallback icon always shows if no picture uploaded
- Compression saves mobile data (60-80% reduction)
- Cloudinary CDN ensures fast loading globally
- NextAuth session caching prevents extra DB queries

---

**Status**: Ready for testing
**Estimated Time**: 30-45 minutes for complete test suite
