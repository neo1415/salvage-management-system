/**
 * Vendor Market Intelligence Dashboard
 * Task 10.3.1
 * 
 * Provides market insights, trends, and analytics for vendors
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { TrendingUp, BarChart3, MapPin, Clock, Download, Filter } from 'lucide-react';

interface AssetPerformance {
  assetType: string;
  make?: string;
  model?: string;
  year?: number;
  avgPrice: number;
  auctionCount: number;
  sellThroughRate: number;
  trend: number;
}

interface TemporalPattern {
  hour: number;
  dayOfWeek: number;
  activityScore: number;
  competitionLevel: 'low' | 'medium' | 'high';
}

interface GeographicPattern {
  region: string;
  avgPrice: number;
  demandScore: number;
  priceVariance: number;
}

/**
 * Task 10.3.1: Create vendor market insights page
 */
export default function MarketInsightsPage() {
  const { data: session } = useSession();
  const [assetType, setAssetType] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [region, setRegion] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [assetPerformance, setAssetPerformance] = useState<AssetPerformance[]>([]);
  const [temporalPatterns, setTemporalPatterns] = useState<TemporalPattern[]>([]);
  const [geographicPatterns, setGeographicPatterns] = useState<GeographicPattern[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarketData();
  }, [assetType, dateRange, region]);

  const fetchMarketData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Convert dateRange to actual dates
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Build query params
      const params = new URLSearchParams();
      if (assetType !== 'all') params.set('assetType', assetType);
      if (region !== 'all') params.set('region', region);
      params.set('startDate', startDate.toISOString());
      params.set('endDate', endDate.toISOString());

      // Fetch asset performance data
      const assetResponse = await fetch(`/api/intelligence/analytics/asset-performance?${params}`);
      if (assetResponse.ok) {
        const assetData = await assetResponse.json();
        setAssetPerformance(assetData.data || []);
      }

      // Fetch temporal patterns
      const temporalResponse = await fetch(`/api/intelligence/analytics/temporal-patterns?${params}`);
      if (temporalResponse.ok) {
        const temporalData = await temporalResponse.json();
        setTemporalPatterns(temporalData.data || []);
      }

      // Fetch geographic patterns
      const geoResponse = await fetch(`/api/intelligence/analytics/geographic-patterns?${params}`);
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        setGeographicPatterns(geoData.data || []);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      setError('Failed to load market data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      // Convert dateRange to actual dates
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      const params = new URLSearchParams();
      if (assetType !== 'all') params.set('assetType', assetType);
      if (region !== 'all') params.set('region', region);
      params.set('startDate', startDate.toISOString());
      params.set('endDate', endDate.toISOString());
      
      const response = await fetch(`/api/intelligence/analytics/export?${params}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `market-insights-${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading report:', error);
    }
  };

  // Get best bidding times from temporal patterns
  const getBestBiddingTimes = () => {
    if (temporalPatterns.length === 0) return [];
    
    // Find hours with lowest competition
    return temporalPatterns
      .filter(p => p.competitionLevel === 'low')
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 5);
  };

  // Format asset name
  const formatAssetName = (asset: AssetPerformance) => {
    if (asset.make && asset.model && asset.year) {
      return `${asset.make} ${asset.model} ${asset.year}`;
    }
    return asset.assetType.charAt(0).toUpperCase() + asset.assetType.slice(1);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          Market Intelligence
        </h1>
        <p className="text-gray-600">
          Insights and trends to help you make informed bidding decisions
        </p>
      </div>

      {/* Task 10.3.9: Filters */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asset Type
            </label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="vehicle">Vehicles</option>
              <option value="electronics">Electronics</option>
              <option value="machinery">Machinery</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Regions</option>
              <option value="lagos">Lagos</option>
              <option value="abuja">Abuja</option>
              <option value="port-harcourt">Port Harcourt</option>
              <option value="kano">Kano</option>
            </select>
          </div>
        </div>

        {/* Task 10.3.10: Download Report button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Report
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchMarketData}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Task 10.3.2: Trending Assets */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Trending Assets</h2>
            </div>
            {assetPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Asset</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Avg Price</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Auctions</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Sell-Through</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetPerformance.slice(0, 10).map((asset, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="py-3 px-4 text-sm text-gray-900">{formatAssetName(asset)}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">₦{asset.avgPrice.toLocaleString()}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{asset.auctionCount}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{(asset.sellThroughRate * 100).toFixed(0)}%</td>
                        <td className={`py-3 px-4 text-sm ${asset.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {asset.trend > 0 ? '↑' : '↓'} {Math.abs(asset.trend * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600">No trending assets data available for the selected filters.</p>
                <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or check back later.</p>
              </div>
            )}
          </div>

          {/* Task 10.3.3: Best Time to Bid Heatmap */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Best Time to Bid</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Optimal bidding times based on competition levels
            </p>
            {getBestBiddingTimes().length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {getBestBiddingTimes().map((pattern, index) => (
                  <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <p className="text-sm font-medium text-gray-700">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][pattern.dayOfWeek]}
                    </p>
                    <p className="text-2xl font-bold text-green-600 my-2">
                      {pattern.hour}:00
                    </p>
                    <p className="text-xs text-gray-600">Low Competition</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600">No temporal pattern data available yet.</p>
                <p className="text-sm text-gray-500 mt-2">Data will appear as more auctions are completed.</p>
              </div>
            )}
          </div>

          {/* Task 10.3.5: Your Performance */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Your Performance</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Win Rate</p>
                <p className="text-2xl font-bold text-blue-600">--</p>
                <p className="text-xs text-gray-500 mt-1">Coming soon</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Avg Savings</p>
                <p className="text-2xl font-bold text-green-600">--</p>
                <p className="text-xs text-gray-500 mt-1">Coming soon</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Bids</p>
                <p className="text-2xl font-bold text-purple-600">--</p>
                <p className="text-xs text-gray-500 mt-1">Coming soon</p>
              </div>
            </div>
          </div>

          {/* Task 10.3.4: Regional Insights */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Regional Insights</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Price variations and demand across different regions
            </p>
            {geographicPatterns.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {geographicPatterns.map((pattern, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{pattern.region}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Avg Price:</span>
                        <span className="font-medium text-gray-900">₦{pattern.avgPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Demand:</span>
                        <span className="font-medium text-gray-900">{pattern.demandScore}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Variance:</span>
                        <span className="font-medium text-gray-900">±{Number(pattern.priceVariance).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600">No geographic data available yet.</p>
                <p className="text-sm text-gray-500 mt-2">Data will appear as more auctions are completed across regions.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
