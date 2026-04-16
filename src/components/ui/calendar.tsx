'use client';

import * as React from 'react';
import { Button } from './button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarProps {
  mode?: 'single' | 'range';
  selected?: Date | { from: Date; to: Date };
  onSelect?: (date: Date | { from: Date; to: Date } | undefined) => void;
  numberOfMonths?: number;
  initialFocus?: boolean;
}

export function Calendar({
  mode = 'single',
  selected,
  onSelect,
  numberOfMonths = 1,
  initialFocus,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [rangeStart, setRangeStart] = React.useState<Date | null>(null);

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);

    if (mode === 'range') {
      if (!rangeStart) {
        setRangeStart(clickedDate);
      } else {
        const from = rangeStart < clickedDate ? rangeStart : clickedDate;
        const to = rangeStart < clickedDate ? clickedDate : rangeStart;
        onSelect?.({ from, to });
        setRangeStart(null);
      }
    } else {
      onSelect?.(clickedDate);
    }
  };

  const isDateSelected = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    
    if (mode === 'single' && selected instanceof Date) {
      return date.toDateString() === selected.toDateString();
    }
    
    if (mode === 'range' && selected && typeof selected === 'object' && 'from' in selected) {
      const { from, to } = selected;
      return date >= from && date <= to;
    }
    
    return false;
  };

  const renderMonth = (monthOffset: number = 0) => {
    const displayMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset);
    const days = daysInMonth(displayMonth);
    const firstDay = firstDayOfMonth(displayMonth);
    const monthName = displayMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    return (
      <div key={monthOffset} className="p-3">
        <div className="flex items-center justify-between mb-4">
          {monthOffset === 0 && (
            <Button variant="outline" size="sm" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="font-semibold text-sm">{monthName}</div>
          {monthOffset === numberOfMonths - 1 && (
            <Button variant="outline" size="sm" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}

          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: days }).map((_, i) => {
            const day = i + 1;
            const isSelected = isDateSelected(day);

            return (
              <button
                key={day}
                onClick={() => handleDateClick(day)}
                className={cn(
                  'p-2 text-sm rounded-md hover:bg-accent transition-colors',
                  isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-2 bg-white rounded-md border shadow-md">
      {Array.from({ length: numberOfMonths }).map((_, i) => renderMonth(i))}
    </div>
  );
}
