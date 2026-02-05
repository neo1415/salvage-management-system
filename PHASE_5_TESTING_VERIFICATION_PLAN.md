# Phase 5: Testing & Verification Plan ✅

**Date**: February 4, 2026  
**Status**: 🚀 READY TO EXECUTE  
**Estimated Time**: 45 minutes

---

## Executive Summary

Phases 1-4 are complete. Now we verify everything works:
- ✅ GPS accuracy (Google Maps API)
- ✅ AI assessment (Google Cloud Vision)
- ✅ Offline mode (IndexedDB + Service Worker)
- ✅ Dashboard APIs (Admin, Finance)
- ✅ All TODOs wired
- ✅ Offline indicator with auto-sync

**Goal**: Run comprehensive tests to ensure production readiness.

---

## Testing Checklist

### 1. TypeScript & Linting ✅
**Time**: 5 minutes

```bash
# Check for TypeScript errors
npm run type-check

# Check for linting errors
npm run lint
```

**Expected**: No errors

---

### 2. Unit Tests ✅
**Time**: 10 minutes

```bash
# Run all unit tests
npm run test:unit

# Run specific test suites
npm run test:unit -- google-geolocation
npm run test:unit -- offline-sync
npm run test:unit -- ai-assessment
```

**Expected**: All tests passing

---

### 3. Integration Tests ✅
**Time**: 10 minutes

```bash
# Run all integration tests
npm run test:integration

# Run specific integration tests
npm run test:integration -- case-creation
npm run test:integration -- dashboard
```

**Expected**: All tests passing

---

### 4. GPS Accuracy Verification 🎯
**Time**: 5 minutes

**Manual Test**:
1. Open case creation page: `/adjuster/cases/new`
2. Click "Capture GPS Location" button
3. Check browser console for:
   ```
   GPS captured via google-api, accuracy: Xm
   ```
4. Verify location is accurate (within 50 meters)
5. Check location name is correct

**Test Offline Fallback**:
1. Open DevTools → Network tab → Set to "Offline"
2. Click "Capture GPS Location" button
3. Check console for:
   ```
   GPS captured via browser, accuracy: Xm
   ```
4. Verify it still works (less accurate but functional)

**Success Criteria**:
- ✅ Online: Uses Google API, accuracy < 50m
- ✅ Offline: Falls back to browser, still works
- ✅ Error messages are user-friendly

---

### 5. AI Assessment Verification 🤖
**Time**: 5 minutes

**Prerequisites**:
- Valid `GOOGLE_APPLICATION_CREDENTIALS` in `.env`
- Google Cloud Vision API enabled
- Test images of damaged vehicles

**Manual Test**:
1. Create new case with damaged vehicle photos
2. Upload 3-5 photos showing clear damage
3. Submit case
4. Check console for:
   ```
   Running AI damage assessment...
   AI assessment complete: moderate damage, 85% confidence
   ```
5. Verify AI results in database:
   - Damage severity (minor/moderate/severe)
   - Confidence score (0-100%)
   - Estimated salvage value
   - Reserve price

**Success Criteria**:
- ✅ AI runs automatically on case creation
- ✅ Damage severity is reasonable
- ✅ Confidence score > 70%
- ✅ Salvage value calculated
- ✅ No errors in console

---

### 6. Offline Mode Verification 📱
**Time**: 10 minutes

**Test Flow**:

**Step 1: Go Offline**
1. Open DevTools → Network → Set to "Offline"
2. Verify yellow banner appears: "You're offline"
3. Navigate to case creation page

**Step 2: Create Case Offline**
1. Fill out case form
2. Capture photos (use device camera or upload)
3. Capture GPS location (should work offline)
4. Submit case
5. Verify alert: "Case saved offline. It will be synced when connection returns."
6. Check offline indicator shows: "1 case will sync automatically"

**Step 3: Go Online**
1. DevTools → Network → Set to "Online"
2. Wait 5 seconds for auto-sync
3. Verify sync progress indicator appears (bottom-right)
4. Check console for sync progress:
   ```
   Syncing offline cases...
   Synced 1 of 1 cases
   ```
5. Verify case appears in database
6. Verify AI assessment ran
7. Verify photos uploaded to Cloudinary

**Success Criteria**:
- ✅ Offline indicator shows when offline
- ✅ Cases save to IndexedDB offline
- ✅ Pending count updates correctly
- ✅ Auto-sync triggers when online
- ✅ Sync progress shows in UI
- ✅ Cases sync successfully
- ✅ AI assessment runs after sync
- ✅ Photos upload to Cloudinary

---

### 7. Dashboard APIs Verification 📊
**Time**: 5 minutes

**Admin Dashboard**:
1. Login as admin
2. Navigate to `/admin/dashboard`
3. Verify real data shows:
   - Total users count
   - Active vendors count
   - Fraud alerts count
   - Audit logs count
   - User growth %
   - System health status
4. Check Network tab: `GET /api/dashboard/admin` returns 200
5. Verify response is cached (subsequent requests < 50ms)

**Finance Dashboard**:
1. Login as finance officer
2. Navigate to `/finance/dashboard`
3. Verify real data shows:
   - Total payments
   - Pending verification
   - Verified payments
   - Rejected payments
   - Total amount
4. Check Network tab: `GET /api/dashboard/finance` returns 200
5. Verify response is cached

**Success Criteria**:
- ✅ Admin dashboard shows real data
- ✅ Finance dashboard shows real data
- ✅ APIs return 200 status
- ✅ Caching works (5-minute TTL)
- ✅ No TypeScript errors
- ✅ No console errors

---

### 8. TODO Verification ✅
**Time**: 2 minutes

**Verify TODOs are addressed**:

1. **NIN Verification Mock**:
   - File: `src/lib/integrations/nin-verification.ts`
   - Status: Intentional mock (no action needed)
   - ✅ Documented in code

2. **Tier 2 KYC Notification**:
   - File: `src/app/api/vendors/tier2-kyc/route.ts`
   - Status: Wired (sends SMS + Email to managers)
   - ✅ Test: Submit Tier 2 KYC, verify managers receive notification

3. **Payment Deadline Cron**:
   - File: `src/app/api/cron/payment-deadlines/route.ts`
   - Status: Re-enabled
   - ✅ Test: Call cron endpoint, verify it runs

**Success Criteria**:
- ✅ All TODOs addressed or documented
- ✅ Tier 2 KYC notifications working
- ✅ Payment deadline cron enabled

---

### 9. Build Verification 🏗️
**Time**: 3 minutes

```bash
# Build for production
npm run build

# Check for build errors
# Expected: Build completes successfully
```

**Success Criteria**:
- ✅ Build completes without errors
- ✅ No TypeScript errors
- ✅ No linting errors
- ✅ Bundle size reasonable

---

## Quick Test Commands

```bash
# Full test suite
npm run test

# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# All checks (recommended)
npm run type-check && npm run lint && npm run test && npm run build
```

---

## Success Criteria Summary

### Code Quality ✅
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Build completes successfully

### GPS Accuracy ✅
- [ ] Online: Uses Google API, < 50m accuracy
- [ ] Offline: Falls back to browser
- [ ] Error messages user-friendly

### AI Assessment ✅
- [ ] Runs automatically on case creation
- [ ] Damage severity reasonable
- [ ] Confidence score > 70%
- [ ] Salvage value calculated

### Offline Mode ✅
- [ ] Offline indicator shows when offline
- [ ] Cases save to IndexedDB
- [ ] Auto-sync triggers when online
- [ ] Sync progress shows in UI
- [ ] Cases sync successfully

### Dashboard APIs ✅
- [ ] Admin dashboard shows real data
- [ ] Finance dashboard shows real data
- [ ] APIs return 200 status
- [ ] Caching works (5-minute TTL)

### TODOs ✅
- [ ] All TODOs addressed or documented
- [ ] Tier 2 KYC notifications working
- [ ] Payment deadline cron enabled

---

## Known Limitations

### AI Assessment
- Generic damage detection (not insurance-specific)
- May miss subtle damage
- Confidence varies with photo quality
- **Acceptable for MVP** - upgrade to custom model at scale

### Offline Mode
- AI assessment requires internet
- Photo upload requires internet
- Payments require internet
- **This is industry standard** - same as Google Docs, WhatsApp

### GPS Accuracy
- Google API requires internet
- Falls back to browser offline (less accurate)
- **Acceptable trade-off** - 10-100x improvement when online

---

## Next Steps After Testing

### If All Tests Pass ✅
1. Deploy to production (Vercel)
2. Test in production environment
3. Monitor error logs
4. Collect user feedback
5. Move to Epic 13 (Testing) tasks

### If Tests Fail ❌
1. Document failing tests
2. Investigate root cause
3. Fix issues
4. Re-run tests
5. Repeat until all pass

---

## Production Deployment Checklist

Before deploying to production:

### Environment Variables
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` configured
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` configured
- [ ] Google Maps API key restricted to domain
- [ ] All API keys in Vercel environment variables

### Security
- [ ] API keys restricted to domain
- [ ] Rate limiting enabled
- [ ] Authentication working
- [ ] CORS configured correctly

### Monitoring
- [ ] Error tracking setup (Sentry)
- [ ] Performance monitoring
- [ ] API usage monitoring (Google Cloud Console)
- [ ] Database monitoring

### Documentation
- [ ] README updated
- [ ] API documentation complete
- [ ] Deployment guide updated
- [ ] User guide created

---

## Time Tracking

| Task | Estimated | Status |
|------|-----------|--------|
| TypeScript & Linting | 5 min | ⏳ Pending |
| Unit Tests | 10 min | ⏳ Pending |
| Integration Tests | 10 min | ⏳ Pending |
| GPS Verification | 5 min | ⏳ Pending |
| AI Verification | 5 min | ⏳ Pending |
| Offline Verification | 10 min | ⏳ Pending |
| Dashboard Verification | 5 min | ⏳ Pending |
| TODO Verification | 2 min | ⏳ Pending |
| Build Verification | 3 min | ⏳ Pending |
| **Total** | **45 min** | **⏳ Pending** |

---

## Ready to Execute?

Say the word and I'll start running tests systematically!

**Recommended approach**:
1. Run automated tests first (TypeScript, lint, unit, integration)
2. Then manual verification (GPS, AI, offline, dashboards)
3. Finally build verification

This ensures we catch any issues early before manual testing.
