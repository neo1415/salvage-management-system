'use client';

/**
 * Session Analytics Metrics Component
 * 
 * Displays session duration, pages per session, bounce rate with trend charts
 * Task: 11.3.8 - Implement Session Analytics metrics and trends
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, FileText, TrendingDown } from 'lucide-react';

interface SessionMetrics {
  avgSessionDuration: number | string; // in seconds
  avgPagesPerSession: number | string;
  bounceRate: number | string;
  totalSessions: number | string;
}

interface SessionTrend {
  date: string;
  avgDuration: number | string;
  pagesPerSession: number | string;
  bounceRate: number | string;
}

interface SessionAnalyticsMetricsProps {
  metrics: SessionMetrics;
  trends: SessionTrend[];
  loading?: boolean;
}

export function SessionAnalyticsMetrics({ metrics, trends, loading }: SessionAnalyticsMetricsProps) {
  
  if (loading) {
    return <div className="text-center py-8">Loading session analytics...</div>;
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Analytics</CardTitle>
          <CardDescription>No session data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Convert all values to numbers
  const avgSessionDuration = Number(metrics.avgSessionDuration || 0);
  const avgPagesPerSession = Number(metrics.avgPagesPerSession || 0);
  const bounceRate = Number(metrics.bounceRate || 0);
  const totalSessions = Number(metrics.totalSessions || 0);

  const formatDuration = (seconds: number | string): string => {
    const secs = Number(seconds || 0);
    const minutes = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${minutes}m ${remainingSecs}s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Analytics</CardTitle>
        <CardDescription>
          User engagement and session behavior metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Avg Session Duration</span>
            </div>
            <p className="text-2xl font-bold">{formatDuration(avgSessionDuration)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalSessions.toLocaleString()} total sessions
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Pages per Session</span>
            </div>
            <p className="text-2xl font-bold">{avgPagesPerSession.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {avgPagesPerSession >= 3 ? 'Good engagement' : 'Low engagement'}
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-muted-foreground">Bounce Rate</span>
            </div>
            <p className="text-2xl font-bold">{bounceRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {bounceRate <= 40 ? 'Excellent' : bounceRate <= 60 ? 'Good' : 'Needs improvement'}
            </p>
          </div>
        </div>

        {/* Trend Charts */}
        {trends && trends.length > 0 && (
          <div className="space-y-6">
            {/* Session Duration Trend */}
            <div>
              <h4 className="font-semibold mb-3">Session Duration Trend</h4>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    className="text-xs"
                    tickFormatter={(value) => `${Math.floor(value / 60)}m`}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{new Date(data.date).toLocaleDateString()}</p>
                            <p className="text-sm text-blue-600">
                              Duration: {formatDuration(Number(data.avgDuration || 0))}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="avgDuration" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Pages per Session Trend */}
            <div>
              <h4 className="font-semibold mb-3">Pages per Session Trend</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{new Date(data.date).toLocaleDateString()}</p>
                            <p className="text-sm text-green-600">
                              Pages: {Number(data.pagesPerSession || 0).toFixed(1)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pagesPerSession" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Bounce Rate Trend */}
            <div>
              <h4 className="font-semibold mb-3">Bounce Rate Trend</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    className="text-xs"
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{new Date(data.date).toLocaleDateString()}</p>
                            <p className="text-sm text-orange-600">
                              Bounce Rate: {Number(data.bounceRate || 0).toFixed(1)}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bounceRate" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    dot={{ fill: '#f59e0b', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
