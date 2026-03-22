'use client';

import { useEffect, useRef } from 'react';
import { TrendingUp } from 'lucide-react';

interface BidData {
  id: string;
  amount: string;
  createdAt: string;
  vendor: {
    businessName: string;
  };
}

interface BidHistoryChartProps {
  bidHistory: BidData[];
  reservePrice?: string | null;
  className?: string;
}

export function BidHistoryChart({ bidHistory, reservePrice, className = '' }: BidHistoryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || bidHistory.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = 40;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Prepare data
    const sortedBids = [...bidHistory].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    if (sortedBids.length === 0) return;

    const amounts = sortedBids.map(bid => parseFloat(bid.amount));
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    const reserve = reservePrice ? parseFloat(reservePrice) : null;

    // Adjust range to include reserve price
    const dataMin = reserve ? Math.min(minAmount, reserve) : minAmount;
    const dataMax = reserve ? Math.max(maxAmount, reserve) : maxAmount;
    const range = dataMax - dataMin;
    const yMin = dataMin - range * 0.1;
    const yMax = dataMax + range * 0.1;

    // Helper functions
    const getX = (index: number) => padding + (index / Math.max(1, sortedBids.length - 1)) * (width - 2 * padding);
    const getY = (amount: number) => height - padding - ((amount - yMin) / (yMax - yMin)) * (height - 2 * padding);

    // Draw grid lines
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding + (i / 5) * (height - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= Math.min(5, sortedBids.length - 1); i++) {
      const x = padding + (i / Math.max(1, Math.min(5, sortedBids.length - 1))) * (width - 2 * padding);
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // Draw reserve price line if available
    if (reserve) {
      const reserveY = getY(reserve);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, reserveY);
      ctx.lineTo(width - padding, reserveY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Reserve price label
      ctx.fillStyle = '#f59e0b';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Reserve: ₦${reserve.toLocaleString()}`, padding + 5, reserveY - 5);
    }

    // Draw bid line
    if (sortedBids.length > 1) {
      ctx.strokeStyle = '#800020';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      sortedBids.forEach((bid, index) => {
        const x = getX(index);
        const y = getY(parseFloat(bid.amount));
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    }

    // Draw bid points
    sortedBids.forEach((bid, index) => {
      const x = getX(index);
      const y = getY(parseFloat(bid.amount));
      
      // Point circle
      ctx.fillStyle = '#800020';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // White border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw Y-axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    
    for (let i = 0; i <= 5; i++) {
      const value = yMin + (i / 5) * (yMax - yMin);
      const y = height - padding - (i / 5) * (height - 2 * padding);
      ctx.fillText(`₦${Math.round(value).toLocaleString()}`, padding - 10, y + 4);
    }

    // Draw X-axis labels (bid numbers)
    ctx.textAlign = 'center';
    const maxLabels = Math.min(6, sortedBids.length);
    for (let i = 0; i < maxLabels; i++) {
      const bidIndex = Math.floor((i / (maxLabels - 1)) * (sortedBids.length - 1));
      const x = getX(bidIndex);
      ctx.fillText(`Bid ${bidIndex + 1}`, x, height - 10);
    }

  }, [bidHistory, reservePrice]);

  if (bidHistory.length === 0) {
    return (
      <div className={`bg-gray-50 rounded-lg p-8 text-center ${className}`}>
        <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No bids to display</p>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">Bid Progression</h4>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#800020] rounded-full"></div>
            <span className="text-gray-600">Bids</span>
          </div>
          {reservePrice && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-1 bg-yellow-500"></div>
              <span className="text-gray-600">Reserve</span>
            </div>
          )}
        </div>
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-64 rounded"
          style={{ width: '100%', height: '256px' }}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="text-gray-500">Total Bids</div>
          <div className="font-bold text-lg">{bidHistory.length}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Highest Bid</div>
          <div className="font-bold text-lg text-[#800020]">
            ₦{Math.max(...bidHistory.map(b => parseFloat(b.amount))).toLocaleString()}
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500">Starting Bid</div>
          <div className="font-bold text-lg">
            ₦{Math.min(...bidHistory.map(b => parseFloat(b.amount))).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}