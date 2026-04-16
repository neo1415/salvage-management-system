'use client';

/**
 * System Health Metrics Component
 * 
 * Comprehensive system health metrics for admin dashboard
 * Task: 15.1.1
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Database, 
  Zap, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Server
} from 'lucide-react';

interface SystemHealthMetricsProps {
  metrics: {
    cacheHitRate: number;
    avgResponseTime: number;
    jobsRunning: number;
    lastRefresh: string;
    databaseConnections?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    errorRate?: number;
  };
}

export function SystemHealthMetrics({ metrics }: SystemHealthMetricsProps) {
  const cacheStatus = getHealthStatus(metrics.cacheHitRate, 80, 60);
  const responseStatus = getHealthStatus(200 - metrics.avgResponseTime, 0, -300); // Inverted: lower is better
  const errorStatus = getHealthStatus(100 - (metrics.errorRate || 0), 99, 95);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <HealthMetricCard
        icon={<Database className="h-5 w-5" />}
        title="Cache Performance"
        value={`${metrics.cacheHitRate.toFixed(1)}%`}
        status={cacheStatus}
        subtitle="Hit rate"
        trend={metrics.cacheHitRate >= 80 ? 'up' : 'down'}
      />

      <HealthMetricCard
        icon={<Zap className="h-5 w-5" />}
        title="Response Time"
        value={`${metrics.avgResponseTime}ms`}
        status={responseStatus}
        subtitle="Average latency"
        trend={metrics.avgResponseTime <= 200 ? 'up' : 'down'}
      />

      <HealthMetricCard
        icon={<Activity className="h-5 w-5" />}
        title="Background Jobs"
        value={metrics.jobsRunning.toString()}
        status="healthy"
        subtitle="Active processes"
      />

      <HealthMetricCard
        icon={<Clock className="h-5 w-5" />}
        title="Last Refresh"
        value={formatTime(metrics.lastRefresh)}
        status="healthy"
        subtitle="Materialized views"
      />

      {metrics.databaseConnections !== undefined && (
        <HealthMetricCard
          icon={<Server className="h-5 w-5" />}
          title="DB Connections"
          value={metrics.databaseConnections.toString()}
          status={getHealthStatus(100 - metrics.databaseConnections, 50, 20)}
          subtitle="Active connections"
        />
      )}

      {metrics.memoryUsage !== undefined && (
        <HealthMetricCard
          icon={<Activity className="h-5 w-5" />}
          title="Memory Usage"
          value={`${metrics.memoryUsage.toFixed(1)}%`}
          status={getHealthStatus(100 - metrics.memoryUsage, 30, 10)}
          subtitle="System memory"
        />
      )}

      {metrics.cpuUsage !== undefined && (
        <HealthMetricCard
          icon={<Activity className="h-5 w-5" />}
          title="CPU Usage"
          value={`${metrics.cpuUsage.toFixed(1)}%`}
          status={getHealthStatus(100 - metrics.cpuUsage, 30, 10)}
          subtitle="System CPU"
        />
      )}

      {metrics.errorRate !== undefined && (
        <HealthMetricCard
          icon={<AlertCircle className="h-5 w-5" />}
          title="Error Rate"
          value={`${metrics.errorRate.toFixed(2)}%`}
          status={errorStatus}
          subtitle="Last hour"
          trend={metrics.errorRate < 1 ? 'up' : 'down'}
        />
      )}
    </div>
  );
}

interface HealthMetricCardProps {
  icon: React.ReactNode;
  title: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical';
  subtitle: string;
  trend?: 'up' | 'down';
}

function HealthMetricCard({ icon, title, value, status, subtitle, trend }: HealthMetricCardProps) {
  const statusColors = {
    healthy: 'text-green-600 border-green-200 bg-green-50',
    warning: 'text-yellow-600 border-yellow-200 bg-yellow-50',
    critical: 'text-red-600 border-red-200 bg-red-50',
  };

  const statusIcons = {
    healthy: <CheckCircle className="h-4 w-4 text-green-600" />,
    warning: <AlertCircle className="h-4 w-4 text-yellow-600" />,
    critical: <AlertCircle className="h-4 w-4 text-red-600" />,
  };

  return (
    <Card className={`border-2 ${statusColors[status]}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        {statusIcons[status]}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend && (
            <TrendingUp 
              className={`h-4 w-4 ${trend === 'up' ? 'text-green-600' : 'text-red-600 rotate-180'}`} 
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function getHealthStatus(value: number, goodThreshold: number, warningThreshold: number): 'healthy' | 'warning' | 'critical' {
  if (value >= goodThreshold) return 'healthy';
  if (value >= warningThreshold) return 'warning';
  return 'critical';
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}
