/**
 * Auction Status Service
 * 
 * Provides real-time auction status determination based on endTime.
 * Ensures accurate status display across all UI components.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

export type AuctionStatus = 'active' | 'extended' | 'closed' | 'cancelled' | 'forfeited';

export interface AuctionStatusInput {
  status: string;
  endTime: Date | string;
}

export class AuctionStatusService {
  /**
   * Get real-time auction status
   * Checks if auction has expired and returns correct status
   * 
   * @param auction - Auction object with status and endTime
   * @returns Current auction status based on real-time check
   */
  static getAuctionStatus(auction: AuctionStatusInput): AuctionStatus {
    // If auction is already closed/cancelled/forfeited, return as-is
    if (['closed', 'cancelled', 'forfeited'].includes(auction.status)) {
      return auction.status as AuctionStatus;
    }
    
    // Check if auction has expired
    const now = new Date();
    const endTime = typeof auction.endTime === 'string' 
      ? new Date(auction.endTime) 
      : auction.endTime;
    
    if (endTime < now && (auction.status === 'active' || auction.status === 'extended')) {
      return 'closed'; // Expired but not yet processed by cron
    }
    
    return auction.status as AuctionStatus;
  }
  
  /**
   * Check if auction is truly active (not expired)
   * 
   * @param auction - Auction object with status and endTime
   * @returns True if auction is active or extended and not expired
   */
  static isAuctionActive(auction: AuctionStatusInput): boolean {
    const status = this.getAuctionStatus(auction);
    return status === 'active' || status === 'extended';
  }
}
