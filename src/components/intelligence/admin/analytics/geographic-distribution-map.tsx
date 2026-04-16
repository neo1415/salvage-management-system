'use client';

/**
 * Geographic Distribution Map Component
 * 
 * Displays price variance and demand by region
 * Task: 11.3.5 - Implement Geographic Distribution map
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, TrendingUp, TrendingDown } from 'lucide-react';

interface GeographicPattern {
  region: string;
  avgPrice: number | string;
  priceVariance: number | string | null;
  demandScore: number;
  totalAuctions: number;
  topAssetType: string;
}

interface GeographicDistributionMapProps {
  data: GeographicPattern[];
  loading?: boolean;
}

export function GeographicDistributionMap({ data, loading }: GeographicDistributionMapProps) {
  
  if (loading) {
    return <div className="text-center py-8">Loading geographic data...</div>;
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Geographic Distribution</CardTitle>
          <CardDescription>No geographic data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Sort by demand score
  const sortedData = [...data].sort((a, b) => b.demandScore - a.demandScore);

  const getDemandBadge = (score: number) => {
    if (score >= 80) return { variant: 'default' as const, label: 'Very High', className: 'bg-green-600' };
    if (score >= 60) return { variant: 'default' as const, label: 'High', className: 'bg-blue-600' };
    if (score >= 40) return { variant: 'secondary' as const, label: 'Medium', className: '' };
    return { variant: 'outline' as const, label: 'Low', className: '' };
  };

  const getVarianceIndicator = (variance: number | string | null | undefined) => {
    // Convert to number, handling null/undefined/string cases
    const numVariance = variance ? Number(variance) : 0;
    
    // Check if conversion resulted in NaN
    if (isNaN(numVariance)) {
      return <span className="text-sm text-muted-foreground">N/A</span>;
    }
    
    if (numVariance > 0) {
      return (
        <div className="flex items-center text-red-600">
          <TrendingUp className="h-4 w-4 mr-1" />
          <span className="text-sm">+{numVariance.toFixed(1)}%</span>
        </div>
      );
    } else if (numVariance < 0) {
      return (
        <div className="flex items-center text-green-600">
          <TrendingDown className="h-4 w-4 mr-1" />
          <span className="text-sm">{numVariance.toFixed(1)}%</span>
        </div>
      );
    }
    return <span className="text-sm text-muted-foreground">0%</span>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geographic Distribution</CardTitle>
        <CardDescription>
          Price variance and demand scores by region
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedData.map((region, index) => {
            const demandBadge = getDemandBadge(region.demandScore);
            
            return (
              <div 
                key={`${region.region}-${index}`}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      <MapPin className="h-5 w-5 text-[#800020]" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{region.region}</h3>
                        <Badge 
                          variant={demandBadge.variant}
                          className={demandBadge.className}
                        >
                          {demandBadge.label} Demand
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Avg Price</p>
                          <p className="text-sm font-semibold">
                            ₦{Number(region.avgPrice || 0).toLocaleString()}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground">Price Variance</p>
                          {getVarianceIndicator(region.priceVariance)}
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground">Total Auctions</p>
                          <p className="text-sm font-semibold">{region.totalAuctions}</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-muted-foreground">Top Category</p>
                          <p className="text-sm font-semibold capitalize">
                            {region.topAssetType}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <p className="text-xs text-muted-foreground">Rank</p>
                    <p className="text-2xl font-bold text-[#800020]">#{index + 1}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Highest Demand</p>
            <p className="text-lg font-semibold">{sortedData[0]?.region || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Highest Avg Price</p>
            <p className="text-lg font-semibold">
              {data.reduce((max, item) => 
                item.avgPrice > max.avgPrice ? item : max
              ).region}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Most Active</p>
            <p className="text-lg font-semibold">
              {data.reduce((max, item) => 
                item.totalAuctions > max.totalAuctions ? item : max
              ).region}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
