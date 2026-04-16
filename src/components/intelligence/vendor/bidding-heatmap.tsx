/**
 * Bidding Heatmap Component
 * Task 14.1.2: Create BiddingHeatmap component with 24x7 grid visualization
 * 
 * Displays optimal bidding times with 24-hour x 7-day heatmap
 */

'use client';

interface TemporalPattern {
  hour: number;
  dayOfWeek: number;
  activityScore: number;
  competitionLevel: 'low' | 'medium' | 'high';
}

interface BiddingHeatmapProps {
  patterns: TemporalPattern[];
  isLoading?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function BiddingHeatmap({ patterns, isLoading }: BiddingHeatmapProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  // Create a map for quick lookup
  const patternMap = new Map<string, TemporalPattern>();
  patterns.forEach(p => {
    patternMap.set(`${p.dayOfWeek}-${p.hour}`, p);
  });

  const getPattern = (day: number, hour: number): TemporalPattern | undefined => {
    return patternMap.get(`${day}-${hour}`);
  };

  const getColor = (pattern?: TemporalPattern) => {
    if (!pattern) return 'bg-gray-100';
    
    const { competitionLevel, activityScore } = pattern;
    
    // Low competition = green (best time to bid)
    if (competitionLevel === 'low') {
      if (activityScore > 70) return 'bg-green-500';
      if (activityScore > 40) return 'bg-green-400';
      return 'bg-green-300';
    }
    
    // Medium competition = yellow
    if (competitionLevel === 'medium') {
      if (activityScore > 70) return 'bg-yellow-500';
      if (activityScore > 40) return 'bg-yellow-400';
      return 'bg-yellow-300';
    }
    
    // High competition = red (avoid)
    if (activityScore > 70) return 'bg-red-500';
    if (activityScore > 40) return 'bg-red-400';
    return 'bg-red-300';
  };

  const getTooltip = (pattern?: TemporalPattern) => {
    if (!pattern) return 'No data';
    
    const competitionText = {
      low: 'Low Competition - Best time to bid',
      medium: 'Medium Competition',
      high: 'High Competition - Avoid if possible',
    };
    
    return `${competitionText[pattern.competitionLevel]}\nActivity: ${pattern.activityScore}%`;
  };

  if (patterns.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <p className="text-gray-600">No temporal pattern data available yet.</p>
        <p className="text-sm text-gray-500 mt-2">Data will appear as more auctions are completed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-gray-700">Low Competition (Best)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-gray-700">Medium Competition</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-gray-700">High Competition (Avoid)</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour labels */}
          <div className="flex">
            <div className="w-12"></div>
            {HOURS.map(hour => (
              <div
                key={hour}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-xs text-gray-600"
              >
                {hour}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex">
              {/* Day label */}
              <div className="w-12 h-8 flex items-center justify-start text-sm font-medium text-gray-700">
                {day}
              </div>

              {/* Hour cells */}
              {HOURS.map(hour => {
                const pattern = getPattern(dayIndex, hour);
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={`flex-shrink-0 w-8 h-8 ${getColor(pattern)} border border-white cursor-pointer hover:opacity-80 transition-opacity`}
                    title={getTooltip(pattern)}
                  ></div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Best Times Summary */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-green-900 mb-2">
          🎯 Best Times to Bid (Low Competition)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {patterns
            .filter(p => p.competitionLevel === 'low')
            .sort((a, b) => b.activityScore - a.activityScore)
            .slice(0, 8)
            .map((pattern, index) => (
              <div
                key={index}
                className="bg-white rounded px-3 py-2 text-center border border-green-200"
              >
                <div className="text-xs text-gray-600">{DAYS[pattern.dayOfWeek]}</div>
                <div className="text-lg font-bold text-green-700">
                  {pattern.hour}:00
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Times to Avoid */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-red-900 mb-2">
          ⚠️ Times to Avoid (High Competition)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {patterns
            .filter(p => p.competitionLevel === 'high')
            .sort((a, b) => b.activityScore - a.activityScore)
            .slice(0, 8)
            .map((pattern, index) => (
              <div
                key={index}
                className="bg-white rounded px-3 py-2 text-center border border-red-200"
              >
                <div className="text-xs text-gray-600">{DAYS[pattern.dayOfWeek]}</div>
                <div className="text-lg font-bold text-red-700">
                  {pattern.hour}:00
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
