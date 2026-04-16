'use client';

/**
 * Conversion Funnel Diagram Component
 * 
 * Sankey-style funnel showing View → Bid → Win conversion rates
 * Task: 11.3.7 - Implement Conversion Funnel Sankey diagram
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';

interface ConversionFunnelData {
  views: number | string;
  bids: number | string;
  wins: number | string;
  viewToBidRate: number | string;
  bidToWinRate: number | string;
  overallConversionRate: number | string;
}

interface ConversionFunnelDiagramProps {
  data: ConversionFunnelData;
  loading?: boolean;
}

export function ConversionFunnelDiagram({ data, loading }: ConversionFunnelDiagramProps) {
  
  if (loading) {
    return <div className="text-center py-8">Loading conversion funnel...</div>;
  }

  if (!data || Number(data.views || 0) === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
          <CardDescription>No conversion data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Convert all values to numbers
  const views = Number(data.views || 0);
  const bids = Number(data.bids || 0);
  const wins = Number(data.wins || 0);
  const viewToBidRate = Number(data.viewToBidRate || 0);
  const bidToWinRate = Number(data.bidToWinRate || 0);
  const overallConversionRate = Number(data.overallConversionRate || 0);

  const stages = [
    {
      name: 'Views',
      count: views,
      percentage: 100,
      color: 'bg-blue-500',
      dropOff: 0,
    },
    {
      name: 'Bids',
      count: bids,
      percentage: viewToBidRate,
      color: 'bg-green-500',
      dropOff: 100 - viewToBidRate,
    },
    {
      name: 'Wins',
      count: wins,
      percentage: bidToWinRate,
      color: 'bg-[#800020]',
      dropOff: 100 - bidToWinRate,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversion Funnel</CardTitle>
        <CardDescription>
          User journey from viewing auctions to winning bids
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Funnel Visualization */}
        <div className="space-y-6">
          {stages.map((stage, index) => (
            <div key={stage.name}>
              <div className="flex items-center gap-4">
                {/* Stage Bar */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{stage.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {(stage.count || 0).toLocaleString()} ({(stage.percentage || 0).toFixed(1)}%)
                    </span>
                  </div>
                  
                  <div className="relative h-16 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className={`h-full ${stage.color} transition-all duration-500 flex items-center justify-center text-white font-semibold`}
                      style={{ width: `${stage.percentage || 0}%` }}
                    >
                      {(stage.percentage || 0) >= 20 && (
                        <span>{(stage.count || 0).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Drop-off indicator */}
              {index < stages.length - 1 && (
                <div className="flex items-center gap-2 my-3 ml-4">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {stage.dropOff > 0 && (
                      <span className="text-red-600 font-medium">
                        -{(stage.dropOff || 0).toFixed(1)}% drop-off
                      </span>
                    )}
                    {' '}
                    <span className="text-green-600 font-medium">
                      {(stages[index + 1]?.percentage || 0).toFixed(1)}% conversion
                    </span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">View → Bid</p>
            <p className="text-2xl font-bold text-green-600">
              {viewToBidRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {bids.toLocaleString()} of {views.toLocaleString()}
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Bid → Win</p>
            <p className="text-2xl font-bold text-[#800020]">
              {bidToWinRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {wins.toLocaleString()} of {bids.toLocaleString()}
            </p>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Overall Conversion</p>
            <p className="text-2xl font-bold text-blue-600">
              {overallConversionRate.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {wins.toLocaleString()} of {views.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Insights */}
        <div className="mt-6 p-4 bg-accent/50 rounded-lg">
          <h4 className="font-semibold mb-2">Key Insights</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>
              • {viewToBidRate >= 20 
                ? 'Strong engagement: High view-to-bid conversion' 
                : 'Opportunity: Low view-to-bid conversion suggests need for better targeting'}
            </li>
            <li>
              • {bidToWinRate >= 30 
                ? 'Competitive bidding: Healthy win rate indicates balanced competition' 
                : 'High competition: Low win rate suggests many active bidders'}
            </li>
            <li>
              • Overall conversion of {overallConversionRate.toFixed(1)}% from view to win
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
