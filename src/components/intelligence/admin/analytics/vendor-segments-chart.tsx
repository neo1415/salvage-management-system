'use client';

/**
 * Vendor Segments Chart Component
 * 
 * Pie chart and table showing vendor segment distribution
 * Task: 11.3.6 - Implement Vendor Segments pie chart and table
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface VendorSegment {
  segment: string;
  count: number | string;
  avgWinRate: number | string;
  avgBidAmount: number | string;
  totalRevenue: number | string;
}

interface VendorSegmentsChartProps {
  data: VendorSegment[];
  loading?: boolean;
}

const SEGMENT_COLORS: Record<string, string> = {
  'bargain_hunter': '#10b981',
  'premium_buyer': '#800020',
  'specialist': '#3b82f6',
  'opportunist': '#f59e0b',
  'inactive': '#6b7280',
};

const SEGMENT_LABELS: Record<string, string> = {
  'bargain_hunter': 'Bargain Hunters',
  'premium_buyer': 'Premium Buyers',
  'specialist': 'Specialists',
  'opportunist': 'Opportunists',
  'inactive': 'Inactive',
};

export function VendorSegmentsChart({ data, loading }: VendorSegmentsChartProps) {
  
  if (loading) {
    return <div className="text-center py-8">Loading vendor segments...</div>;
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vendor Segments</CardTitle>
          <CardDescription>No vendor segment data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Convert all values to numbers
  const totalVendors = data.reduce((sum, item) => sum + Number(item.count || 0), 0);

  const chartData = data.map(item => {
    const count = Number(item.count || 0);
    return {
      name: SEGMENT_LABELS[item.segment] || item.segment,
      value: count,
      percentage: ((count / totalVendors) * 100).toFixed(1),
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendor Segments</CardTitle>
        <CardDescription>
          Distribution of vendors by behavioral segment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => {
                    const segment = data[index].segment;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={SEGMENT_COLORS[segment] || '#6b7280'} 
                      />
                    );
                  })}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold">{data.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.value} vendors ({data.payload.percentage}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Stats */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Vendors</p>
              <p className="text-3xl font-bold">{totalVendors.toLocaleString()}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-semibold">Segment Breakdown</p>
              {data.map((segment, index) => {
                const count = Number(segment.count || 0);
                return (
                  <div key={`${segment.segment}-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: SEGMENT_COLORS[segment.segment] }}
                      />
                      <span className="text-sm">
                        {SEGMENT_LABELS[segment.segment] || segment.segment}
                      </span>
                    </div>
                    <span className="text-sm font-semibold">
                      {((count / totalVendors) * 100).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="mt-6 pt-6 border-t">
          <h3 className="font-semibold mb-4">Segment Performance Metrics</h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Segment</TableHead>
                  <TableHead className="text-right">Vendors</TableHead>
                  <TableHead className="text-right">Avg Win Rate</TableHead>
                  <TableHead className="text-right">Avg Bid Amount</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((segment, index) => {
                  const count = Number(segment.count || 0);
                  const avgWinRate = Number(segment.avgWinRate || 0);
                  const avgBidAmount = Number(segment.avgBidAmount || 0);
                  const totalRevenue = Number(segment.totalRevenue || 0);
                  
                  return (
                    <TableRow key={`${segment.segment}-table-${index}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: SEGMENT_COLORS[segment.segment] }}
                          />
                          <span className="font-medium">
                            {SEGMENT_LABELS[segment.segment] || segment.segment}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={avgWinRate >= 50 ? 'default' : 'secondary'}
                          className={avgWinRate >= 50 ? 'bg-green-600' : ''}
                        >
                          {avgWinRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ₦{avgBidAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        ₦{totalRevenue.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
