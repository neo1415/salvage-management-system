'use client';

/**
 * System Health Indicators Component
 * 
 * Displays system health metrics and status
 * Task: 11.1.5
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, Database, Zap } from 'lucide-react';

interface SystemHealthMetrics {
  cacheHitRate: number;
  avgResponseTime: number;
  jobsRunning: number;
  lastRefresh: string;
}

interface SystemHealthIndicatorsProps {
  metrics: SystemHealthMetrics;
}

export function SystemHealthIndicators({ metrics }: SystemHealthIndicatorsProps) {
  const cacheStatus = metrics.cacheHitRate >= 80 ? 'healthy' : metrics.cacheHitRate >= 60 ? 'warning' : 'critical';
  const responseStatus = metrics.avgResponseTime <= 200 ? 'healthy' : metrics.avgResponseTime <= 500 ? 'warning' : 'critical';

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <HealthMetric
            icon={<Database className="h-4 w-4" />}
            label="Cache Hit Rate"
            value={`${metrics.cacheHitRate.toFixed(0)}%`}
            status={cacheStatus}
            description="Redis cache performance"
          />

          <HealthMetric
            icon={<Zap className="h-4 w-4" />}
            label="Avg Response Time"
            value={`${metrics.avgResponseTime}ms`}
            status={responseStatus}
            description="API endpoint latency"
          />

          <HealthMetric
            icon={<CheckCircle className="h-4 w-4" />}
            label="Background Jobs"
            value={metrics.jobsRunning.toString()}
            status="healthy"
            description="Active cron jobs"
          />

          <HealthMetric
            icon={<Clock className="h-4 w-4" />}
            label="Last Refresh"
            value={new Date(metrics.lastRefresh).toLocaleTimeString()}
            status="healthy"
            description="Materialized views"
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface HealthMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical';
  description: string;
}

function HealthMetric({ icon, label, value, status, description }: HealthMetricProps) {
  const statusColors = {
    healthy: 'text-green-600',
    warning: 'text-yellow-600',
    critical: 'text-red-600',
  };

  const statusBadges = {
    healthy: <Badge variant="outline" className="border-green-600 text-green-600">Healthy</Badge>,
    warning: <Badge variant="outline" className="border-yellow-600 text-yellow-600">Warning</Badge>,
    critical: <Badge variant="outline" className="border-red-600 text-red-600">Critical</Badge>,
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        {statusBadges[status]}
      </div>
      <div className={`text-2xl font-bold ${statusColors[status]}`}>
        {value}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
