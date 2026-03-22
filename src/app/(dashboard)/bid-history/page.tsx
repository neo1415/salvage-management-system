'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/use-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Clock, 
  TrendingUp, 
  Users, 
  Eye, 
  MapPin,
  Car,
  Home,
  Smartphone,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  Gavel,
  Timer,
  StopCircle
} from 'lucide-react';
import { formatNaira } from '@/lib/utils/currency-formatter';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useToast } from '@/components/ui/toast';

interface BidHistoryItem {
  auction: {
    id: string;
    startTime: string;
    endTime: string;
    originalEndTime: string;
    extensionCount: number;
    currentBid: string | null;
    minimumIncrement: string;
    status: string;
    createdAt: string;
  };
  case: {
    id: string;
    claimReference: string;
    assetType: string;
    assetDetails: any;
    marketValue: string;
    estimatedSalvageValue: string | null;
    reservePrice: string | null;
    damageSeverity: string | null;
    photos: string[];
    status: string;
    locationName: string;
    gpsLocation?: {
      x: number;
      y: number;
    };
  };
  currentBidder: {
    vendor: {
      id: string;
      businessName: string;
      tier: string;
    };
    user: {
      id: string;
      fullName: string;
      phone: string;
    };
  } | null;
  bidHistory: Array<{
    id: string;
    amount: string;
    createdAt: string;
    vendor: {
      id: string;
      businessName: string;
      tier: string;
    };
    user: {
      id: string;
      fullName: string;
      phone: string;
    };
  }>;
  watchingCount: number;
  paymentStatus: string | null;
}

export default function BidHistoryPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [data, setData] = useState<BidHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [endingAuction, setEndingAuction] = useState<string | null>(null);
  const [showEndAuctionModal, setShowEndAuctionModal] = useState(false);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);

  // Auth check
  useEffect(() => {
    if (isLoading) return;
    
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const allowedRoles = ['salvage_manager', 'claims_adjuster', 'system_admin'];
    if (!allowedRoles.includes(user?.role || '')) {
      setError('Access denied. Manager, adjuster, or admin role required.');
      return;
    }
  }, [isAuthenticated, isLoading, user, router]);

  // Fetch data
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    
    fetchBidHistory();
  }, [activeTab, page, isAuthenticated, user]);

  const fetchBidHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/bid-history?tab=${activeTab}&page=${page}&limit=10`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch bid history');
      }
      
      const result = await response.json();
      setData(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      console.error('Error fetching bid history:', err);
      setError('Failed to load bid history');
    } finally {
      setLoading(false);
    }
  };

  // Early auction closure (salvage managers only)
  const handleEndAuctionEarly = async (auctionId: string) => {
    if (user?.role !== 'salvage_manager') {
      toast.error('Access Denied', 'Only salvage managers can end auctions early');
      return;
    }

    setSelectedAuctionId(auctionId);
    setShowEndAuctionModal(true);
  };

  const confirmEndAuction = async () => {
    if (!selectedAuctionId) return;

    try {
      setEndingAuction(selectedAuctionId);
      
      const response = await fetch(`/api/auctions/${selectedAuctionId}/end-early`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to end auction early');
      }

      // Refresh data
      await fetchBidHistory();
      
      setShowEndAuctionModal(false);
      setSelectedAuctionId(null);
      toast.success('Auction Ended Successfully', 'The highest bidder has been declared the winner.');
    } catch (error) {
      console.error('Error ending auction:', error);
      toast.error('Failed to End Auction', 'Please try again or contact support.');
    } finally {
      setEndingAuction(null);
    }
  };

  const getAssetIcon = (assetType: string) => {
    switch (assetType) {
      case 'vehicle':
        return <Car className="w-5 h-5" />;
      case 'property':
        return <Home className="w-5 h-5" />;
      case 'electronics':
        return <Smartphone className="w-5 h-5" />;
      default:
        return <TrendingUp className="w-5 h-5" />;
    }
  };

  const getAssetTitle = (item: BidHistoryItem) => {
    const { assetType, assetDetails } = item.case;
    
    if (assetType === 'vehicle' && assetDetails?.make && assetDetails?.model) {
      return `${assetDetails.year || ''} ${assetDetails.make} ${assetDetails.model}`.trim();
    }
    
    if (assetType === 'electronics' && assetDetails?.brand) {
      return `${assetDetails.brand} ${assetDetails.model || 'Device'}`.trim();
    }
    
    if (assetType === 'property' && assetDetails?.propertyType) {
      return assetDetails.propertyType;
    }
    
    return `${assetType.charAt(0).toUpperCase() + assetType.slice(1)} Asset`;
  };

  const getTimeRemaining = (endTime: string) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'scheduled':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'extended':
        return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'closed':
        return <CheckCircle className="w-4 h-4 text-gray-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bid history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showEndAuctionModal}
        onClose={() => {
          setShowEndAuctionModal(false);
          setSelectedAuctionId(null);
        }}
        onConfirm={confirmEndAuction}
        title="End Auction Early?"
        message="Are you sure you want to end this auction early? This action cannot be undone. The highest bidder will be declared the winner."
        confirmText="End Auction"
        cancelText="Cancel"
        type="danger"
        isLoading={endingAuction === selectedAuctionId}
      />

      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Bid History Management
          </h1>
          <p className="text-gray-600">
            Monitor auction performance and bidding activity
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => {
                  setActiveTab('active');
                  setPage(1);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'active'
                    ? 'border-[#800020] text-[#800020]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Active Auctions
              </button>
              <button
                onClick={() => {
                  setActiveTab('completed');
                  setPage(1);
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'completed'
                    ? 'border-[#800020] text-[#800020]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Completed Auctions
              </button>
            </nav>
          </div>
        </div>

        {/* Auction Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            // Loading skeleton
            Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-6">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ))
          ) : data.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gavel className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No auctions found</h3>
              <p className="text-gray-600">
                {activeTab === 'active' 
                  ? 'There are no active auctions at the moment.'
                  : 'No completed auctions to display.'
                }
              </p>
            </div>
          ) : (
            data.map((item) => (
              <div key={item.auction.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 group">
                {/* Item Image */}
                <div className="relative h-48 bg-gray-100">
                  {item.case.photos && item.case.photos.length > 0 ? (
                    <Image
                      src={item.case.photos[0]}
                      alt={getAssetTitle(item)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      {getAssetIcon(item.case.assetType)}
                      <span className="ml-2 text-gray-500">No Image</span>
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                      item.auction.status === 'active' ? 'bg-green-100 text-green-800' :
                      item.auction.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                      item.auction.status === 'extended' ? 'bg-orange-100 text-orange-800' :
                      item.auction.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {getStatusIcon(item.auction.status)}
                      {item.auction.status.charAt(0).toUpperCase() + item.auction.status.slice(1)}
                    </span>
                  </div>

                  {/* Time Remaining */}
                  {item.auction.status === 'active' && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-800">
                        <Timer className="w-3 h-3" />
                        {getTimeRemaining(item.auction.endTime)}
                      </span>
                    </div>
                  )}

                  {/* Photo Count */}
                  {item.case.photos && item.case.photos.length > 1 && (
                    <div className="absolute bottom-3 right-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-black/50 text-white">
                        <Eye className="w-3 h-3" />
                        {item.case.photos.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-6">
                  {/* Item Title */}
                  <h3 className="text-xl font-bold text-gray-900 mb-1 line-clamp-1">
                    {getAssetTitle(item)}
                  </h3>
                  
                  {/* Claim Reference */}
                  <p className="text-sm text-gray-600 mb-4">
                    Claim: {item.case.claimReference}
                  </p>

                  {/* Key Specs */}
                  <div className="space-y-2 mb-4">
                    {item.case.assetDetails?.year && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Year:</span>
                        <span className="font-medium">{item.case.assetDetails.year}</span>
                      </div>
                    )}
                    {item.case.damageSeverity && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Condition:</span>
                        <span className={`font-medium capitalize ${
                          item.case.damageSeverity === 'severe' ? 'text-red-600' :
                          item.case.damageSeverity === 'moderate' ? 'text-orange-600' :
                          item.case.damageSeverity === 'minor' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {item.case.damageSeverity === 'none' ? 'Excellent' : item.case.damageSeverity}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <MapPin className="w-4 h-4" />
                    <span className="truncate">{item.case.locationName}</span>
                  </div>

                  {/* Bidding Info */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Current Bid</div>
                      <div className="text-lg font-bold text-[#800020]">
                        {formatNaira(item.auction.currentBid)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Reserve</div>
                      <div className="text-lg font-bold text-gray-900">
                        {formatNaira(item.case.reservePrice)}
                      </div>
                    </div>
                  </div>

                  {/* Bid Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{item.bidHistory.length} bids</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{item.watchingCount} watching</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Link
                      href={`/bid-history/${item.auction.id}`}
                      className="flex-1 bg-[#800020] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#600018] transition-colors text-center"
                    >
                      View Details
                    </Link>
                    
                    {/* Early End Button (Salvage Managers Only) */}
                    {user?.role === 'salvage_manager' && item.auction.status === 'active' && (
                      <button
                        onClick={() => handleEndAuctionEarly(item.auction.id)}
                        disabled={endingAuction === item.auction.id}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="End auction early"
                      >
                        {endingAuction === item.auction.id ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <StopCircle className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}