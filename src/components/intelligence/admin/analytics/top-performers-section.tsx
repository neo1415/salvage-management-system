'use client';

/**
 * Top Performers Section Component
 * 
 * Displays top vendors, assets, and makes/models
 * Task: 11.3.9 - Implement Top Performers section
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Star } from 'lucide-react';

interface TopVendor {
  vendorId: string;
  vendorName: string;
  winRate: number | string;
  totalBids: number | string;
  totalWins: number | string;
  totalRevenue: number | string;
}

interface TopAsset {
  assetId: string;
  make: string;
  model: string;
  year: number;
  sellThroughRate: number | string;
  avgPrice: number | string;
  totalAuctions: number | string;
}

interface TopMake {
  make: string;
  totalAuctions: number | string;
  avgPrice: number | string;
  sellThroughRate: number | string;
}

interface TopPerformersSectionProps {
  topVendors: TopVendor[];
  topAssets: TopAsset[];
  topMakes: TopMake[];
  loading?: boolean;
}

export function TopPerformersSection({ 
  topVendors, 
  topAssets, 
  topMakes, 
  loading 
}: TopPerformersSectionProps) {
  
  if (loading) {
    return <div className="text-center py-8">Loading top performers...</div>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Top Vendors by Win Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-600" />
            Top Vendors
          </CardTitle>
          <CardDescription>Highest win rates</CardDescription>
        </CardHeader>
        <CardContent>
          {topVendors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No vendor data available
            </p>
          ) : (
            <div className="space-y-3">
              {topVendors.map((vendor, index) => {
                const winRate = Number(vendor.winRate || 0);
                const totalBids = Number(vendor.totalBids || 0);
                const totalWins = Number(vendor.totalWins || 0);
                const totalRevenue = Number(vendor.totalRevenue || 0);
                
                return (
                  <div 
                    key={vendor.vendorId}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                        ${index === 0 ? 'bg-yellow-500 text-white' : 
                          index === 1 ? 'bg-gray-400 text-white' : 
                          index === 2 ? 'bg-orange-600 text-white' : 
                          'bg-gray-200 text-gray-700'}
                      `}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{vendor.vendorName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="default" className="bg-green-600">
                          {winRate.toFixed(1)}% win rate
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {totalWins} wins / {totalBids} bids
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Revenue: ₦{totalRevenue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Assets by Sell-Through */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Top Assets
          </CardTitle>
          <CardDescription>Highest sell-through rates</CardDescription>
        </CardHeader>
        <CardContent>
          {topAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No asset data available
            </p>
          ) : (
            <div className="space-y-3">
              {topAssets.map((asset, index) => {
                const sellThroughRate = Number(asset.sellThroughRate || 0);
                const avgPrice = Number(asset.avgPrice || 0);
                const totalAuctions = Number(asset.totalAuctions || 0);
                
                return (
                  <div 
                    key={asset.assetId}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                        ${index === 0 ? 'bg-yellow-500 text-white' : 
                          index === 1 ? 'bg-gray-400 text-white' : 
                          index === 2 ? 'bg-orange-600 text-white' : 
                          'bg-gray-200 text-gray-700'}
                      `}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">
                        {asset.make} {asset.model}
                      </p>
                      <p className="text-sm text-muted-foreground">{asset.year}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="default" className="bg-green-600">
                          {sellThroughRate.toFixed(1)}% sell-through
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Avg: ₦{avgPrice.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {totalAuctions} auctions
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Makes/Models */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[#800020]" />
            Top Makes
          </CardTitle>
          <CardDescription>Most popular brands</CardDescription>
        </CardHeader>
        <CardContent>
          {topMakes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No make data available
            </p>
          ) : (
            <div className="space-y-3">
              {topMakes.map((make, index) => {
                const totalAuctions = Number(make.totalAuctions || 0);
                const avgPrice = Number(make.avgPrice || 0);
                const sellThroughRate = Number(make.sellThroughRate || 0);
                
                return (
                  <div 
                    key={make.make}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                        ${index === 0 ? 'bg-yellow-500 text-white' : 
                          index === 1 ? 'bg-gray-400 text-white' : 
                          index === 2 ? 'bg-orange-600 text-white' : 
                          'bg-gray-200 text-gray-700'}
                      `}>
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{make.make}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">
                          {totalAuctions} auctions
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Avg: ₦{avgPrice.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sellThroughRate.toFixed(1)}% sell-through
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
