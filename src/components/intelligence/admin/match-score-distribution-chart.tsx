'use client';

/**
 * Match Score Distribution Chart Component
 * 
 * Displays bar chart of recommendation match score distribution
 * Task: 11.1.7
 */

import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

interface DistributionData {
  range: string;
  count: number;
  percentage: number;
}

export function MatchScoreDistributionChart() {
  const [data, setData] = useState<DistributionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDistributionData();
  }, []);

  async function fetchDistributionData() {
    try {
      const response = await fetch('/api/intelligence/admin/match-score-distribution');
      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching distribution data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="h-64 flex items-center justify-center">Loading chart...</div>;
  }

  if (data.length === 0) {
    return <div className="h-64 flex items-center justify-center text-muted-foreground">No data available</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="range" 
          className="text-xs"
        />
        <YAxis 
          className="text-xs"
        />
        <Tooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="bg-background border rounded-lg p-3 shadow-lg">
                  <p className="font-semibold">Match Score: {data.range}</p>
                  <p className="text-sm text-primary">{data.count} recommendations</p>
                  <p className="text-sm text-muted-foreground">{data.percentage.toFixed(1)}% of total</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar 
          dataKey="count" 
          fill="hsl(var(--primary))" 
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
