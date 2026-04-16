/**
 * Trending Assets Table Component
 * Task 14.1.1: Create TrendingAssetsTable component with sell-through rate badges
 * 
 * Displays trending assets with performance metrics
 */

'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AssetPerformance {
  assetType: string;
  make?: string;
  model?: string;
  year?: number;
  avgPrice: number;
  auctionCount: number;
  sellThroughRate: number;
  trend: number;
  demandScore: number;
}

interface TrendingAssetsTableProps {
  assets: AssetPerformance[];
  isLoading?: boolean;
}

export function TrendingAssetsTable({ assets, isLoading }: TrendingAssetsTableProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-600">No trending assets data available for the selected filters.</p>
        <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or check back later.</p>
      </div>
    );
  }

  const formatAssetName = (asset: AssetPerformance) => {
    if (asset.make && asset.model && asset.year) {
      return `${asset.make} ${asset.model} ${asset.year}`;
    }
    return asset.assetType.charAt(0).toUpperCase() + asset.assetType.slice(1);
  };

  const getSellThroughBadge = (rate: number) => {
    if (rate >= 0.8) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          {(rate * 100).toFixed(0)}% • Hot
        </span>
      );
    } else if (rate >= 0.6) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {(rate * 100).toFixed(0)}% • Good
        </span>
      );
    } else if (rate >= 0.4) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          {(rate * 100).toFixed(0)}% • Fair
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          {(rate * 100).toFixed(0)}% • Slow
        </span>
      );
    }
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0.05) {
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    } else if (trend < -0.05) {
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    } else {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0.05) return 'text-green-600';
    if (trend < -0.05) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Asset</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Avg Price</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Auctions</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Sell-Through</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Demand</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Trend</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset, index) => (
            <tr 
              key={index} 
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatAssetName(asset)}
                  </span>
                  {index < 3 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                      {index + 1}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                ₦{asset.avgPrice.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-sm text-gray-900">
                {asset.auctionCount}
              </td>
              <td className="py-3 px-4">
                {getSellThroughBadge(asset.sellThroughRate)}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[80px]">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${asset.demandScore}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 min-w-[35px]">
                    {asset.demandScore}%
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-1">
                  {getTrendIcon(asset.trend)}
                  <span className={`text-sm font-medium ${getTrendColor(asset.trend)}`}>
                    {asset.trend > 0 ? '+' : ''}{(asset.trend * 100).toFixed(1)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
