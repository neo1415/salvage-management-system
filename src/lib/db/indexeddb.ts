/**
 * IndexedDB Schema for Offline Case Storage
 * 
 * Provides offline storage for salvage cases when network is unavailable.
 * Cases are stored locally and synced when connection is restored.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Offline case data structure
 */
export interface OfflineCase {
  id: string; // Temporary ID for offline case
  claimReference: string;
  assetType: 'vehicle' | 'property' | 'electronics' | 'appliance' | 'jewelry' | 'furniture' | 'machinery';
  assetDetails: Record<string, unknown>;
  marketValue: number;
  photos: string[]; // Base64 encoded images
  gpsLocation: {
    latitude: number;
    longitude: number;
  };
  locationName: string;
  voiceNotes?: string[];
  status: 'draft' | 'pending_approval';
  createdBy: string;
  createdAt: Date;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  syncError?: string;
  lastModified: Date;
  version: number; // For conflict resolution
}

/**
 * Sync queue item
 */
export interface SyncQueueItem {
  id: string;
  caseId: string; // Reference to offline case
  operation: 'create' | 'update' | 'delete';
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}

/**
 * Draft case data structure
 */
export interface DraftCase {
  id: string;
  formData: Record<string, unknown>;
  status: 'draft';
  createdAt: Date;
  updatedAt: Date;
  autoSavedAt: Date;
  hasAIAnalysis: boolean;
  marketValue?: number;
}

/**
 * Cached auction data structure
 */
export interface CachedAuction {
  data: Record<string, unknown>;
  cachedAt: Date;
  expiresAt: Date;
  size: number;
}

/**
 * Cached document data structure
 */
export interface CachedDocument {
  data: Record<string, unknown>;
  auctionId: string;
  cachedAt: Date;
  expiresAt: Date;
  pdfUrl?: string;
  size: number;
}

/**
 * Cached wallet data structure
 */
export interface CachedWallet {
  balance: number;
  transactions: Array<Record<string, unknown>>;
  cachedAt: Date;
  expiresAt: Date;
  size: number;
}

/**
 * Database schema definition
 */
interface SalvageDBSchema extends DBSchema {
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
  drafts: {
    key: string;
    value: DraftCase;
    indexes: {
      'by-created-at': Date;
      'by-updated-at': Date;
      'by-auto-saved-at': Date;
    };
  };
  cachedAuctions: {
    key: string;
    value: CachedAuction;
    indexes: {
      'by-cached-at': Date;
      'by-expires-at': Date;
    };
  };
  cachedDocuments: {
    key: string;
    value: CachedDocument;
    indexes: {
      'by-auction-id': string;
      'by-cached-at': Date;
      'by-expires-at': Date;
    };
  };
  cachedWallet: {
    key: string;
    value: CachedWallet;
    indexes: {
      'by-cached-at': Date;
      'by-expires-at': Date;
    };
  };
}

const DB_NAME = 'salvage-management-db';
const DB_VERSION = 3; // Incremented for cache stores

let dbInstance: IDBPDatabase<SalvageDBSchema> | null = null;

/**
 * Initialize IndexedDB
 */
export async function initDB(): Promise<IDBPDatabase<SalvageDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<SalvageDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Create offlineCases store
      if (!db.objectStoreNames.contains('offlineCases')) {
        const offlineCasesStore = db.createObjectStore('offlineCases', {
          keyPath: 'id',
        });
        
        offlineCasesStore.createIndex('by-sync-status', 'syncStatus');
        offlineCasesStore.createIndex('by-created-at', 'createdAt');
        offlineCasesStore.createIndex('by-claim-reference', 'claimReference');
      }

      // Create syncQueue store
      if (!db.objectStoreNames.contains('syncQueue')) {
        const syncQueueStore = db.createObjectStore('syncQueue', {
          keyPath: 'id',
        });
        
        syncQueueStore.createIndex('by-case-id', 'caseId');
        syncQueueStore.createIndex('by-created-at', 'createdAt');
      }

      // Create drafts store (v2)
      if (oldVersion < 2 && !db.objectStoreNames.contains('drafts')) {
        const draftsStore = db.createObjectStore('drafts', {
          keyPath: 'id',
        });
        
        draftsStore.createIndex('by-created-at', 'createdAt');
        draftsStore.createIndex('by-updated-at', 'updatedAt');
        draftsStore.createIndex('by-auto-saved-at', 'autoSavedAt');
      }

      // Create cache stores (v3)
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('cachedAuctions')) {
          const cachedAuctionsStore = db.createObjectStore('cachedAuctions', {
            keyPath: 'data.id',
          });
          
          cachedAuctionsStore.createIndex('by-cached-at', 'cachedAt');
          cachedAuctionsStore.createIndex('by-expires-at', 'expiresAt');
        }

        if (!db.objectStoreNames.contains('cachedDocuments')) {
          const cachedDocumentsStore = db.createObjectStore('cachedDocuments', {
            keyPath: 'data.id',
          });
          
          cachedDocumentsStore.createIndex('by-auction-id', 'auctionId');
          cachedDocumentsStore.createIndex('by-cached-at', 'cachedAt');
          cachedDocumentsStore.createIndex('by-expires-at', 'expiresAt');
        }

        if (!db.objectStoreNames.contains('cachedWallet')) {
          const cachedWalletStore = db.createObjectStore('cachedWallet', {
            keyPath: 'userId',
          });
          
          cachedWalletStore.createIndex('by-cached-at', 'cachedAt');
          cachedWalletStore.createIndex('by-expires-at', 'expiresAt');
        }
      }
    },
  });

  return dbInstance;
}

/**
 * Get database instance
 */
export async function getDB(): Promise<IDBPDatabase<SalvageDBSchema>> {
  if (!dbInstance) {
    return await initDB();
  }
  return dbInstance;
}

/**
 * Save offline case
 */
export async function saveOfflineCase(caseData: Omit<OfflineCase, 'id' | 'createdAt' | 'lastModified' | 'version'>): Promise<OfflineCase> {
  const db = await getDB();
  
  const offlineCase: OfflineCase = {
    ...caseData,
    id: `offline-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    createdAt: new Date(),
    lastModified: new Date(),
    version: 1,
  };

  await db.add('offlineCases', offlineCase);
  
  return offlineCase;
}

/**
 * Get offline case by ID
 */
export async function getOfflineCase(id: string): Promise<OfflineCase | undefined> {
  const db = await getDB();
  return await db.get('offlineCases', id);
}

/**
 * Get all offline cases
 */
export async function getAllOfflineCases(): Promise<OfflineCase[]> {
  const db = await getDB();
  return await db.getAll('offlineCases');
}

/**
 * Get offline cases by sync status
 */
export async function getOfflineCasesByStatus(status: OfflineCase['syncStatus']): Promise<OfflineCase[]> {
  const db = await getDB();
  return await db.getAllFromIndex('offlineCases', 'by-sync-status', status);
}

/**
 * Update offline case
 */
export async function updateOfflineCase(id: string, updates: Partial<OfflineCase>): Promise<void> {
  const db = await getDB();
  const existingCase = await db.get('offlineCases', id);
  
  if (!existingCase) {
    throw new Error(`Offline case not found: ${id}`);
  }

  const updatedCase: OfflineCase = {
    ...existingCase,
    ...updates,
    lastModified: new Date(),
    version: existingCase.version + 1,
  };

  await db.put('offlineCases', updatedCase);
}

/**
 * Delete offline case
 */
export async function deleteOfflineCase(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offlineCases', id);
}

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(
  caseId: string,
  operation: SyncQueueItem['operation'],
  payload: unknown
): Promise<SyncQueueItem> {
  const db = await getDB();
  
  const queueItem: SyncQueueItem = {
    id: `sync-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    caseId,
    operation,
    payload,
    attempts: 0,
    maxAttempts: 3,
    createdAt: new Date(),
  };

  await db.add('syncQueue', queueItem);
  
  return queueItem;
}

/**
 * Get sync queue items
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return await db.getAll('syncQueue');
}

/**
 * Get sync queue items for a specific case
 */
export async function getSyncQueueForCase(caseId: string): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return await db.getAllFromIndex('syncQueue', 'by-case-id', caseId);
}

/**
 * Update sync queue item
 */
export async function updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
  const db = await getDB();
  const existingItem = await db.get('syncQueue', id);
  
  if (!existingItem) {
    throw new Error(`Sync queue item not found: ${id}`);
  }

  const updatedItem: SyncQueueItem = {
    ...existingItem,
    ...updates,
  };

  await db.put('syncQueue', updatedItem);
}

/**
 * Remove item from sync queue
 */
export async function removeFromSyncQueue(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

/**
 * Clear all offline data (for testing/reset)
 */
export async function clearOfflineData(): Promise<void> {
  const db = await getDB();
  await db.clear('offlineCases');
  await db.clear('syncQueue');
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(): Promise<{
  totalCases: number;
  pendingSync: number;
  syncing: number;
  synced: number;
  errors: number;
  queueSize: number;
}> {
  const db = await getDB();
  
  const allCases = await db.getAll('offlineCases');
  const queue = await db.getAll('syncQueue');
  
  return {
    totalCases: allCases.length,
    pendingSync: allCases.filter(c => c.syncStatus === 'pending').length,
    syncing: allCases.filter(c => c.syncStatus === 'syncing').length,
    synced: allCases.filter(c => c.syncStatus === 'synced').length,
    errors: allCases.filter(c => c.syncStatus === 'error').length,
    queueSize: queue.length,
  };
}

/**
 * Save draft case
 * If a draft with the same claim reference exists, update it instead of creating a new one
 */
export async function saveDraft(formData: Record<string, unknown>, hasAIAnalysis: boolean = false, marketValue?: number): Promise<DraftCase> {
  const db = await getDB();
  
  // Check if a draft with the same claim reference already exists
  const claimReference = formData.claimReference as string;
  if (claimReference) {
    const existingDraft = await findDraftByClaimReference(claimReference);
    if (existingDraft) {
      // Update the existing draft instead of creating a new one
      return await updateDraft(existingDraft.id, formData, hasAIAnalysis, marketValue);
    }
  }
  
  const now = new Date();
  const draft: DraftCase = {
    id: `draft-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    formData,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    autoSavedAt: now,
    hasAIAnalysis,
    marketValue,
  };

  await db.add('drafts', draft);
  
  return draft;
}

/**
 * Update existing draft
 */
export async function updateDraft(id: string, formData: Record<string, unknown>, hasAIAnalysis?: boolean, marketValue?: number): Promise<DraftCase> {
  const db = await getDB();
  const existingDraft = await db.get('drafts', id);
  
  if (!existingDraft) {
    throw new Error(`Draft not found: ${id}`);
  }

  const now = new Date();
  const updatedDraft: DraftCase = {
    ...existingDraft,
    formData,
    updatedAt: now,
    autoSavedAt: now,
    hasAIAnalysis: hasAIAnalysis !== undefined ? hasAIAnalysis : existingDraft.hasAIAnalysis,
    marketValue: marketValue !== undefined ? marketValue : existingDraft.marketValue,
  };

  await db.put('drafts', updatedDraft);
  
  return updatedDraft;
}

/**
 * Get draft by ID
 */
export async function getDraft(id: string): Promise<DraftCase | undefined> {
  const db = await getDB();
  return await db.get('drafts', id);
}

/**
 * Find draft by claim reference
 */
export async function findDraftByClaimReference(claimReference: string): Promise<DraftCase | undefined> {
  const db = await getDB();
  const allDrafts = await db.getAll('drafts');
  return allDrafts.find(draft => draft.formData.claimReference === claimReference);
}

/**
 * Get all drafts
 */
export async function getAllDrafts(): Promise<DraftCase[]> {
  const db = await getDB();
  const drafts = await db.getAll('drafts');
  // Sort by most recently updated
  return drafts.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Delete draft
 */
export async function deleteDraft(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('drafts', id);
}

/**
 * Clear all drafts
 */
export async function clearAllDrafts(): Promise<void> {
  const db = await getDB();
  await db.clear('drafts');
}

/**
 * Cache auction data
 */
export async function cacheAuction(auction: Record<string, unknown>, maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getDB();
  const now = new Date();
  
  const cached: CachedAuction = {
    data: auction,
    cachedAt: now,
    expiresAt: new Date(now.getTime() + maxAgeMs),
    size: JSON.stringify(auction).length,
  };

  await db.put('cachedAuctions', cached);
}

/**
 * Get cached auction
 */
export async function getCachedAuction(id: string): Promise<CachedAuction | undefined> {
  const db = await getDB();
  const cached = await db.get('cachedAuctions', id);
  
  // Check if expired
  if (cached && cached.expiresAt < new Date()) {
    await db.delete('cachedAuctions', id);
    return undefined;
  }
  
  return cached;
}

/**
 * Get all cached auctions
 */
export async function getAllCachedAuctions(): Promise<CachedAuction[]> {
  const db = await getDB();
  const cached = await db.getAll('cachedAuctions');
  
  // Filter out expired
  const now = new Date();
  return cached.filter(c => c.expiresAt >= now);
}

/**
 * Cache document data
 */
export async function cacheDocument(document: Record<string, unknown>, auctionId: string, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getDB();
  const now = new Date();
  
  const cached: CachedDocument = {
    data: document,
    auctionId,
    cachedAt: now,
    expiresAt: new Date(now.getTime() + maxAgeMs),
    pdfUrl: document.pdfUrl as string | undefined,
    size: JSON.stringify(document).length,
  };

  await db.put('cachedDocuments', cached);
}

/**
 * Get cached document
 */
export async function getCachedDocument(id: string): Promise<CachedDocument | undefined> {
  const db = await getDB();
  const cached = await db.get('cachedDocuments', id);
  
  // Check if expired
  if (cached && cached.expiresAt < new Date()) {
    await db.delete('cachedDocuments', id);
    return undefined;
  }
  
  return cached;
}

/**
 * Get cached documents by auction ID
 */
export async function getCachedDocumentsByAuction(auctionId: string): Promise<CachedDocument[]> {
  const db = await getDB();
  const cached = await db.getAllFromIndex('cachedDocuments', 'by-auction-id', auctionId);
  
  // Filter out expired
  const now = new Date();
  return cached.filter(c => c.expiresAt >= now);
}

/**
 * Cache wallet data
 */
export async function cacheWallet(userId: string, balance: number, transactions: Array<Record<string, unknown>>, maxAgeMs: number = 60 * 60 * 1000): Promise<void> {
  const db = await getDB();
  const now = new Date();
  
  const cached: CachedWallet & { userId: string } = {
    userId,
    balance,
    transactions,
    cachedAt: now,
    expiresAt: new Date(now.getTime() + maxAgeMs),
    size: JSON.stringify({ balance, transactions }).length,
  };

  await db.put('cachedWallet', cached);
}

/**
 * Get cached wallet
 */
export async function getCachedWallet(userId: string): Promise<CachedWallet | undefined> {
  const db = await getDB();
  const cached = await db.get('cachedWallet', userId);
  
  // Check if expired
  if (cached && cached.expiresAt < new Date()) {
    await db.delete('cachedWallet', userId);
    return undefined;
  }
  
  return cached;
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  const db = await getDB();
  const now = new Date();
  let cleared = 0;

  // Clear expired auctions
  const auctions = await db.getAll('cachedAuctions');
  for (const auction of auctions) {
    if (auction.expiresAt < now) {
      await db.delete('cachedAuctions', auction.data.id as string);
      cleared++;
    }
  }

  // Clear expired documents
  const documents = await db.getAll('cachedDocuments');
  for (const doc of documents) {
    if (doc.expiresAt < now) {
      await db.delete('cachedDocuments', doc.data.id as string);
      cleared++;
    }
  }

  // Clear expired wallet data
  const wallets = await db.getAll('cachedWallet');
  for (const wallet of wallets) {
    if (wallet.expiresAt < now) {
      await db.delete('cachedWallet', (wallet as unknown as { userId: string }).userId);
      cleared++;
    }
  }

  return cleared;
}

/**
 * Get cache storage usage
 */
export async function getCacheStorageUsage(): Promise<{
  auctions: { count: number; size: number };
  documents: { count: number; size: number };
  wallet: { count: number; size: number };
  total: number;
}> {
  const db = await getDB();

  const auctions = await db.getAll('cachedAuctions');
  const documents = await db.getAll('cachedDocuments');
  const wallets = await db.getAll('cachedWallet');

  const auctionsSize = auctions.reduce((sum, a) => sum + a.size, 0);
  const documentsSize = documents.reduce((sum, d) => sum + d.size, 0);
  const walletsSize = wallets.reduce((sum, w) => sum + w.size, 0);

  return {
    auctions: { count: auctions.length, size: auctionsSize },
    documents: { count: documents.length, size: documentsSize },
    wallet: { count: wallets.length, size: walletsSize },
    total: auctionsSize + documentsSize + walletsSize,
  };
}
