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
  assetType: 'vehicle' | 'property' | 'electronics';
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
}

const DB_NAME = 'salvage-management-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<SalvageDBSchema> | null = null;

/**
 * Initialize IndexedDB
 */
export async function initDB(): Promise<IDBPDatabase<SalvageDBSchema>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<SalvageDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
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
