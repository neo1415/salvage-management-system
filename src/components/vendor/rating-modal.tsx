'use client';

import { useState } from 'react';
import { X, Star } from 'lucide-react';

/**
 * Category ratings for vendor performance
 */
interface CategoryRatings {
  paymentSpeed: number;
  communication: number;
  pickupPunctuality: number;
}

/**
 * Props for the RatingModal component
 */
interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  vendorName: string;
  auctionId: string;
  onSubmit: (data: {
    overallRating: number;
    categoryRatings: CategoryRatings;
    review?: string;
  }) => Promise<void>;
}

/**
 * Star Rating Input Component
 */
interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  label: string;
  disabled?: boolean;
}

function StarRating({ rating, onRatingChange, label, disabled = false }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onRatingChange(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className={`transition-all ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110'}`}
            aria-label={`Rate ${star} stars`}
          >
            <Star
              className={`w-8 h-8 ${
                star <= (hoverRating || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-none text-gray-300'
              }`}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-600">
          {rating > 0 ? `${rating} star${rating !== 1 ? 's' : ''}` : 'Not rated'}
        </span>
      </div>
    </div>
  );
}

/**
 * Vendor Rating Modal Component
 * 
 * Displays after pickup confirmation to collect vendor ratings.
 * Includes:
 * - 5-star overall rating
 * - Category ratings (payment speed, communication, pickup punctuality)
 * - Optional text review (max 500 characters)
 * 
 * Requirements: 37, NFR5.3
 * 
 * @example
 * ```tsx
 * <RatingModal
 *   isOpen={showRating}
 *   onClose={() => setShowRating(false)}
 *   vendorId="vendor-123"
 *   vendorName="John's Auto Parts"
 *   auctionId="auction-456"
 *   onSubmit={handleRatingSubmit}
 * />
 * ```
 */
export function RatingModal({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  auctionId,
  onSubmit,
}: RatingModalProps) {
  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<CategoryRatings>({
    paymentSpeed: 0,
    communication: 0,
    pickupPunctuality: 0,
  });
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Don't render if not open
  if (!isOpen) return null;

  const handleCategoryRatingChange = (category: keyof CategoryRatings, rating: number) => {
    setCategoryRatings((prev) => ({
      ...prev,
      [category]: rating,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate overall rating
    if (overallRating === 0) {
      setError('Please provide an overall rating');
      return;
    }

    // Validate category ratings
    if (
      categoryRatings.paymentSpeed === 0 ||
      categoryRatings.communication === 0 ||
      categoryRatings.pickupPunctuality === 0
    ) {
      setError('Please rate all categories');
      return;
    }

    // Validate review length
    if (review.length > 500) {
      setError('Review must be 500 characters or less');
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        overallRating,
        categoryRatings,
        review: review.trim() || undefined,
      });

      // Reset form and close modal on success
      setOverallRating(0);
      setCategoryRatings({
        paymentSpeed: 0,
        communication: 0,
        pickupPunctuality: 0,
      });
      setReview('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Rate Vendor</h2>
            <p className="text-sm text-gray-600 mt-1">{vendorName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Overall Rating */}
          <div className="pb-6 border-b border-gray-200">
            <StarRating
              rating={overallRating}
              onRatingChange={setOverallRating}
              label="Overall Rating *"
              disabled={isSubmitting}
            />
          </div>

          {/* Category Ratings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Rate by Category *</h3>

            <StarRating
              rating={categoryRatings.paymentSpeed}
              onRatingChange={(rating) => handleCategoryRatingChange('paymentSpeed', rating)}
              label="Payment Speed"
              disabled={isSubmitting}
            />

            <StarRating
              rating={categoryRatings.communication}
              onRatingChange={(rating) => handleCategoryRatingChange('communication', rating)}
              label="Communication"
              disabled={isSubmitting}
            />

            <StarRating
              rating={categoryRatings.pickupPunctuality}
              onRatingChange={(rating) => handleCategoryRatingChange('pickupPunctuality', rating)}
              label="Pickup Punctuality"
              disabled={isSubmitting}
            />
          </div>

          {/* Optional Review */}
          <div className="space-y-2">
            <label htmlFor="review" className="block text-sm font-medium text-gray-700">
              Review (Optional)
            </label>
            <textarea
              id="review"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              disabled={isSubmitting}
              maxLength={500}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-burgundy-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Share your experience with this vendor (optional, max 500 characters)"
            />
            <p className="text-xs text-gray-500 text-right">
              {review.length}/500 characters
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-burgundy-900 text-white font-semibold rounded-lg hover:bg-burgundy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
