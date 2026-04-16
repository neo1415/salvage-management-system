'use client';

/**
 * Vendor Segments Pie Chart Component
 * 
 * Displays vendor segmentation distribution
 * Task: 15.1.3
 */

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SegmentData {
  segment: string;
  count: number;
  percentage: number;
  color: string;
}

// Map database activitySegment values to display names
const SEGMENT_DISPLAY_NAMES: Record<string, string> = {
  'highly_active': 'High-Value',
  'active_bidder': 'Active',
  'regular_bidder': 'Active',
  'active': 'Active',
  'moderate': 'Occasional',
  'selective_bidder': 'Occasional',
  'inactive': 'Inactive',
  'new': 'New',
};

const SEGMENT_COLORS: Record<string, string> = {
  'High-Value': '#10b981', // green
  'Active': '#3b82f6', // blue
  'Occasional': '#f59e0b', // amber
  'New': '#8b5cf6', // purple
  'Inactive': '#6b7280', // gray
};

export function VendorSegmentsPieChart() {
  const [data, setData] = useState<SegmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVendors, setTotalVendors] = useState(0);

  useEffect(() => {
    fetchSegmentData();
  }, []);

  async function fetchSegmentData() {
    try {
      const response = await fetch('/api/intelligence/admin/vendor-segments');
      if (response.ok) {
        const result = await response.json();
        const segments = result.segments || [];
        
        // Group by display name (map database values to display names)
        const groupedSegments: Record<string, { count: number; dbSegments: string[] }> = {};
        
        segments.forEach((s: any) => {
          const displayName = SEGMENT_DISPLAY_NAMES[s.segment] || 'Inactive';
          if (!groupedSegments[displayName]) {
            groupedSegments[displayName] = { count: 0, dbSegments: [] };
          }
          groupedSegments[displayName].count += Number(s.count);
          groupedSegments[displayName].dbSegments.push(s.segment);
        });

        const total = Object.values(groupedSegments).reduce((sum, g) => sum + g.count, 0);
        setTotalVendors(total);

        const chartData = Object.entries(groupedSegments).map(([displayName, data]) => ({
          segment: displayName,
          count: data.count,
          percentage: total > 0 ? (data.count / total) * 100 : 0,
          color: SEGMENT_COLORS[displayName] || '#6b7280',
        }));

        setData(chartData);
      }
    } catch (error) {
      console.error('Error fetching segment data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vendor Segments</CardTitle>
          <CardDescription>Distribution by activity level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vendor Segments</CardTitle>
          <CardDescription>Distribution by activity level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No segment data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Segments</CardTitle>
        <CardDescription>
          {totalVendors.toLocaleString()} total vendors
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry: any) => `${entry.segment}: ${entry.percentage.toFixed(1)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{data.segment}</p>
                      <p className="text-sm">Count: {data.count.toLocaleString()}</p>
                      <p className="text-sm">Percentage: {data.percentage.toFixed(1)}%</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>

        {/* Segment Details Table */}
        <div className="mt-4 space-y-2">
          {data.map((segment) => (
            <div key={segment.segment} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: segment.color }}
                />
                <span className="font-medium">{segment.segment}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">{segment.count.toLocaleString()}</span>
                <span className="font-medium">{segment.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
