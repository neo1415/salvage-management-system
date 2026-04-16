'use client';

/**
 * Intelligence Dashboard Content Component
 * 
 * Main dashboard content with metrics, charts, and fraud alerts
 * Tasks: 11.1.2-11.1.7, 15.1.1-15.1.4 (UI Integration)
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Users, 
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { PredictionAccuracyChart } from './prediction-accuracy-chart';
import { MatchScoreDistributionChart } from './match-score-distribution-chart';
import { FraudAlertsTable } from './fraud-alerts-table';
import { SystemHealthIndicators } from './system-health-indicators';
import { SystemHealthMetrics } from './system-health-metrics';
import { VendorSegmentsPieChart } from './vendor-segments-pie-chart';
import { SchemaEvolutionTable } from './schema-evolution-table';
import { MLDatasetsTable } from './ml-datasets-table';

interface DashboardMetrics {
  predictionAccuracy: {
    current: number;
    change: number;
    avgError: number;
    totalPredictions: number;
  };
  recommendationEffectiveness: {
    bidConversionRate: number;
    change: number;
    avgMatchScore: number;
    totalRecommendations: number;
  };
  fraudAlerts: {
    pending: number;
    confirmed: number;
    dismissed: number;
    total: number;
  };
  systemHealth: {
    cacheHitRate: number;
    avgResponseTime: number;
    jobsRunning: number;
    lastRefresh: string;
  };
}

export function IntelligenceDashboardContent() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardMetrics();
  }, []);

  async function fetchDashboardMetrics() {
    try {
      setLoading(true);
      const response = await fetch('/api/intelligence/admin/dashboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard metrics');
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
          <Button onClick={fetchDashboardMetrics} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Analytics</TabsTrigger>
          <TabsTrigger value="schema">Schema Evolution</TabsTrigger>
          <TabsTrigger value="datasets">ML Datasets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Task 11.1.2: Prediction accuracy metrics card */}
          {/* Task 11.1.3: Recommendation effectiveness metrics card */}
          {/* Task 11.1.5: System health indicators */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Prediction Accuracy"
              value={`${metrics.predictionAccuracy.current.toFixed(1)}%`}
              change={metrics.predictionAccuracy.change}
              description={`±${metrics.predictionAccuracy.avgError.toFixed(1)}% avg error`}
              icon={<Target className="h-4 w-4" />}
              subtitle={`${metrics.predictionAccuracy.totalPredictions.toLocaleString()} predictions`}
            />

            <MetricCard
              title="Recommendation Conversion"
              value={`${metrics.recommendationEffectiveness.bidConversionRate.toFixed(1)}%`}
              change={metrics.recommendationEffectiveness.change}
              description={`${metrics.recommendationEffectiveness.avgMatchScore.toFixed(0)} avg match score`}
              icon={<Users className="h-4 w-4" />}
              subtitle={`${metrics.recommendationEffectiveness.totalRecommendations.toLocaleString()} recommendations`}
            />

            <MetricCard
              title="Fraud Alerts"
              value={metrics.fraudAlerts.pending.toString()}
              description={`${metrics.fraudAlerts.confirmed} confirmed, ${metrics.fraudAlerts.dismissed} dismissed`}
              icon={<AlertTriangle className="h-4 w-4" />}
              subtitle={`${metrics.fraudAlerts.total} total alerts`}
              variant={metrics.fraudAlerts.pending > 0 ? 'warning' : 'default'}
            />

            <MetricCard
              title="System Health"
              value={`${metrics.systemHealth.cacheHitRate.toFixed(0)}%`}
              description={`${metrics.systemHealth.avgResponseTime}ms avg response`}
              icon={<CheckCircle className="h-4 w-4" />}
              subtitle={`${metrics.systemHealth.jobsRunning} jobs running`}
              variant="success"
            />
          </div>

          {/* Task 11.1.6: Prediction accuracy trend chart (30 days) */}
          {/* Task 11.1.7: MatchScore distribution bar chart */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Prediction Accuracy Trend</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <PredictionAccuracyChart />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Match Score Distribution</CardTitle>
                <CardDescription>Recommendation quality breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <MatchScoreDistributionChart />
              </CardContent>
            </Card>
          </div>

          {/* Task 11.1.4: Fraud alerts table with action buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Fraud Alerts</CardTitle>
              <CardDescription>
                Pending alerts requiring review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FraudAlertsTable onAlertUpdated={fetchDashboardMetrics} />
            </CardContent>
          </Card>

          {/* System Health Details */}
          <SystemHealthIndicators metrics={metrics.systemHealth} />
        </TabsContent>

        <TabsContent value="health">
          <SystemHealthMetrics metrics={metrics.systemHealth} />
        </TabsContent>

        <TabsContent value="vendors">
          <VendorSegmentsPieChart />
        </TabsContent>

        <TabsContent value="schema">
          <SchemaEvolutionTable />
        </TabsContent>

        <TabsContent value="datasets">
          <MLDatasetsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  description: string;
  icon: React.ReactNode;
  subtitle: string;
  variant?: 'default' | 'success' | 'warning';
}

function MetricCard({ 
  title, 
  value, 
  change, 
  description, 
  icon, 
  subtitle,
  variant = 'default'
}: MetricCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <Card className={
      variant === 'warning' ? 'border-yellow-500' :
      variant === 'success' ? 'border-green-500' :
      ''
    }>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            {isPositive && <TrendingUp className="h-3 w-3 text-green-500 mr-1" />}
            {isNegative && <TrendingDown className="h-3 w-3 text-red-500 mr-1" />}
            <span className={isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : ''}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
            <span className="ml-1">vs last period</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
