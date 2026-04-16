'use client';

/**
 * Asset Performance Matrix Component
 * 
 * Table displaying asset performance by make/model/year with sorting and export
 * Task: 11.3.2 - Implement Asset Performance Matrix table with sorting/export
 */

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';

interface AssetPerformance {
  assetType?: string;
  make: string;
  model: string;
  year: number;
  avgPrice: number | string;
  sellThroughRate: number | string;
  totalAuctions: number | string;
  avgDaysToSell: number | string;
  demandScore: number | string;
}

interface AssetPerformanceMatrixProps {
  data: AssetPerformance[];
  loading?: boolean;
}

type SortField = 'make' | 'model' | 'year' | 'avgPrice' | 'sellThroughRate' | 'totalAuctions';
type SortDirection = 'asc' | 'desc';

// Helper function to format asset name based on type
function formatAssetName(item: AssetPerformance): string {
  const { assetType, make, model, year } = item;
  
  if (assetType === 'vehicle') {
    // Vehicles: "Toyota Camry 2020"
    return `${make || ''} ${model || ''} ${year || ''}`.trim();
  } else if (assetType === 'electronics') {
    // Electronics: "Apple iPhone 12 Pro" (brand + model, no year)
    return `${make || ''} ${model || ''}`.trim();
  } else if (assetType === 'machinery') {
    // Machinery: "CAT D9T" (brand + model, no year)
    return `${make || ''} ${model || ''}`.trim();
  }
  
  // Fallback: show all available info
  return `${make || ''} ${model || ''} ${year || ''}`.trim();
}

export function AssetPerformanceMatrix({ data, loading }: AssetPerformanceMatrixProps) {
  const [sortField, setSortField] = useState<SortField>('totalAuctions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      // Convert to numbers if needed
      if (sortField !== 'make' && sortField !== 'model') {
        aValue = Number(aValue || 0);
        bValue = Number(bValue || 0);
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
    
    return sorted;
  }, [data, sortField, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const exportToCSV = () => {
    const headers = ['Make', 'Model', 'Year', 'Avg Price (₦)', 'Sell-Through Rate (%)', 'Total Auctions', 'Avg Days to Sell', 'Demand Score'];
    const rows = sortedData.map(item => [
      item.make,
      item.model,
      item.year,
      Number(item.avgPrice || 0).toFixed(2),
      Number(item.sellThroughRate || 0).toFixed(1),
      Number(item.totalAuctions || 0),
      Number(item.avgDaysToSell || 0).toFixed(1),
      Number(item.demandScore || 0).toFixed(1),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asset-performance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  if (loading) {
    return <div className="text-center py-8">Loading asset performance data...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No asset performance data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Showing {paginatedData.length} of {sortedData.length} assets
        </div>
        <Button onClick={exportToCSV} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('make')} className="font-semibold">
                  Asset Name
                  <SortIcon field="make" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" onClick={() => handleSort('avgPrice')} className="font-semibold">
                  Avg Price
                  <SortIcon field="avgPrice" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" onClick={() => handleSort('sellThroughRate')} className="font-semibold">
                  Sell-Through
                  <SortIcon field="sellThroughRate" />
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" onClick={() => handleSort('totalAuctions')} className="font-semibold">
                  Total Auctions
                  <SortIcon field="totalAuctions" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((item, index) => {
              const avgPrice = Number(item.avgPrice || 0);
              const sellThroughRate = Number(item.sellThroughRate || 0);
              const totalAuctions = Number(item.totalAuctions || 0);
              const assetName = formatAssetName(item);
              
              return (
                <TableRow key={`${item.make}-${item.model}-${item.year}-${index}`}>
                  <TableCell className="font-medium">{assetName}</TableCell>
                  <TableCell className="text-right">
                    ₦{avgPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge 
                      variant={sellThroughRate >= 70 ? 'default' : sellThroughRate >= 50 ? 'secondary' : 'outline'}
                      className={sellThroughRate >= 70 ? 'bg-green-600' : ''}
                    >
                      {sellThroughRate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{totalAuctions}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
