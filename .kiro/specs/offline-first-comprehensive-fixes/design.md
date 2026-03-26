# Offline-First Implementation - Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Application                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   UI Layer   │  │  Hooks Layer │  │ Service Layer│      │
│  │              │  │              │  │              │      │
│  │ - Components │◄─┤ - useOffline │◄─┤ - Sync Svc  │      │
│  │ - Modals     │  │ - useCache   │  │ - Cache Svc  │      │
│  │ - Indicators │  │ - useSync    │  │ - Session Svc│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                        │
│                   │  IndexedDB Layer│                        │
│                   │                 │                        │
│                   │ - offlineCases  │                        │
│                   │ - cachedAuctions│                        │
│                   │ - cachedDocs    │                        │
│                   │ - cachedWallet  │                        │
│                   │ - offlineSession│                        │
│                   │ - drafts        │                        │
│                   │ - syncQueue     │                        │
│                   └─────────────────┘                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   Backend API   │
                   │                 │
                   │ - /api/sync     │
                   │ - /api/auctions │
                   │ - /api/documents│
                   │ - /api/wallet   │
                   └─────────────────┘
```

## Component Design

### 1. Enhanced Offline Indicator

**File**: `src/components/pwa/offline-indicator.tsx`

```typescript
interface OfflineIndicatorProps {
  dismissible?: boolean;
  showCompactOnDismiss?: boolean;
}

// Features:
// - Dismissible with close button
// - Compact badge mode after dismissal
// - Proper z-index (z-40, below modals)
// - Slide animation
// - Session storage for dismissal state
```

**Z-Index Strategy**:
- Modals: z-50
- Offline Indicator: z-40
- Hamburger Menu: z-45
- Dropdowns: z-30
- Regular content: z-0

### 2. Draft Auto-Save System

**File**: `src/features/cases/services/draft.service.ts`

```typescript
interface DraftCase {
  id: string;
  formData: Partial<CaseFormData>;
  status: 'draft';
  createdAt: Date;
  updatedAt: Date;
  autoSavedAt: Date;
  hasAIAnalysis: boolean;
  marketValue?: number;
}

class DraftService {
  // Auto-save every 30 seconds
  startAutoSave(formData: Partial<CaseFormData>): void;
  
  // Stop auto-save
  stopAutoSave(): void;
  
  // Save draft manually
  saveDraft(formData: Partial<CaseFormData>): Promise<DraftCase>;
  
  // Load draft
  loadDraft(id: string): Promise<DraftCase | null>;
  
  // List all drafts
  listDrafts(): Promise<DraftCase[]>;
  
  // Delete draft
  deleteDraft(id: string): Promise<void>;
  
  // Validate draft for submission
  canSubmit(draft: DraftCase): { valid: boolean; errors: string[] };
}
```

**Hook**: `src/hooks/use-draft-auto-save.ts`

```typescript
interface UseDraftAutoSaveOptions {
  interval?: number; // Default: 30000ms
  enabled?: boolean;
}

function useDraftAutoSave(
  formData: Partial<CaseFormData>,
  options?: UseDraftAutoSaveOptions
): {
  isSaving: boolean;
  lastSaved: Date | null;
  saveDraft: () => Promise<void>;
  loadDraft: (id: string) => Promise<void>;
  drafts: DraftCase[];
  deleteDraft: (id: string) => Promise<void>;
}
```

### 3. Offline Data Caching

**File**: `src/features/cache/services/cache.service.ts`

```typescript
interface CacheConfig {
  maxAge: number; // milliseconds
  maxSize: number; // bytes
  autoCleanup: boolean;
}

interface CachedItem<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  size: number;
}

class CacheService {
  // Auction caching
  cacheAuction(auction: Auction): Promise<void>;
  getCachedAuction(id: string): Promise<CachedItem<Auction> | null>;
  getCachedAuctions(): Promise<CachedItem<Auction>[]>;
  
  // Document caching
  cacheDocument(document: Document): Promise<void>;
  getCachedDocument(id: string): Promise<CachedItem<Document> | null>;
  getCachedDocuments(auctionId: string): Promise<CachedItem<Document>[]>;
  
  // Wallet caching
  cacheWallet(wallet: WalletData): Promise<void>;
  getCachedWallet(userId: string): Promise<CachedItem<WalletData> | null>;
  
  // Cache management
  clearExpired(): Promise<number>;
  clearAll(): Promise<void>;
  getStorageUsage(): Promise<number>;
}
```

**Hooks**:
- `src/hooks/use-cached-auctions.ts`
- `src/hooks/use-cached-documents.ts`
- `src/hooks/use-cached-wallet.ts`

```typescript
function useCachedAuctions(): {
  auctions: Auction[];
  isLoading: boolean;
  isOffline: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}
```

### 4. Offline Session Management

**File**: `src/features/auth/services/offline-session.service.ts`

```typescript
interface OfflineSession {
  userId: string;
  encryptedToken: string;
  iv: string; // Initialization vector for AES-GCM
  expiresAt: Date;
  createdAt: Date;
  lastValidated: Date;
}

class OfflineSessionService {
  // Encrypt and cache session
  cacheSession(session: Session): Promise<void>;
  
  // Decrypt and retrieve session
  getSession(): Promise<Session | null>;
  
  // Validate cached session
  validateSession(): Promise<boolean>;
  
  // Clear session
  clearSession(): Promise<void>;
  
  // Check if session expired
  isExpired(): Promise<boolean>;
  
  // Encryption helpers
  private encrypt(data: string, key: CryptoKey): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }>;
  private decrypt(encrypted: ArrayBuffer, iv: Uint8Array, key: CryptoKey): Promise<string>;
  private deriveKey(password: string): Promise<CryptoKey>;
}
```

**Security Implementation**:
```typescript
// Use Web Crypto API
const algorithm = {
  name: 'AES-GCM',
  length: 256,
};

// Derive key from device-specific data
const keyMaterial = await crypto.subtle.importKey(
  'raw',
  encoder.encode(deviceId + userId),
  { name: 'PBKDF2' },
  false,
  ['deriveKey']
);

const key = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: encoder.encode('salvage-management-salt'),
    iterations: 100000,
    hash: 'SHA-256',
  },
  keyMaterial,
  algorithm,
  false,
  ['encrypt', 'decrypt']
);
```

### 5. Sync Status UI

**File**: `src/components/ui/sync-status-header.tsx`

```typescript
interface SyncStatusHeaderProps {
  showDetails?: boolean;
  compact?: boolean;
}

// Features:
// - Last sync timestamp
// - Pending count badge
// - Manual sync button
// - Sync progress indicator
// - Error display with retry
```

**File**: `src/components/ui/sync-progress-toast.tsx`

```typescript
interface SyncProgressToastProps {
  progress: SyncProgress;
  onRetry?: () => void;
  onDismiss?: () => void;
}

// Features:
// - Progress bar
// - Current item display
// - Success/error notifications
// - Retry button for failures
```

### 6. Conflict Resolution UI

**File**: `src/components/modals/conflict-resolution-modal.tsx`

```typescript
interface ConflictResolutionModalProps {
  conflict: SyncConflict;
  onResolve: (resolution: ConflictResolution) => Promise<void>;
  onCancel: () => void;
}

// Features:
// - Side-by-side comparison
// - Diff highlighting
// - Resolution options (keep local/remote/merge)
// - Timestamp display
// - Explanation of conflict
```

**Layout**:
```
┌─────────────────────────────────────────────────┐
│  Conflict Detected                         [X]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  This case was modified on another device or    │
│  by another user. Choose which version to keep. │
│                                                  │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │  Your Changes    │  │  Server Version  │    │
│  │  (Local)         │  │  (Remote)        │    │
│  ├──────────────────┤  ├──────────────────┤    │
│  │ Claim: ABC123   │  │ Claim: ABC123   │    │
│  │ Value: $5,000   │  │ Value: $5,500   │◄─ Diff
│  │ Photos: 5       │  │ Photos: 5       │    │
│  │ Modified: 2m ago│  │ Modified: 1m ago│    │
│  └──────────────────┘  └──────────────────┘    │
│                                                  │
│  [Keep My Changes]  [Keep Server]  [Cancel]    │
└─────────────────────────────────────────────────┘
```

### 7. Button State Management

**File**: `src/components/ui/offline-aware-button.tsx`

```typescript
interface OfflineAwareButtonProps extends ButtonProps {
  requiresOnline?: boolean;
  offlineTooltip?: string;
  onlineOnly?: boolean;
}

// Features:
// - Auto-disable when offline
// - Tooltip explanation
// - Visual indicator (grayed out)
// - Optional queue for later
```

### 8. AI Analysis Enforcement

**File**: `src/features/cases/services/ai-analysis-validator.ts`

```typescript
interface AIAnalysisValidation {
  isValid: boolean;
  hasAnalysis: boolean;
  hasMarketValue: boolean;
  errors: string[];
  warnings: string[];
}

class AIAnalysisValidator {
  // Validate case has AI analysis
  validate(caseData: Partial<CaseFormData>): AIAnalysisValidation;
  
  // Check if submission allowed
  canSubmit(caseData: Partial<CaseFormData>): boolean;
  
  // Get validation errors
  getErrors(caseData: Partial<CaseFormData>): string[];
}
```

**UI Integration**:
```typescript
// In case creation form
const { canSubmit, errors } = useAIAnalysisValidation(formData);

<button
  disabled={!canSubmit || isOffline}
  onClick={handleSubmit}
>
  Submit Case
</button>

{errors.length > 0 && (
  <div className="error-message">
    {errors.map(error => <p key={error}>{error}</p>)}
  </div>
)}
```

## Data Flow

### Offline Data Caching Flow

```
User Views Auction
       │
       ▼
  Is Online?
   ┌───┴───┐
   │       │
  Yes     No
   │       │
   │       ▼
   │   Load from Cache
   │       │
   │       ▼
   │   Show "Last updated: X"
   │
   ▼
Fetch from API
   │
   ▼
Cache Response
   │
   ▼
Display to User
```

### Draft Auto-Save Flow

```
User Types in Form
       │
       ▼
  Debounce 30s
       │
       ▼
  Save to IndexedDB
       │
       ▼
  Update "Last saved" UI
       │
       ▼
  Continue Editing
       │
       ▼
  User Submits
       │
       ▼
  Validate AI Analysis
   ┌───┴───┐
   │       │
  Yes     No
   │       │
   │       ▼
   │   Show Error
   │   Block Submission
   │
   ▼
Submit to API
   │
   ▼
Delete Draft
```

### Sync Flow

```
Connection Restored
       │
       ▼
  Get Pending Items
       │
       ▼
  Show Sync Progress
       │
       ▼
  For Each Item:
   ├─ Sync to API
   ├─ Check for Conflicts
   │  ┌───┴───┐
   │  │       │
   │ Yes     No
   │  │       │
   │  │       ▼
   │  │   Mark Synced
   │  │   Remove from Queue
   │  │
   │  ▼
   │ Show Conflict Modal
   │  │
   │  ▼
   │ User Resolves
   │  │
   │  ▼
   │ Apply Resolution
   │
   ▼
Show Sync Complete
```

### Offline Session Flow

```
User Logs In
       │
       ▼
  Encrypt Session Token
       │
       ▼
  Store in IndexedDB
       │
       ▼
  User Goes Offline
       │
       ▼
  Retrieve Cached Session
       │
       ▼
  Decrypt Token
       │
       ▼
  Validate Expiry
   ┌───┴───┐
   │       │
 Valid  Expired
   │       │
   │       ▼
   │   Force Login
   │   Clear Cache
   │
   ▼
Allow Offline Access
       │
       ▼
  Connection Restored
       │
       ▼
  Validate with Server
   ┌───┴───┐
   │       │
 Valid  Invalid
   │       │
   │       ▼
   │   Force Re-login
   │   Clear Cache
   │
   ▼
Continue Session
```

## IndexedDB Schema

```typescript
interface SalvageDBSchema extends DBSchema {
  // Existing stores
  offlineCases: {
    key: string;
    value: OfflineCase;
    indexes: {
      'by-sync-status': string;
      'by-created-at': Date;
      'by-claim-reference': string;
    };
  };
  
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: {
      'by-case-id': string;
      'by-created-at': Date;
    };
  };
  
  // New stores
  cachedAuctions: {
    key: string; // auction ID
    value: {
      data: Auction;
      cachedAt: Date;
      expiresAt: Date;
      size: number;
    };
    indexes: {
      'by-cached-at': Date;
      'by-expires-at': Date;
      'by-status': string;
    };
  };
  
  cachedDocuments: {
    key: string; // document ID
    value: {
      data: Document;
      auctionId: string;
      cachedAt: Date;
      expiresAt: Date;
      pdfUrl?: string;
      size: number;
    };
    indexes: {
      'by-auction-id': string;
      'by-cached-at': Date;
      'by-expires-at': Date;
    };
  };
  
  cachedWallet: {
    key: string; // user ID
    value: {
      balance: number;
      transactions: Transaction[];
      cachedAt: Date;
      expiresAt: Date;
      size: number;
    };
    indexes: {
      'by-user-id': string;
      'by-cached-at': Date;
      'by-expires-at': Date;
    };
  };
  
  offlineSession: {
    key: string; // user ID
    value: {
      userId: string;
      encryptedToken: string;
      iv: string;
      expiresAt: Date;
      createdAt: Date;
      lastValidated: Date;
    };
    indexes: {
      'by-user-id': string;
      'by-expires-at': Date;
    };
  };
  
  drafts: {
    key: string; // draft ID
    value: {
      id: string;
      formData: Partial<CaseFormData>;
      status: 'draft';
      createdAt: Date;
      updatedAt: Date;
      autoSavedAt: Date;
      hasAIAnalysis: boolean;
      marketValue?: number;
    };
    indexes: {
      'by-created-at': Date;
      'by-updated-at': Date;
      'by-auto-saved-at': Date;
    };
  };
}
```

## API Endpoints

### Sync Endpoint
```typescript
POST /api/sync
Request: {
  cases: OfflineCase[];
  conflicts?: ConflictResolution[];
}
Response: {
  synced: number;
  failed: number;
  conflicts: SyncConflict[];
  errors: Array<{ caseId: string; error: string }>;
}
```

### Session Validation
```typescript
POST /api/auth/validate-session
Request: {
  token: string;
}
Response: {
  valid: boolean;
  expiresAt: Date;
  user: User;
}
```

## Performance Optimizations

### 1. Lazy Loading
- Load cached data only when needed
- Use React.lazy for heavy components
- Defer non-critical operations

### 2. Indexing
- Index all frequently queried fields
- Use compound indexes for complex queries
- Regular index maintenance

### 3. Batch Operations
- Batch sync operations (max 10 at a time)
- Batch cache writes
- Debounce auto-save

### 4. Memory Management
- Clear unused cache entries
- Limit cache size per store
- Monitor memory usage

### 5. Network Optimization
- Compress sync payloads
- Use delta sync for updates
- Implement request queuing

## Security Measures

### 1. Encryption
- AES-GCM 256-bit encryption
- Unique IV per encryption
- PBKDF2 key derivation (100k iterations)

### 2. Key Management
- Keys stored in memory only
- Derive keys from device-specific data
- Clear keys on logout

### 3. Session Security
- 7-day offline session limit
- Force re-authentication online
- Validate session on reconnect

### 4. Data Protection
- No sensitive data in localStorage
- Encrypt all cached session data
- Clear cache on explicit logout

## Testing Strategy

### Unit Tests
- Cache service operations
- Encryption/decryption
- Draft auto-save logic
- Sync conflict detection

### Integration Tests
- Online/offline transitions
- Sync flow end-to-end
- Conflict resolution
- Session management

### E2E Tests
- Complete offline workflow
- Draft creation and resumption
- Sync after reconnection
- UI interactions

### Performance Tests
- Cache operation speed
- Sync performance with 100 items
- Memory usage monitoring
- Storage quota handling

## Monitoring & Analytics

### Metrics to Track
- Offline usage duration
- Sync success/failure rates
- Conflict frequency
- Cache hit/miss rates
- Storage usage per user
- Session validation failures

### Error Tracking
- Sync errors with details
- Encryption failures
- Storage quota exceeded
- Session expiry events

## Migration Plan

### Phase 1: Schema Migration
1. Add new IndexedDB stores
2. Migrate existing data
3. Test data integrity

### Phase 2: Feature Rollout
1. Deploy offline indicator fixes
2. Enable draft auto-save
3. Roll out data caching
4. Enable session management

### Phase 3: Monitoring
1. Monitor error rates
2. Track performance metrics
3. Gather user feedback
4. Iterate on improvements
