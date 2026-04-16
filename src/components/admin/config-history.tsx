'use client';

import { useState, useEffect } from 'react';
import { History, Filter, Calendar, User, ArrowRight } from 'lucide-react';

interface ConfigChange {
  id: string;
  parameter: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedByName?: string;
  reason?: string;
  createdAt: string;
}

interface ConfigHistoryProps {
  className?: string;
}

export function ConfigHistory({ className = '' }: ConfigHistoryProps) {
  const [history, setHistory] = useState<ConfigChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    parameter: '',
    startDate: '',
    endDate: '',
    changedBy: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  useEffect(() => {
    fetchHistory();
  }, [page, filters]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.parameter && { parameter: filters.parameter }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.changedBy && { changedBy: filters.changedBy }),
      });

      const response = await fetch(`/api/admin/config/history?${params}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history);
        setTotalPages(Math.ceil(data.count / limit));
      }
    } catch (error) {
      console.error('Failed to fetch config history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      parameter: '',
      startDate: '',
      endDate: '',
      changedBy: '',
    });
    setPage(1);
  };

  const formatParameterName = (param: string) => {
    return param
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading && page === 1) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#800020] rounded-full flex items-center justify-center">
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Configuration History</h2>
            <p className="text-sm text-gray-600 mt-1">
              Audit trail of all configuration changes
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-semibold text-gray-700">Filters</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Parameter
            </label>
            <input
              type="text"
              value={filters.parameter}
              onChange={(e) => handleFilterChange('parameter', e.target.value)}
              placeholder="e.g., deposit_rate"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="p-6">
        {history.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No configuration changes found</p>
            <p className="text-sm text-gray-400 mt-1">
              Configuration change history will appear here
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {history.map((change) => (
                <div
                  key={change.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {formatParameterName(change.parameter)}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="w-3 h-3 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {change.changedByName || change.changedBy}
                        </span>
                        <span className="text-gray-300">•</span>
                        <Calendar className="w-3 h-3 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {new Date(change.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs text-red-700 font-medium mb-1">Old Value</p>
                      <p className="text-sm font-semibold text-red-900">{change.oldValue}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-xs text-green-700 font-medium mb-1">New Value</p>
                      <p className="text-sm font-semibold text-green-900">{change.newValue}</p>
                    </div>
                  </div>

                  {change.reason && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs text-blue-700 font-medium mb-1">Reason</p>
                      <p className="text-sm text-blue-900">{change.reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#800020] rounded-lg hover:bg-[#600018] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
