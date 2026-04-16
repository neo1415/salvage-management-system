'use client';

/**
 * Attribute Performance Tabs Component
 * 
 * Tabs displaying performance by color, trim, and storage attributes
 * Task: 11.3.3 - Implement Attribute Performance tabs (Color, Trim, Storage)
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface AttributePerformance {
  attributeValue: string;
  avgPricePremium: number | string;
  totalAuctions: number | string;
  avgBidCount: number | string;
  popularityScore: number | string;
}

interface AttributePerformanceTabsProps {
  colorData: AttributePerformance[];
  trimData: AttributePerformance[];
  storageData: AttributePerformance[];
  loading?: boolean;
}

export function AttributePerformanceTabs({ 
  colorData, 
  trimData, 
  storageData, 
  loading 
}: AttributePerformanceTabsProps) {
  
  if (loading) {
    return <div className="text-center py-8">Loading attribute performance data...</div>;
  }

  const renderChart = (data: AttributePerformance[], title: string, description: string) => {
    if (data.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No {title.toLowerCase()} data available
        </div>
      );
    }

    // Transform data for display
    const chartData = data.map(item => ({
      attribute: item.attributeValue,
      avgPrice: Number(item.avgPricePremium || 0),
      conversionRate: Number(item.popularityScore || 0), // Use popularity score as proxy
      totalAuctions: Number(item.totalAuctions || 0),
      avgDaysToSell: 0, // Not available in current data
    }));

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="attribute" 
                className="text-xs"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                yAxisId="left"
                className="text-xs"
                tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                className="text-xs"
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="font-semibold">{data.attribute}</p>
                        <p className="text-sm text-blue-600">
                          Price Premium: ₦{Number(data.avgPrice || 0).toLocaleString()}
                        </p>
                        <p className="text-sm text-green-600">
                          Popularity: {Number(data.conversionRate || 0).toFixed(0)}/100
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {Number(data.totalAuctions || 0)} auctions
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend />
              <Bar 
                yAxisId="left"
                dataKey="avgPrice" 
                fill="#3b82f6" 
                name="Price Premium (₦)"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                yAxisId="right"
                dataKey="conversionRate" 
                fill="#10b981" 
                name="Popularity Score"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div>
              <p className="text-sm text-muted-foreground">Most Popular</p>
              <p className="text-lg font-semibold">
                {chartData.reduce((max, item) => 
                  Number(item.conversionRate || 0) > Number(max.conversionRate || 0) ? item : max
                ).attribute}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Highest Premium</p>
              <p className="text-lg font-semibold">
                {chartData.reduce((max, item) => 
                  Number(item.avgPrice || 0) > Number(max.avgPrice || 0) ? item : max
                ).attribute}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Most Auctions</p>
              <p className="text-lg font-semibold">
                {chartData.reduce((max, item) => 
                  Number(item.totalAuctions || 0) > Number(max.totalAuctions || 0) ? item : max
                ).attribute}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Tabs defaultValue="color" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="color">Color Performance</TabsTrigger>
        <TabsTrigger value="trim">Trim Level Performance</TabsTrigger>
        <TabsTrigger value="storage">Storage Performance</TabsTrigger>
      </TabsList>

      <TabsContent value="color" className="mt-6">
        {renderChart(
          colorData,
          'Performance by Color',
          'Average prices and conversion rates by vehicle color'
        )}
      </TabsContent>

      <TabsContent value="trim" className="mt-6">
        {renderChart(
          trimData,
          'Performance by Trim Level',
          'Average prices and conversion rates by trim level'
        )}
      </TabsContent>

      <TabsContent value="storage" className="mt-6">
        {renderChart(
          storageData,
          'Performance by Storage Capacity',
          'Average prices and conversion rates by storage capacity (electronics)'
        )}
      </TabsContent>
    </Tabs>
  );
}
