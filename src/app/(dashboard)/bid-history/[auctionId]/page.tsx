'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/use-auth';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, 
  Clock, 
  TrendingUp, 
  Users, 
  Eye, 
  DollarSign, 
  Calendar,
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
  StopCircle,
  Building,
  User,
  Phone,
  ExternalLink,
  ImageIcon,
  Play,
  Pause
} from 'lucide-react';
import { formatNaira } from '@/lib/utils/currency-formatter';
import { BidHistoryChart } from '@/components/charts/bid-history-chart';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { useToast } from '@/components/ui/toast';
import { UserAvatar } from '@/components/ui/user-avatar';

interface DetailedAuctionData {
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
    voiceNotes?: string[];
    status: string;
    locationName: string;
    gpsLocation?: {
      x: number;
      y: number;
    };
    aiAssessment?: any;
  };
  currentBidder: {
    vendor: {
      id: string;
      businessName: string;
      tier: string;
      profilePictureUrl?: string | null;
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
      profilePictureUrl?: string | null;
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

export default function AuctionDetailPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const auctionId = params.auctionId as string;
  const toast = useToast();
  
  const [data, setData] = useState<DetailedAuctionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [endingAuction, setEndingAuction] = useState(false);
  const [playingVoiceNote, setPlayingVoiceNote] = useState<string | null>(null);
  const [showEndAuctionModal, setShowEndAuctionModal] = useState(false);

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

  // Fetch auction details
  useEffect(() => {
    if (!isAuthenticated || !user || !auctionId) return;
    
    fetchAuctionDetails();
  }, [auctionId, isAuthenticated, user]);

  const fetchAuctionDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/bid-history/${auctionId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Auction not found');
        }
        throw new Error('Failed to fetch auction details');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching auction details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load auction details');
    } finally {
      setLoading(false);
    }
  };
  // Early auction closure (salvage managers only)
  const handleEndAuctionEarly = async () => {
    if (user?.role !== 'salvage_manager') {
      toast.error('Access Denied', 'Only salvage managers can end auctions early');
      return;
    }

    setShowEndAuctionModal(true);
  };

  const confirmEndAuction = async () => {
    try {
      setEndingAuction(true);
      
      const response = await fetch(`/api/auctions/${auctionId}/end-early`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to end auction early');
      }

      // Refresh data
      await fetchAuctionDetails();
      
      setShowEndAuctionModal(false);
      toast.success('Auction Ended Successfully', 'The highest bidder has been declared the winner.');
    } catch (error) {
      console.error('Error ending auction:', error);
      toast.error('Failed to End Auction', 'Please try again or contact support.');
    } finally {
      setEndingAuction(false);
    }
  };

  // Utility functions
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

  const getAssetTitle = (caseData: DetailedAuctionData['case']) => {
    const { assetType, assetDetails } = caseData;
    
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

  const getTierBadge = (tier: string) => {
    const isT2 = tier === 'tier2_full';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
        isT2 ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
      }`}>
        {isT2 && <Award className="w-3 h-3" />}
        {isT2 ? 'Tier 2' : 'Tier 1'}
      </span>
    );
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const playVoiceNote = (url: string) => {
    if (playingVoiceNote === url) {
      // Stop playing
      setPlayingVoiceNote(null);
      // In a real implementation, you'd pause the audio
    } else {
      // Start playing
      setPlayingVoiceNote(url);
      // In a real implementation, you'd play the audio
      const audio = new Audio(url);
      audio.play().catch(console.error);
      audio.onended = () => setPlayingVoiceNote(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#800020] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading auction details...</p>
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {error === 'Auction not found' ? 'Auction Not Found' : 'Error Loading Auction'}
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            href="/bid-history"
            className="px-6 py-2 bg-[#800020] text-white font-semibold rounded-lg hover:bg-[#600018] transition-colors"
          >
            Back to Bid History
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return null; // Still loading, don't show error
  }
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showEndAuctionModal}
        onClose={() => setShowEndAuctionModal(false)}
        onConfirm={confirmEndAuction}
        title="End Auction Early?"
        message="Are you sure you want to end this auction early? This action cannot be undone. The highest bidder will be declared the winner."
        confirmText="End Auction"
        cancelText="Cancel"
        type="danger"
        isLoading={endingAuction}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/bid-history"
              className="p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {getAssetTitle(data.case)}
              </h1>
              <p className="text-gray-600">
                Claim: {data.case.claimReference}
              </p>
            </div>
          </div>

          {/* Status and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                data.auction.status === 'active' ? 'bg-green-100 text-green-800' :
                data.auction.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                data.auction.status === 'extended' ? 'bg-orange-100 text-orange-800' :
                data.auction.status === 'closed' ? 'bg-gray-100 text-gray-800' :
                'bg-red-100 text-red-800'
              }`}>
                {getStatusIcon(data.auction.status)}
                {data.auction.status.charAt(0).toUpperCase() + data.auction.status.slice(1)}
              </span>
              
              {data.auction.status === 'active' && (
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white border border-gray-200">
                  <Timer className="w-4 h-4 text-orange-600" />
                  {getTimeRemaining(data.auction.endTime)} remaining
                </span>
              )}
            </div>

            {/* Early End Button (Salvage Managers Only) */}
            {user?.role === 'salvage_manager' && data.auction.status === 'active' && (
              <button
                onClick={handleEndAuctionEarly}
                disabled={endingAuction}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {endingAuction ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Ending...
                  </>
                ) : (
                  <>
                    <StopCircle className="w-4 h-4" />
                    End Auction Early
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Images and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="relative w-full aspect-[4/3] bg-gray-100">
                {data.case.photos && data.case.photos.length > 0 && data.case.photos[selectedImageIndex] ? (
                  (() => {
                    const photoSrc = data.case.photos[selectedImageIndex];
                    // Check if it's a valid URL (starts with http/https or data:)
                    const isValidUrl = photoSrc.startsWith('http') || photoSrc.startsWith('https') || photoSrc.startsWith('data:');
                    
                    if (isValidUrl) {
                      return (
                        <Image
                          src={photoSrc}
                          alt={getAssetTitle(data.case)}
                          fill
                          className="object-contain"
                          sizes="(max-width: 1024px) 100vw, 66vw"
                        />
                      );
                    } else {
                      // Invalid or relative path - show placeholder
                      return (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500">Invalid image URL</p>
                          </div>
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No images available</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Image Thumbnails */}
              {data.case.photos && data.case.photos.length > 1 && (
                <div className="p-4 border-t border-gray-200">
                  <div className="flex gap-2 overflow-x-auto">
                    {data.case.photos.map((photo, index) => {
                      const isValidUrl = photo.startsWith('http') || photo.startsWith('https') || photo.startsWith('data:');
                      
                      if (!isValidUrl) {
                        return (
                          <button
                            key={index}
                            onClick={() => setSelectedImageIndex(index)}
                            className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors bg-gray-200 flex items-center justify-center ${
                              selectedImageIndex === index ? 'border-[#800020]' : 'border-gray-200'
                            }`}
                          >
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          </button>
                        );
                      }
                      
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                            selectedImageIndex === index ? 'border-[#800020]' : 'border-gray-200'
                          }`}
                        >
                          <Image
                            src={photo}
                            alt={`View ${index + 1}`}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {/* Item Specifications */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Item Specifications</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Asset Type</label>
                    <div className="flex items-center gap-2 mt-1">
                      {getAssetIcon(data.case.assetType)}
                      <span className="font-medium capitalize">{data.case.assetType}</span>
                    </div>
                  </div>
                  
                  {data.case.assetDetails?.make && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Make</label>
                      <p className="font-medium mt-1">{data.case.assetDetails.make}</p>
                    </div>
                  )}
                  
                  {data.case.assetDetails?.model && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Model</label>
                      <p className="font-medium mt-1">{data.case.assetDetails.model}</p>
                    </div>
                  )}
                  
                  {data.case.assetDetails?.year && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Year</label>
                      <p className="font-medium mt-1">{data.case.assetDetails.year}</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Condition</label>
                    <p className={`font-medium mt-1 capitalize ${
                      data.case.damageSeverity === 'severe' ? 'text-red-600' :
                      data.case.damageSeverity === 'moderate' ? 'text-orange-600' :
                      data.case.damageSeverity === 'minor' ? 'text-yellow-600' :
                      'text-green-600'
                    }`}>
                      {data.case.damageSeverity === 'none' ? 'Excellent' : data.case.damageSeverity || 'Unknown'}
                    </p>
                  </div>
                  
                  {data.case.assetDetails?.vin && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">VIN</label>
                      <p className="font-medium mt-1 font-mono text-sm">{data.case.assetDetails.vin}</p>
                    </div>
                  )}
                  
                  {data.case.assetDetails?.serialNumber && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Serial Number</label>
                      <p className="font-medium mt-1 font-mono text-sm">{data.case.assetDetails.serialNumber}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Market Value</label>
                    <p className="font-bold text-lg mt-1">{formatNaira(data.case.marketValue)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Location & Map */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Location</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{data.case.locationName}</span>
                </div>
                
                {data.case.gpsLocation?.y !== undefined && data.case.gpsLocation?.x !== undefined && (
                  <div className="text-sm text-gray-600">
                    Coordinates: {data.case.gpsLocation.y.toFixed(6)}, {data.case.gpsLocation.x.toFixed(6)}
                  </div>
                )}
                
                {/* Google Maps Integration */}
                <div className="relative h-64 bg-gray-200 rounded-lg overflow-hidden">
                  {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !== 'your-google-maps-api-key' ? (
                    <>
                      {data.case.gpsLocation?.y !== undefined && data.case.gpsLocation?.x !== undefined ? (
                        <iframe
                          src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${data.case.gpsLocation.y},${data.case.gpsLocation.x}&zoom=15&maptype=roadmap`}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : (
                        <iframe
                          src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${encodeURIComponent(data.case.locationName)}&zoom=15&maptype=roadmap`}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <div className="text-center">
                        <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 text-sm">Map unavailable</p>
                        <p className="text-gray-500 text-xs">Google Maps API key required</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* External Map Links */}
                <div className="flex gap-4">
                  {data.case.gpsLocation?.y !== undefined && data.case.gpsLocation?.x !== undefined ? (
                    <a
                      href={`https://www.google.com/maps?q=${data.case.gpsLocation.y},${data.case.gpsLocation.x}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[#800020] hover:underline font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Google Maps
                    </a>
                  ) : data.case.locationName ? (
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(data.case.locationName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[#800020] hover:underline font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Search on Google Maps
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
            {/* Voice Notes */}
            {data.case.voiceNotes && data.case.voiceNotes.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Voice Notes
                </h3>
                <div className="space-y-3">
                  {data.case.voiceNotes.map((note, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Auction Info */}
          <div className="space-y-6">
            {/* Auction Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Auction Summary</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Current Bid</div>
                    <div className="text-xl font-bold text-[#800020]">
                      {formatNaira(data.auction.currentBid)}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Reserve Price</div>
                    <div className="text-xl font-bold text-gray-900">
                      {formatNaira(data.case.reservePrice)}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Total Bids</div>
                    <div className="text-xl font-bold text-blue-600">
                      {data.bidHistory.length}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Watching</div>
                    <div className="text-xl font-bold text-green-600">
                      {data.watchingCount}
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Started:</span>
                    <span className="font-medium">{formatDateTime(data.auction.startTime)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Ends:</span>
                    <span className="font-medium">{formatDateTime(data.auction.endTime)}</span>
                  </div>
                  {data.auction.extensionCount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Extensions:</span>
                      <span className="font-medium text-orange-600">{data.auction.extensionCount}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Current Winner/Leader */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {data.auction.status === 'closed' ? 'Winner' : 'Current Leader'}
              </h3>
              
              {data.currentBidder ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <UserAvatar 
                      profilePictureUrl={data.currentBidder.vendor.profilePictureUrl}
                      userName={data.currentBidder.user.fullName}
                      size="lg"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {data.currentBidder.vendor.businessName}
                      </div>
                      <div className="text-sm text-gray-600">
                        {data.currentBidder.user.fullName}
                      </div>
                    </div>
                    {getTierBadge(data.currentBidder.vendor.tier)}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {data.currentBidder.user.fullName}
                        </div>
                        <div className="text-sm text-gray-600">Contact Person</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {data.currentBidder.user.phone}
                        </div>
                        <div className="text-sm text-gray-600">Phone Number</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">KYC Status</div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">
                        {data.currentBidder.vendor.tier === 'tier2_full' ? 'Tier 2 Verified' : 'Tier 1 Verified'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Gavel className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p>No bids placed yet</p>
                </div>
              )}
            </div>
            {/* Payment Status */}
            {data.paymentStatus && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Payment Status</h3>
                <div className={`flex items-center gap-3 p-4 rounded-lg ${
                  data.paymentStatus === 'Payment Completed' 
                    ? 'bg-green-50' 
                    : 'bg-orange-50'
                }`}>
                  {data.paymentStatus === 'Payment Completed' ? (
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                  )}
                  <div>
                    <div className={`font-medium ${
                      data.paymentStatus === 'Payment Completed' 
                        ? 'text-green-900' 
                        : 'text-orange-900'
                    }`}>
                      {data.paymentStatus}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bid History Chart */}
        {data.bidHistory.length > 0 && (
          <div className="mt-8">
            <BidHistoryChart 
              bidHistory={data.bidHistory}
              reservePrice={data.case.reservePrice}
              className="bg-white rounded-xl shadow-lg"
            />
          </div>
        )}

        {/* Complete Bidding Timeline - Mobile Responsive */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Complete Bidding Timeline</h3>
          
          {data.bidHistory.length > 0 ? (
            <div className="space-y-4">
              {data.bidHistory.map((bid, index) => (
                <div key={bid.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-[#800020] rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    {/* Mobile: Stack everything vertically */}
                    <div className="space-y-3">
                      {/* Vendor info with avatar and tier badge */}
                      <div className="flex items-start gap-2 sm:gap-3">
                        <UserAvatar
                          profilePictureUrl={bid.vendor.profilePictureUrl}
                          userName={bid.user.fullName}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                            {bid.vendor.businessName}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600 truncate">
                            {bid.user.fullName}
                          </div>
                        </div>
                      </div>
                      
                      {/* Tier badge - separate line on mobile */}
                      <div className="flex items-center">
                        {getTierBadge(bid.vendor.tier)}
                      </div>
                      
                      {/* Price - separate line on mobile */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="text-lg sm:text-xl font-bold text-[#800020]">
                          {formatNaira(bid.amount)}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600">
                          {formatDateTime(bid.createdAt)}
                        </div>
                      </div>
                      
                      {/* Contact info - no vendor ID */}
                      <div className="text-xs sm:text-sm text-gray-600 truncate">
                        <span>Contact: {bid.user.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Gavel className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Bids Yet</h4>
              <p>This auction hasn't received any bids yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}