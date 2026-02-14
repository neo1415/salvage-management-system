'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Gavel,
  DollarSign,
  Package,
  Search,
  Filter
} from 'lucide-react';

interface Case {
  id: string;
  claimReference: string;
  assetType: string;
  estimatedValue: string;
  locationName: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  approverName: string | null;
}

type StatusFilter = 'all' | 'draft' | 'pending_approval' | 'approved' | 'cancelled' | 'active_auction' | 'sold';

export default function AdjusterMyCasesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      const userRole = session?.user?.role;
      
      if (userRole !== 'claims_adjuster') {
        router.push('/login');
        return;
      }

      fetchMyCases();
    }
  }, [session, status, router]);

  useEffect(() => {
    filterCases();
  }, [cases, statusFilter, searchQuery]);

  const fetchMyCases = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cases?createdByMe=true');
      
      if (!response.ok) {
        throw new Error('Failed to fetch cases');
      }

      const result = await response.json();
      
      if (result.success) {
        setCases(result.data || []);
      } else {
        console.error('API returned error:', result.error);
        setCases([]);
      }
    } catch (error) {
      console.error('Failed to fetch cases:', error);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const filterCases = () => {
    let filtered = [...cases];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.claimReference.toLowerCase().includes(query) ||
        c.assetType.toLowerCase().includes(query) ||
        c.locationName.toLowerCase().includes(query)
      );
    }

    setFilteredCases(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
      draft: {
        label: 'Draft',
        className: 'bg-gray-100 text-gray-800',
        icon: FileText
      },
      pending_approval: {
        label: 'Pending Approval',
        className: 'bg-yellow-100 text-yellow-800',
        icon: Clock
      },
      approved: {
        label: 'Approved',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle
      },
      cancelled: {
        label: 'Cancelled',
        className: 'bg-red-100 text-red-800',
        icon: XCircle
      },
      active_auction: {
        label: 'Active Auction',
        className: 'bg-blue-100 text-blue-800',
        icon: Gavel
      },
      sold: {
        label: 'Sold',
        className: 'bg-purple-100 text-purple-800',
        icon: Package
      }
    };

    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        <Icon className="w-4 h-4" />
        {config.label}
      </span>
    );
  };

  const getStatusCounts = () => {
    return {
      all: cases.length,
      draft: cases.filter(c => c.status === 'draft').length,
      pending_approval: cases.filter(c => c.status === 'pending_approval').length,
      approved: cases.filter(c => c.status === 'approved').length,
      cancelled: cases.filter(c => c.status === 'cancelled').length,
      active_auction: cases.filter(c => c.status === 'active_auction').length,
      sold: cases.filter(c => c.status === 'sold').length,
    };
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020]"></div>
      </div>
    );
  }

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Cases</h1>
          <p className="text-gray-600 mt-2">View and manage all cases you've created</p>
        </div>
        <Link
          href="/adjuster/cases/new"
          className="px-6 py-3 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors font-medium"
        >
          Create New Case
        </Link>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by claim reference, asset type, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto">
            {[
              { key: 'all', label: 'All Cases', count: statusCounts.all },
              { key: 'draft', label: 'Draft', count: statusCounts.draft },
              { key: 'pending_approval', label: 'Pending', count: statusCounts.pending_approval },
              { key: 'approved', label: 'Approved', count: statusCounts.approved },
              { key: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled },
              { key: 'active_auction', label: 'Active Auction', count: statusCounts.active_auction },
              { key: 'sold', label: 'Sold', count: statusCounts.sold },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as StatusFilter)}
                className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  statusFilter === tab.key
                    ? 'border-[#800020] text-[#800020]'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Cases List */}
        <div className="p-6">
          {filteredCases.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No cases found</h3>
              <p className="text-gray-600 mb-6">
                {statusFilter === 'all' 
                  ? "You haven't created any cases yet."
                  : `No cases with status "${statusFilter.replace('_', ' ')}".`}
              </p>
              {statusFilter === 'all' && (
                <Link
                  href="/adjuster/cases/new"
                  className="inline-flex items-center px-6 py-3 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors font-medium"
                >
                  Create Your First Case
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCases.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/adjuster/cases/${caseItem.id}`}
                  className="block bg-gray-50 rounded-lg p-6 hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {caseItem.claimReference}
                        </h3>
                        {getStatusBadge(caseItem.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div>
                          <p className="text-sm text-gray-600">Asset Type</p>
                          <p className="font-medium text-gray-900">{caseItem.assetType}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Estimated Value</p>
                          <p className="font-medium text-gray-900">
                            ₦{parseFloat(caseItem.estimatedValue).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Location</p>
                          <p className="font-medium text-gray-900">{caseItem.locationName}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
                        <span>Created: {new Date(caseItem.createdAt).toLocaleDateString()}</span>
                        {caseItem.approvedAt && (
                          <span className="text-green-600">
                            Approved: {new Date(caseItem.approvedAt).toLocaleDateString()}
                            {caseItem.approverName && ` by ${caseItem.approverName}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
