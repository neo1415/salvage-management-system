# Offline-First Implementation - Quick Start Guide

## For Developers: How to Implement Each Fix

### 1. Offline UI Blocking Fix ✅ COMPLETED

**What was fixed**:
- Offline banner no longer blocks mobile hamburger menu
- Banner is dismissible with close button
- Compact badge mode after dismissal
- Proper z-index layering

**How to use**:
```typescript
// The OfflineIndicator component is already integrated in the layout
// No changes needed - it works automatically
import { OfflineIndicator } from '@/components/pwa/offline-indicator';

// In your layout:
<OfflineIndicator />
```

**Z-Index Strategy**:
- Modals: `z-50`
- Mobile Menu: `z-50`
- Offline Indicator: `z-40`
- Dropdowns: `z-30`
- Regular content: `z-0`

---

### 2. Draft Auto-Save System ⏳ PENDING

**What to implement**:
- Auto-save form data every 30 seconds
- Save to IndexedDB with status='draft'
- Allow resuming drafts from list
- Show "Saving..." and "Last saved" indicators

**Step 1: Create Draft Service**

```typescript
// src/features/cases/services/draft.service.ts
import { getDB } from '@/lib/db/indexeddb';

export interface DraftCase {
  id: string;
  formData: Partial<CaseFormData>;
  status: 'draft';
  createdAt: Date;
  updatedAt: Date;
  autoSavedAt: Date;
  hasAIAnalysis: boolean;
  marketValue?: number;
}

export class DraftService {
  private autoSaveTimer: NodeJS.Timeout | null = null;
  
  startAutoSave(formData: Partial<CaseFormData>, callback: () => void): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setTimeout(async () => {
      await this.saveDraft(formData);
      callback();
    }, 30000); // 30 seconds
  }
  
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  async saveDraft(formData: Partial<CaseFormData>): Promise<DraftCase> {
    const db = await getDB();
    const draft: DraftCase = {
      id: formData.id || `draft-${Date.now()}`,
      formData,
      status: 'draft',
      createdAt: formData.createdAt || new Date(),
      updatedAt: new Date(),
      autoSavedAt: new Date(),
      hasAIAnalysis: !!formData.marketValue,
      marketValue: formData.marketValue,
    };
    
    await db.put('drafts', draft);
    return draft;
  }
  
  async loadDraft(id: string): Promise<DraftCase | null> {
    const db = await getDB();
    return await db.get('drafts', id);
  }
  
  async listDrafts(): Promise<DraftCase[]> {
    const db = await getDB();
    return await db.getAll('drafts');
  }
  
  async deleteDraft(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('drafts', id);
  }
}
```

**Step 2: Create Hook**

```typescript
// src/hooks/use-draft-auto-save.ts
import { useState, useEffect, useMemo } from 'react';
import { DraftService } from '@/features/cases/services/draft.service';

export function useDraftAutoSave(
  formData: Partial<CaseFormData>,
  options?: { interval?: number; enabled?: boolean }
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const draftService = useMemo(() => new DraftService(), []);
  
  useEffect(() => {
    if (!options?.enabled) return;
    
    draftService.startAutoSave(formData, () => {
      setLastSaved(new Date());
    });
    
    return () => draftService.stopAutoSave();
  }, [formData, options?.enabled, draftService]);
  
  const saveDraft = async () => {
    setIsSaving(true);
    try {
      await draftService.saveDraft(formData);
      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  };
  
  return { isSaving, lastSaved, saveDraft };
}
```

**Step 3: Use in Form**

```typescript
// In your case creation form
import { useDraftAutoSave } from '@/hooks/use-draft-auto-save';
import { formatDistanceToNow } from 'date-fns';

function CaseCreationForm() {
  const [formData, setFormData] = useState<Partial<CaseFormData>>({});
  const { isSaving, lastSaved, saveDraft } = useDraftAutoSave(formData, {
    enabled: true,
    interval: 30000,
  });
  
  return (
    <div>
      {/* Form fields */}
      
      {/* Auto-save indicator */}
      <div className="text-sm text-gray-500">
        {isSaving && (
          <span className="flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} />
            Saving draft...
          </span>
        )}
        {!isSaving && lastSaved && (
          <span>
            Draft saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
          </span>
        )}
      </div>
      
      {/* Manual save button */}
      <button onClick={saveDraft}>Save Draft</button>
    </div>
  );
}
```

---

### 3. AI Analysis Requirement Enforcement ⏳ PENDING

**What to implement**:
- Block submission without AI analysis
- Show clear error message
- Disable submit button
- Allow saving as draft without AI

**Step 1: Create Validator**

```typescript
// src/features/cases/services/ai-analysis-validator.ts
export interface AIAnalysisValidation {
  isValid: boolean;
  hasAnalysis: boolean;
  hasMarketValue: boolean;
  errors: string[];
  warnings: string[];
}

export class AIAnalysisValidator {
  validate(caseData: Partial<CaseFormData>): AIAnalysisValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const hasAnalysis = !!caseData.aiAssessment;
    const hasMarketValue = !!caseData.marketValue && caseData.marketValue > 0;
    
    if (!hasAnalysis) {
      errors.push('AI analysis is required before submission');
      warnings.push('Please run AI assessment on your photos');
    }
    
    if (!hasMarketValue) {
      errors.push('Market value must be determined by AI analysis');
    }
    
    return {
      isValid: errors.length === 0,
      hasAnalysis,
      hasMarketValue,
      errors,
      warnings,
    };
  }
  
  canSubmit(caseData: Partial<CaseFormData>): boolean {
    return this.validate(caseData).isValid;
  }
  
  getErrors(caseData: Partial<CaseFormData>): string[] {
    return this.validate(caseData).errors;
  }
}
```

**Step 2: Use in Form**

```typescript
import { AIAnalysisValidator } from '@/features/cases/services/ai-analysis-validator';

function CaseCreationForm() {
  const validator = useMemo(() => new AIAnalysisValidator(), []);
  const validation = validator.validate(formData);
  
  return (
    <div>
      {/* Form fields */}
      
      {/* Validation errors */}
      {validation.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-semibold text-red-900 mb-2">
            Cannot Submit Case
          </h4>
          <ul className="list-disc list-inside space-y-1">
            {validation.errors.map(error => (
              <li key={error} className="text-sm text-red-700">{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Submit button */}
      <button
        disabled={!validation.isValid || isOffline}
        onClick={handleSubmit}
        className={cn(
          'btn-primary',
          !validation.isValid && 'opacity-50 cursor-not-allowed'
        )}
      >
        Submit Case
      </button>
      
      {/* Save as draft (always allowed) */}
      <button onClick={saveDraft}>
        Save as Draft
      </button>
    </div>
  );
}
```

---

### 4. Offline-Aware Buttons ⏳ PENDING

**What to implement**:
- Disable buttons when offline
- Show tooltip explaining why
- Visual indicator (grayed out)

**Step 1: Create Component**

```typescript
// src/components/ui/offline-aware-button.tsx
import { useOffline } from '@/hooks/use-offline';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface OfflineAwareButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  requiresOnline?: boolean;
  offlineTooltip?: string;
}

export function OfflineAwareButton({
  requiresOnline = false,
  offlineTooltip = 'This action requires internet connection',
  children,
  disabled,
  className,
  ...props
}: OfflineAwareButtonProps) {
  const isOffline = useOffline();
  const isDisabled = disabled || (requiresOnline && isOffline);
  
  const button = (
    <button
      {...props}
      disabled={isDisabled}
      className={cn(
        className,
        isDisabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {children}
    </button>
  );
  
  if (isOffline && requiresOnline) {
    return (
      <Tooltip content={offlineTooltip}>
        {button}
      </Tooltip>
    );
  }
  
  return button;
}
```

**Step 2: Use in Pages**

```typescript
// In manager approvals page
import { OfflineAwareButton } from '@/components/ui/offline-aware-button';

<OfflineAwareButton
  requiresOnline
  offlineTooltip="Cannot approve cases while offline"
  onClick={handleApprove}
  className="btn-primary"
>
  Approve
</OfflineAwareButton>

<OfflineAwareButton
  requiresOnline
  offlineTooltip="Cannot reject cases while offline"
  onClick={handleReject}
  className="btn-danger"
>
  Reject
</OfflineAwareButton>
```

---

### 5. Offline Data Caching ⏳ PENDING

**What to implement**:
- Cache auctions, documents, wallet data
- Show "Last updated" timestamps
- Load from cache when offline

**Step 1: Create Cache Service**

```typescript
// src/features/cache/services/cache.service.ts
import { getDB } from '@/lib/db/indexeddb';

export interface CachedItem<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  size: number;
}

export class CacheService {
  async cacheAuction(auction: Auction): Promise<void> {
    const db = await getDB();
    const cached: CachedItem<Auction> = {
      data: auction,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      size: JSON.stringify(auction).length,
    };
    await db.put('cachedAuctions', cached);
  }
  
  async getCachedAuction(id: string): Promise<CachedItem<Auction> | null> {
    const db = await getDB();
    const cached = await db.get('cachedAuctions', id);
    
    if (!cached) return null;
    
    // Check if expired
    if (new Date() > cached.expiresAt) {
      await db.delete('cachedAuctions', id);
      return null;
    }
    
    return cached;
  }
  
  async getCachedAuctions(): Promise<CachedItem<Auction>[]> {
    const db = await getDB();
    const allCached = await db.getAll('cachedAuctions');
    
    // Filter out expired
    const now = new Date();
    return allCached.filter(cached => cached.expiresAt > now);
  }
}
```

**Step 2: Create Hook**

```typescript
// src/hooks/use-cached-auctions.ts
import { useState, useEffect } from 'react';
import { useOffline } from './use-offline';
import { CacheService } from '@/features/cache/services/cache.service';

export function useCachedAuctions() {
  const isOffline = useOffline();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const cacheService = useMemo(() => new CacheService(), []);
  
  const fetchAuctions = async () => {
    setIsLoading(true);
    try {
      if (isOffline) {
        // Load from cache
        const cached = await cacheService.getCachedAuctions();
        setAuctions(cached.map(c => c.data));
        if (cached.length > 0) {
          setLastUpdated(cached[0].cachedAt);
        }
      } else {
        // Fetch from API
        const response = await fetch('/api/auctions');
        const data = await response.json();
        
        // Cache the results
        for (const auction of data.auctions) {
          await cacheService.cacheAuction(auction);
        }
        
        setAuctions(data.auctions);
        setLastUpdated(new Date());
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchAuctions();
  }, [isOffline]);
  
  return {
    auctions,
    isLoading,
    isOffline,
    lastUpdated,
    refresh: fetchAuctions,
  };
}
```

**Step 3: Use in Pages**

```typescript
import { useCachedAuctions } from '@/hooks/use-cached-auctions';
import { formatDistanceToNow } from 'date-fns';

function AuctionsPage() {
  const { auctions, isLoading, isOffline, lastUpdated, refresh } = useCachedAuctions();
  
  return (
    <div>
      {/* Offline indicator */}
      {isOffline && lastUpdated && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            Showing cached data. Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
          </p>
        </div>
      )}
      
      {/* Refresh button */}
      {!isOffline && (
        <button onClick={refresh}>Refresh</button>
      )}
      
      {/* Auction list */}
      {auctions.map(auction => (
        <AuctionCard key={auction.id} auction={auction} />
      ))}
    </div>
  );
}
```

---

### 6. Offline Session Management ⏳ PENDING

**What to implement**:
- Cache session tokens securely
- Encrypt with Web Crypto API
- Allow offline login
- Force re-auth after 7 days

**Step 1: Create Crypto Helpers**

```typescript
// src/utils/crypto-helpers.ts
export async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('salvage-management-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  return { encrypted, iv };
}

export async function decrypt(
  encrypted: ArrayBuffer,
  iv: Uint8Array,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return decoder.decode(decrypted);
}
```

**Step 2: Create Offline Session Service**

```typescript
// src/features/auth/services/offline-session.service.ts
import { getDB } from '@/lib/db/indexeddb';
import { deriveKey, encrypt, decrypt } from '@/utils/crypto-helpers';

export interface OfflineSession {
  userId: string;
  encryptedToken: string;
  iv: string;
  expiresAt: Date;
  createdAt: Date;
  lastValidated: Date;
}

export class OfflineSessionService {
  private key: CryptoKey | null = null;
  
  async cacheSession(session: Session): Promise<void> {
    const db = await getDB();
    
    // Derive encryption key
    this.key = await deriveKey(session.user.id + navigator.userAgent);
    
    // Encrypt token
    const { encrypted, iv } = await encrypt(session.accessToken, this.key);
    
    const offlineSession: OfflineSession = {
      userId: session.user.id,
      encryptedToken: Buffer.from(encrypted).toString('base64'),
      iv: Buffer.from(iv).toString('base64'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdAt: new Date(),
      lastValidated: new Date(),
    };
    
    await db.put('offlineSession', offlineSession);
  }
  
  async getSession(): Promise<Session | null> {
    const db = await getDB();
    const offlineSession = await db.get('offlineSession', 'current');
    
    if (!offlineSession) return null;
    
    // Check if expired
    if (new Date() > offlineSession.expiresAt) {
      await this.clearSession();
      return null;
    }
    
    // Derive key
    this.key = await deriveKey(offlineSession.userId + navigator.userAgent);
    
    // Decrypt token
    const encrypted = Buffer.from(offlineSession.encryptedToken, 'base64');
    const iv = Buffer.from(offlineSession.iv, 'base64');
    const token = await decrypt(encrypted, iv, this.key);
    
    return {
      accessToken: token,
      user: { id: offlineSession.userId },
    };
  }
  
  async clearSession(): Promise<void> {
    const db = await getDB();
    await db.delete('offlineSession', 'current');
    this.key = null;
  }
}
```

---

## Testing Checklist

### Manual Testing
- [ ] Offline banner dismisses correctly
- [ ] Compact badge appears after dismissal
- [ ] Mobile menu never blocked
- [ ] Draft auto-saves every 30 seconds
- [ ] Drafts can be resumed
- [ ] AI analysis required for submission
- [ ] Buttons disabled when offline
- [ ] Cached data loads offline
- [ ] Sync works after reconnection
- [ ] Offline login works

### Automated Testing
```typescript
// Example test
describe('Draft Auto-Save', () => {
  it('should auto-save after 30 seconds', async () => {
    const { result } = renderHook(() => useDraftAutoSave(formData, { enabled: true }));
    
    await waitFor(() => {
      expect(result.current.lastSaved).not.toBeNull();
    }, { timeout: 31000 });
  });
});
```

## Common Issues & Solutions

### Issue: IndexedDB quota exceeded
**Solution**: Implement auto-cleanup of old cached data

### Issue: Encryption key lost on page refresh
**Solution**: Re-derive key from user ID + user agent

### Issue: Sync conflicts
**Solution**: Show conflict resolution modal to user

### Issue: Offline session expired
**Solution**: Force re-authentication when online

## Next Steps

1. Complete Task 2 (Draft Auto-Save)
2. Complete Task 3 (AI Analysis Enforcement)
3. Complete Task 4 (Offline-Aware Buttons)
4. Move to Phase 2 (Data Caching)

## Resources

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [idb Library](https://github.com/jakearchibald/idb)
