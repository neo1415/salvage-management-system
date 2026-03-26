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
  MapPin,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { formatCompactCurrency, formatRelativeDate } from '@/utils/format-utils';
import { AuctionStatusService } from '@/features/auctions/services/status.service';
import { getAllDrafts, type DraftCase, getAllOfflineCases, type OfflineCase } from '@/lib/db/indexeddb';
import { useOffline } from '@/hooks/use-offline';

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
  // Auction data for real-time status checking
  auctionId: string | null;
  auctionStatus: string | null;
  auctionEndTime: string | null;
}

type StatusFilter = 'all' | 'draft' | 'pending_approval' | 'approved' | 'cancelled' | 'active_auction' | 'sold';

export default function AdjusterMyCasesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isOffline = useOffline();
  const [cases, setCases] = useState<Case[]>([]);
  const [drafts, setDrafts] = useState<DraftCase[]>([]);
  const [offlineCases, setOfflineCases] = useState<OfflineCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Export states
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router]); // Removed fetchMyCases from dependencies to prevent infinite loop

  useEffect(() => {
    filterCases();
  }, [cases, statusFilter, searchQuery]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showExportMenu && !target.closest('.export-menu-container')) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showExportMenu]);

  const fetchMyCases = async () => {
    try {
      setLoading(true);
      
      // Always load drafts and offline cases from IndexedDB
      try {
        const localDrafts = await getAllDrafts();
        setDrafts(localDrafts);
        
        const localOfflineCases = await getAllOfflineCases();
        setOfflineCases(localOfflineCases);
      } catch (error) {
        console.error('Failed to load local data from IndexedDB:', error);
        setDrafts([]);
        setOfflineCases([]);
      }
      
      // Only fetch from API when online
      if (!isOffline) {
        // Add timestamp to bust cache
        const timestamp = Date.now();
        const response = await fetch(`/api/cases?createdByMe=true&_t=${timestamp}`);
        
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
      } else {
        // When offline, only show local data
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
    // Combine online cases and offline cases
    let filtered = [...cases];
    
    // Add offline cases that match the filter
    const offlineCasesAsRegular = offlineCases.map(oc => ({
      id: oc.id,
      claimReference: oc.claimReference,
      assetType: oc.assetType,
      estimatedValue: oc.marketValue.toString(),
      locationName: oc.locationName,
      status: oc.status,
      createdAt: oc.createdAt.toString(),
      approvedAt: null,
      approvedBy: null,
      approverName: null,
      auctionId: null,
      auctionStatus: null,
      auctionEndTime: null,
    }));
    
    filtered = [...filtered, ...offlineCasesAsRegular];

    // Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'draft') {
        // Draft filter will show drafts from IndexedDB (handled separately in render)
        filtered = [];
      } else if (statusFilter === 'approved') {
        // Approved filter shows all cases with approvedBy field
        filtered = filtered.filter(c => c.approvedBy !== null && c.approvedBy !== undefined);
      } else {
        filtered = filtered.filter(c => c.status === statusFilter);
      }
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

  const getStatusBadge = (caseItem: Case) => {
    // Use AuctionStatusService for real-time status if case has an auction
    let displayStatus = caseItem.status;
    
    if (caseItem.auctionId && caseItem.auctionStatus && caseItem.auctionEndTime) {
      const realTimeStatus = AuctionStatusService.getAuctionStatus({
        status: caseItem.auctionStatus,
        endTime: new Date(caseItem.auctionEndTime),
      });
      
      // If auction is closed but case status is still active_auction, show closed
      if (realTimeStatus === 'closed' && caseItem.status === 'active_auction') {
        displayStatus = 'closed_auction';
      }
    }
    
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
      closed_auction: {
        label: 'Auction Closed',
        className: 'bg-gray-100 text-gray-800',
        icon: Gavel
      },
      sold: {
        label: 'Sold',
        className: 'bg-purple-100 text-purple-800',
        icon: Package
      }
    };

    const config = statusConfig[displayStatus] || statusConfig.draft;
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
      all: cases.length + offlineCases.length,
      draft: drafts.length, // Count drafts from IndexedDB
      pending_approval: cases.filter(c => c.status === 'pending_approval').length + offlineCases.filter(c => c.status === 'pending_approval').length,
      // Approved includes cases with approvedBy field (active_auction, sold, etc.)
      approved: cases.filter(c => c.approvedBy !== null && c.approvedBy !== undefined).length,
      cancelled: cases.filter(c => c.status === 'cancelled').length,
      active_auction: cases.filter(c => c.status === 'active_auction').length,
      sold: cases.filter(c => c.status === 'sold').length,
    };
  };

  const handleExportCSV = () => {
    try {
      setExporting(true);
      
      // Use filtered cases for export (respects status filters and search)
      const exportData = filteredCases.map(caseItem => ({
        claimReference: caseItem.claimReference,
        assetType: caseItem.assetType,
        status: caseItem.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        createdDate: new Date(caseItem.createdAt).toLocaleDateString('en-NG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        marketValue: `₦${parseFloat(caseItem.estimatedValue).toLocaleString()}`,
        reservePrice: `₦${(parseFloat(caseItem.estimatedValue) * 0.7).toLocaleString()}`, // Assuming 70% reserve
        location: caseItem.locationName,
        damageSeverity: 'N/A' // Not available in current data model
      }));

      // Generate CSV content
      const headers = ['Claim Reference', 'Asset Type', 'Status', 'Created Date', 'Market Value', 'Reserve Price', 'Location', 'Damage Severity'];
      const csvRows = [headers.join(',')];
      
      exportData.forEach(row => {
        const values = [
          escapeCSVField(row.claimReference),
          escapeCSVField(row.assetType),
          escapeCSVField(row.status),
          escapeCSVField(row.createdDate),
          escapeCSVField(row.marketValue),
          escapeCSVField(row.reservePrice),
          escapeCSVField(row.location),
          escapeCSVField(row.damageSeverity)
        ];
        csvRows.push(values.join(','));
      });

      const csvContent = csvRows.join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split('T')[0];
      
      link.setAttribute('href', url);
      link.setAttribute('download', `my-cases-${date}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert(`Successfully exported ${filteredCases.length} case records to CSV`);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      alert('Failed to generate CSV export. Please try again.');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      
      // Use filtered cases for export (respects status filters and search)
      const exportData = filteredCases.map(caseItem => ({
        claimRef: caseItem.claimReference.substring(0, 15),
        assetType: caseItem.assetType.substring(0, 12),
        status: caseItem.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).substring(0, 12),
        createdDate: new Date(caseItem.createdAt).toLocaleDateString('en-NG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        marketValue: `₦${parseFloat(caseItem.estimatedValue).toLocaleString()}`,
        location: caseItem.locationName.substring(0, 15)
      }));

      // Dynamically import jsPDF and services
      const { jsPDF } = await import('jspdf');
      const { PDFTemplateService } = await import('@/features/documents/services/pdf-template.service');
      
      const doc = new jsPDF();
      
      // Add letterhead
      await PDFTemplateService.addLetterhead(doc, 'MY CASES REPORT');
      
      // Add table data
      let y = 65; // Start below letterhead
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxY = PDFTemplateService.getMaxContentY(doc);
      
      // Add headers
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Claim Ref', 15, y);
      doc.text('Asset Type', 50, y);
      doc.text('Status', 85, y);
      doc.text('Created', 115, y);
      doc.text('Value', 145, y);
      doc.text('Location', 170, y);
      
      y += 5;
      doc.setFont('helvetica', 'normal');
      
      // Add data rows
      for (const item of exportData) {
        if (y > maxY) {
          // Add footer to current page
          PDFTemplateService.addFooter(doc);
          // Start new page
          doc.addPage();
          await PDFTemplateService.addLetterhead(doc, 'MY CASES REPORT');
          y = 65;
          
          // Re-add headers on new page
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('Claim Ref', 15, y);
          doc.text('Asset Type', 50, y);
          doc.text('Status', 85, y);
          doc.text('Created', 115, y);
          doc.text('Value', 145, y);
          doc.text('Location', 170, y);
          y += 5;
          doc.setFont('helvetica', 'normal');
        }
        
        doc.text(item.claimRef, 15, y);
        doc.text(item.assetType, 50, y);
        doc.text(item.status, 85, y);
        doc.text(item.createdDate, 115, y);
        doc.text(item.marketValue, 145, y);
        doc.text(item.location, 170, y);
        y += 5;
      }
      
      // Add footer to last page
      PDFTemplateService.addFooter(doc, `Total Records: ${filteredCases.length}`);
      
      // Download PDF
      const date = new Date().toISOString().split('T')[0];
      doc.save(`my-cases-${date}.pdf`);
      
      alert(`Successfully exported ${filteredCases.length} case records to PDF`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to generate PDF export. Please try again.');
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  };

  const escapeCSVField = (field: string): string => {
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
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
        <div className="flex items-center gap-3">
          {/* Export Dropdown */}
          <div className="relative export-menu-container">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowExportMenu(!showExportMenu);
              }}
              disabled={loading || filteredCases.length === 0}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleExportCSV();
                  }}
                  disabled={exporting}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Export as CSV</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleExportPDF();
                  }}
                  disabled={exporting}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3 border-t border-gray-100 disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Export as PDF</span>
                </button>
              </div>
            )}
          </div>
          
          <Link
            href="/adjuster/cases/new"
            className="px-6 py-3 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors font-medium"
          >
            Create New Case
          </Link>
        </div>
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
          {statusFilter === 'draft' ? (
            // Show drafts from IndexedDB
            drafts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No drafts found</h3>
                <p className="text-gray-600 mb-6">
                  Drafts are auto-saved as you work on the case creation form.
                </p>
                <Link
                  href="/adjuster/cases/new"
                  className="inline-flex items-center px-6 py-3 bg-[#800020] text-white rounded-lg hover:bg-[#600018] transition-colors font-medium"
                >
                  Create New Case
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <DraftCard key={draft.id} draft={draft} onDelete={fetchMyCases} />
                ))}
              </div>
            )
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery ? `No results found for "${searchQuery}"` : 'No cases found'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery 
                  ? 'Try adjusting your search query or filters.'
                  : statusFilter === 'all' 
                    ? "You haven't created any cases yet."
                    : `No cases with status "${statusFilter.replace('_', ' ')}".`}
              </p>
              {statusFilter === 'all' && !searchQuery && (
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
              {isOffline && offlineCases.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">
                      You're offline. Showing {offlineCases.length} case{offlineCases.length !== 1 ? 's' : ''} pending sync.
                    </span>
                  </div>
                </div>
              )}
              {filteredCases.map((caseItem) => {
                const isOfflineCase = offlineCases.some(oc => oc.id === caseItem.id);
                return (
                  <CaseCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    onDelete={caseItem.status === 'draft' ? fetchMyCases : undefined}
                    getStatusBadge={getStatusBadge}
                    isOfflineCase={isOfflineCase}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Draft Card Component for IndexedDB drafts
interface DraftCardProps {
  draft: DraftCase;
  onDelete: () => void;
}

function DraftCard({ draft, onDelete }: DraftCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleResume = () => {
    router.push(`/adjuster/cases/new?draftId=${draft.id}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm('Delete this draft? This cannot be undone.')) {
      setIsDeleting(true);
      try {
        const { deleteDraft } = await import('@/lib/db/indexeddb');
        await deleteDraft(draft.id);
        onDelete();
      } catch (error) {
        console.error('Error deleting draft:', error);
        alert('Error deleting draft');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const claimReference = draft.formData.claimReference as string;
  const assetType = draft.formData.assetType as string;
  const photos = (draft.formData.photos as string[]) || [];

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 flex-1">
          {claimReference || 'Untitled Draft'}
        </h3>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
          <FileText className="w-4 h-4" />
          Draft
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {assetType && (
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Asset</p>
              <p className="font-medium text-gray-900 truncate capitalize">{assetType}</p>
            </div>
          </div>
        )}

        {draft.marketValue && draft.marketValue > 0 && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Value</p>
              <p className="font-medium text-[#800020]">
                {formatCompactCurrency(draft.marketValue.toString())}
              </p>
            </div>
          </div>
        )}

        {photos.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 text-gray-400 flex-shrink-0">📷</div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Photos</p>
              <p className="font-medium text-gray-900">{photos.length} uploaded</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Last saved</p>
            <p className="font-medium text-gray-900">
              {formatRelativeDate(draft.autoSavedAt.toString())}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={handleResume}
          className="flex-1 px-4 py-2 bg-[#800020] text-white text-sm font-medium rounded-lg hover:bg-[#600018] transition-colors"
        >
          Resume Editing
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="px-4 py-2 bg-white border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// Compact Case Card Component with max 5 fields and expandable sections
interface CaseCardProps {
  caseItem: Case;
  onDelete?: () => void;
  getStatusBadge: (caseItem: Case) => JSX.Element;
  isOfflineCase?: boolean;
}

function CaseCard({ caseItem, onDelete, getStatusBadge, isOfflineCase = false }: CaseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm('Delete this draft case? This cannot be undone.')) {
      try {
        const response = await fetch(`/api/cases/${caseItem.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          alert('Draft deleted successfully');
          onDelete?.();
        } else {
          const data = await response.json();
          alert(data.error || 'Failed to delete case');
        }
      } catch (error) {
        console.error('Error deleting case:', error);
        alert('Error deleting case');
      }
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
      <Link
        href={`/adjuster/cases/${caseItem.id}`}
        className="block p-4"
      >
        {/* Header: Claim Reference + Status Badge */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 flex-1">
            {caseItem.claimReference}
          </h3>
          <div className="flex items-center gap-2">
            {isOfflineCase && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Pending Sync
              </span>
            )}
            {getStatusBadge(caseItem)}
          </div>
        </div>

        {/* Core Fields (Max 5) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {/* Field 1: Asset Type with icon */}
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Asset</p>
              <p className="font-medium text-gray-900 truncate">{caseItem.assetType}</p>
            </div>
          </div>

          {/* Field 2: Value with compact format */}
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Value</p>
              <p className="font-medium text-[#800020]">
                {formatCompactCurrency(caseItem.estimatedValue)}
              </p>
            </div>
          </div>

          {/* Field 3: Location with icon */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Location</p>
              <p className="font-medium text-gray-900 truncate">{caseItem.locationName}</p>
            </div>
          </div>

          {/* Field 4: Created date with relative format */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Created</p>
              <p className="font-medium text-gray-900">
                {formatRelativeDate(caseItem.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Expandable Section for Optional Details */}
        {(caseItem.approvedAt || caseItem.status === 'draft') && (
          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors w-full"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{isExpanded ? 'Hide' : 'Show'} details</span>
            </button>

            {isExpanded && (
              <div className="mt-3 space-y-2 text-sm">
                {caseItem.approvedAt && (
                  <div className="flex items-start gap-2 text-green-600">
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-medium">
                        Approved {formatRelativeDate(caseItem.approvedAt)}
                      </p>
                      {caseItem.approverName && (
                        <p className="text-xs text-gray-600">by {caseItem.approverName}</p>
                      )}
                    </div>
                  </div>
                )}

                {caseItem.status === 'draft' && onDelete && (
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors w-full"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    <span>Delete draft</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </Link>
    </div>
  );
}
