/**
 * Cache Status Component
 * 
 * Shows cache size, item counts, and provides cache management actions.
 * Displays storage statistics and allows users to clear cache or refresh data.
 */

'use client';

import { useState, useEffect } from 'react';
import { Database, Trash2, RefreshCw, HardDrive } from 'lucide-react';
import { CacheService } from '@/features/cache/services/cache.service';
import { useToast } from '@/components/ui/toast';

interface CacheStats {
  totalSize: number;
  auctionCount: number;
  documentCount: number;
  walletCount: number;
  lastUpdated: Date | null;
}

export interface CacheStatusProps {
  className?: string;
  showActions?: boolean;
  compact?: boolean;
}

export function CacheStatus({
  className = '',
  showActions = true,
  compact = false,
}: CacheStatusProps) {
  const [stats, setStats] = useState<CacheStats>({
    totalSize: 0,
    auctionCount: 0,
    documentCount: 0,
    walletCount: 0,
    lastUpdated: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toast = useToast();

  // Load cache stats
  const loadStats = async () => {
    try {
      setIsLoading(true);
      const cacheService = CacheService.getInstance();
      
      // Get storage usage
      const totalSize = await cacheService.getStorageUsage();
      
      // Get item counts
      const auctions = await cacheService.getCachedAuctions();
      const documents = await cacheService.getAllCachedDocuments();
      const wallets = await cacheService.getAllCachedWallets();
      
      // Find most recent update
      const allDates = [
        ...auctions.map((a: { cachedAt: Date }) => a.cachedAt),
        ...documents.map((d: { cachedAt: Date }) => d.cachedAt),
        ...wallets.map((w: { cachedAt: Date }) => w.cachedAt),
      ];
      const lastUpdated = allDates.length > 0 
        ? new Date(Math.max(...allDates.map(d => d.getTime())))
        : null;

      setStats({
        totalSize,
        auctionCount: auctions.length,
        documentCount: documents.length,
        walletCount: wallets.length,
        lastUpdated,
      });
    } catch (error) {
      console.error('Failed to load cache stats:', error);
      toast.error('Failed to load cache stats', 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all cache
  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear all cached data? This will remove offline access to auctions, documents, and wallet data.')) {
      return;
    }

    try {
      setIsClearing(true);
      const cacheService = CacheService.getInstance();
      await cacheService.clearAll();
      
      toast.success('Cache cleared', 'All cached data has been removed');
      await loadStats();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      toast.error('Failed to clear cache', 'Please try again');
    } finally {
      setIsClearing(false);
    }
  };

  // Refresh cache stats
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await loadStats();
      toast.success('Cache stats refreshed', 'Statistics updated');
    } catch (error) {
      console.error('Failed to refresh stats:', error);
      toast.error('Failed to refresh', 'Please try again');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  // Format bytes to human-readable size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#800020]"></div>
          <span className="ml-2 text-sm text-gray-600">Loading cache stats...</span>
        </div>
      </div>
    );
  }

  // Compact view
  if (compact) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-600" />
            <div>
              <p className="text-xs font-medium text-gray-900">
                {stats.auctionCount + stats.documentCount + stats.walletCount} items cached
              </p>
              <p className="text-xs text-gray-600">{formatBytes(stats.totalSize)}</p>
            </div>
          </div>
          {showActions && (
            <div className="flex items-center gap-1">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 text-gray-600 hover:text-[#800020] hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                title="Refresh stats"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleClearCache}
                disabled={isClearing}
                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Clear cache"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[#800020]" />
            <h3 className="text-lg font-semibold text-gray-900">Cache Storage</h3>
          </div>
          {showActions && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={handleClearCache}
                disabled={isClearing}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Clear Cache
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-4">
        {/* Total Size */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="text-sm font-medium text-gray-700">Total Storage Used</span>
          <span className="text-lg font-bold text-[#800020]">{formatBytes(stats.totalSize)}</span>
        </div>

        {/* Item Counts */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-blue-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.auctionCount}</p>
            <p className="text-xs text-blue-700 mt-1">Auctions</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">{stats.documentCount}</p>
            <p className="text-xs text-green-700 mt-1">Documents</p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.walletCount}</p>
            <p className="text-xs text-purple-700 mt-1">Wallets</p>
          </div>
        </div>

        {/* Last Updated */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Last Updated</span>
          <span className="font-medium">{formatDate(stats.lastUpdated)}</span>
        </div>
      </div>
    </div>
  );
}
