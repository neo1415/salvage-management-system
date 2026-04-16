'use client';

/**
 * Prediction Accuracy Chart Component
 * 
 * Displays 30-day trend of prediction accuracy
 * Task: 11.1.6
 */

import { useEffect, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

interface AccuracyDataPoint {
  date: string;
  accuracy: number;
  avgError: number;
  predictions: number;
}

export function PredictionAccuracyChart() {
  const [data, setData] = useState<AccuracyDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccuracyData();
  }, []);

  async function fetchAccuracyData() {
    try {
      const response = await fetch('/api/intelligence/admin/accuracy-trend?days=30');
      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching accuracy data:', error);
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
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          className="text-xs"
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        />
        <YAxis 
          className="text-xs"
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="bg-background border rounded-lg p-3 shadow-lg">
                  <p className="font-semibold">{new Date(data.date).toLocaleDateString()}</p>
                  <p className="text-sm text-green-600">Accuracy: {data.accuracy.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">Avg Error: ±{data.avgError.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">{data.predictions} predictions</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Line 
          type="monotone" 
          dataKey="accuracy" 
          stroke="hsl(var(--primary))" 
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
