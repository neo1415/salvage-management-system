'use client';

/**
 * Payment Unlocked Modal Hook
 * 
 * Manages modal state and logic for PAYMENT_UNLOCKED notifications.
 * 
 * Features:
 * - Checks for unread PAYMENT_UNLOCKED notifications on mount
 * - Fetches payment details from notification data
 * - Manages modal open/close state
 * - Handles localStorage persistence
 * - Marks notification as read when modal is shown
 */

import { useState, useEffect } from 'react';

interface PaymentData {
  paymentId: string;
  auctionId: string;
  assetDescription: string;
  winningBid: number;
  pickupAuthCode: string;
  pickupLocation: string;
  pickupDeadline: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: {
    paymentId?: string;
    auctionId?: string;
    pickupAuthCode?: string;
    pickupLocation?: string;
    pickupDeadline?: string;
  };
  read: boolean;
  createdAt: string;
}

export function usePaymentUnlockedModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkForPaymentUnlockedNotification();
  }, []);

  const checkForPaymentUnlockedNotification = async () => {
    try {
      // Fetch unread PAYMENT_UNLOCKED notifications
      const response = await fetch('/api/notifications?unreadOnly=true&limit=10');
      
      if (!response.ok) {
        console.error('Failed to fetch notifications');
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const notifications: Notification[] = data.data?.notifications || [];

      // Find PAYMENT_UNLOCKED notification
      const paymentUnlockedNotification = notifications.find(
        (n) => n.type === 'PAYMENT_UNLOCKED'
      );

      if (!paymentUnlockedNotification) {
        setIsLoading(false);
        return;
      }

      const notificationData = paymentUnlockedNotification.data;
      const paymentId = notificationData.paymentId;

      if (!paymentId) {
        console.warn('PAYMENT_UNLOCKED notification missing paymentId');
        setIsLoading(false);
        return;
      }

      // Check if payment page has been visited
      const hasVisited = localStorage.getItem(`payment-visited-${paymentId}`);
      if (hasVisited) {
        console.log('Payment page already visited, skipping modal');
        setIsLoading(false);
        return;
      }

      // Check if modal was dismissed
      const dismissedTimestamp = localStorage.getItem(
        `payment-unlocked-modal-${paymentId}-dismissed`
      );
      
      if (dismissedTimestamp) {
        console.log('Modal was previously dismissed, skipping');
        setIsLoading(false);
        return;
      }

      // Fetch payment details
      const paymentResponse = await fetch(`/api/payments/${paymentId}`);
      
      if (!paymentResponse.ok) {
        console.error('Failed to fetch payment details');
        setIsLoading(false);
        return;
      }

      const paymentDataResponse = await paymentResponse.json();
      const payment = paymentDataResponse.data?.payment || paymentDataResponse;

      if (!payment) {
        console.error('Payment not found');
        setIsLoading(false);
        return;
      }

      // Extract asset description from payment or notification
      let assetDescription = 'Salvage Item';
      
      // Try to get from payment data
      if (payment.auction?.case?.assetDetails) {
        const assetDetails = payment.auction.case.assetDetails;
        assetDescription = `${assetDetails.make || ''} ${assetDetails.model || ''} ${assetDetails.year || ''}`.trim() || payment.auction.case.assetType;
      }

      // Prepare modal data
      const modalData: PaymentData = {
        paymentId: payment.id,
        auctionId: notificationData.auctionId || payment.auctionId,
        assetDescription,
        winningBid: parseFloat(payment.amount),
        pickupAuthCode: notificationData.pickupAuthCode || 'N/A',
        pickupLocation: notificationData.pickupLocation || 'NEM Insurance Salvage Yard',
        pickupDeadline: notificationData.pickupDeadline || 'TBD',
      };

      setPaymentData(modalData);
      setIsOpen(true);

      // Mark notification as read
      try {
        await fetch(`/api/notifications/${paymentUnlockedNotification.id}`, {
          method: 'PATCH',
        });
        console.log('Notification marked as read');
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }

    } catch (error) {
      console.error('Error checking for payment unlocked notification:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const closeModal = () => {
    setIsOpen(false);
    
    // Persist dismissal to localStorage
    if (paymentData?.paymentId) {
      try {
        localStorage.setItem(
          `payment-unlocked-modal-${paymentData.paymentId}-dismissed`,
          Date.now().toString()
        );
      } catch (error) {
        console.error('Failed to save modal dismissal:', error);
      }
    }
  };

  return {
    isOpen,
    paymentData,
    isLoading,
    closeModal,
  };
}
