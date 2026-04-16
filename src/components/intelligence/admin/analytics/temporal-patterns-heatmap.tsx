'use client';

/**
 * Temporal Patterns Heatmap Component
 * 
 * 24x7 heatmap showing bidding activity by hour and day of week
 * Task: 11.3.4 - Implement Temporal Patterns heatmaps
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TemporalPattern {
  hour: number;
  dayOfWeek: number;
  activityScore: number | string;
  avgBids: number | string;
  avgPrice: number | string;
  totalAuctions: number | string;
}

interface TemporalPatternsHeatmapProps {
  data: TemporalPattern[];
  loading?: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TemporalPatternsHeatmap({ data, loading }: TemporalPatternsHeatmapProps) {
  
  if (loading) {
    return <div className="text-center py-8">Loading temporal patterns...</div>;
  }

  // Create a map for quick lookup
  const dataMap = new Map<string, TemporalPattern>();
  data.forEach(item => {
    const key = `${item.dayOfWeek}-${item.hour}`;
    dataMap.set(key, item);
  });

  // Find min and max activity scores for color scaling
  const activityScores = data.map(d => Number(d.activityScore || 0));
  const minScore = Math.min(...activityScores);
  const maxScore = Math.max(...activityScores);

  const getColorIntensity = (score: number): string => {
    if (score === 0) return 'bg-gray-100';
    
    const normalized = (score - minScore) / (maxScore - minScore);
    
    if (normalized >= 0.8) return 'bg-[#800020]'; // Brand color - highest activity
    if (normalized >= 0.6) return 'bg-red-600';
    if (normalized >= 0.4) return 'bg-orange-500';
    if (normalized >= 0.2) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Temporal Activity Patterns</CardTitle>
          <CardDescription>No temporal pattern data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Temporal Activity Patterns</CardTitle>
        <CardDescription>
          Bidding activity by hour and day of week (darker = higher activity)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <TooltipProvider>
            <div className="inline-block min-w-full">
              {/* Hour labels */}
              <div className="flex mb-2">
                <div className="w-24 flex-shrink-0" /> {/* Spacer for day labels */}
                {HOURS.map(hour => (
                  <div 
                    key={hour} 
                    className="flex-1 text-xs text-center text-muted-foreground min-w-[32px]"
                  >
                    {hour % 4 === 0 ? formatHour(hour) : ''}
                  </div>
                ))}
              </div>

              {/* Heatmap grid */}
              {DAYS.map((day, dayIndex) => (
                <div key={day} className="flex items-center mb-1">
                  <div className="w-24 flex-shrink-0 text-sm font-medium pr-2 text-right">
                    {day}
                  </div>
                  {HOURS.map(hour => {
                    const key = `${dayIndex}-${hour}`;
                    const cellData = dataMap.get(key);
                    const activityScore = Number(cellData?.activityScore || 0);
                    const colorClass = getColorIntensity(activityScore);

                    return (
                      <UITooltip key={hour}>
                        <TooltipTrigger asChild>
                          <div
                            className={`flex-1 h-8 min-w-[32px] border border-gray-200 cursor-pointer transition-all hover:scale-110 hover:z-10 ${colorClass}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <p className="font-semibold">{day}, {formatHour(hour)}</p>
                            {cellData ? (
                              <>
                                <p className="text-muted-foreground">
                                  Activity Score: {Number(cellData.activityScore || 0).toFixed(1)}
                                </p>
                                <p className="text-muted-foreground">
                                  Avg Bids: {Number(cellData.avgBids || 0).toFixed(1)}
                                </p>
                                <p className="text-muted-foreground">
                                  Avg Price: ₦{Number(cellData.avgPrice || 0).toLocaleString()}
                                </p>
                                <p className="text-muted-foreground">
                                  {Number(cellData.totalAuctions || 0)} auctions
                                </p>
                              </>
                            ) : (
                              <p className="text-muted-foreground">No activity</p>
                            )}
                          </div>
                        </TooltipContent>
                      </UITooltip>
                    );
                  })}
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
                <span className="text-sm text-muted-foreground">Activity Level:</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-500 border" />
                  <span className="text-xs">Low</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-yellow-500 border" />
                  <span className="text-xs">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-orange-500 border" />
                  <span className="text-xs">High</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[#800020] border" />
                  <span className="text-xs">Peak</span>
                </div>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}
