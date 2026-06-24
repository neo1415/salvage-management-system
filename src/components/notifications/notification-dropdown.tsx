'use client';

/**
 * Notification Dropdown Component
 * 
 * Dropdown showing latest 3-4 notifications with "View All" link.
 * Displays notification items with icons, titles, messages, and timestamps.
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import { useEffect, useRef } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import NotificationItem from '@/components/notifications/notification-item';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  createdAt: string;
}

interface NotificationDropdownProps {
  notifications: Notification[];
  isLoading: boolean;
  onClose: () => void;
  onNotificationRead: () => void;
  onMarkAllRead: () => void;
  onNotificationUpdated: (notificationId: string) => void;
}

export default function NotificationDropdown({
  notifications,
  isLoading,
  onClose,
  onNotificationRead,
  onMarkAllRead,
  onNotificationUpdated,
}: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useAppRouter();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
        });
        onNotificationRead();
        onNotificationUpdated(notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    if (typeof notification.data?.url === 'string' && notification.data.url.startsWith('/')) {
      router.push(notification.data.url);
      onClose();
      return;
    }

    // FIXED: Handle auction_won notifications - route to auction details page
    if (notification.type === 'auction_won') {
      if (notification.data?.url) {
        // Use the URL from notification data (set by closure service)
        router.push(notification.data.url);
        onClose();
        return;
      }
      if (notification.data?.auctionId) {
        // Fallback to auction details page
        router.push(`/vendor/auctions/${notification.data.auctionId}`);
        onClose();
        return;
      }
    }

    // Handle PAYMENT_UNLOCKED notifications
    if (notification.type === 'PAYMENT_UNLOCKED') {
      if (notification.data?.paymentId) {
        // New notifications with paymentId → go to payment page
        console.log('Routing to payment page with paymentId:', notification.data.paymentId);
        router.push(`/vendor/payments/${notification.data.paymentId}`);
        onClose();
        return; // Early return to prevent fall-through
      }
      
      if (notification.data?.auctionId) {
        // Old notifications without paymentId → query payment by auctionId
        console.log('Querying payment by auctionId:', notification.data.auctionId);
        try {
          const response = await fetch(`/api/payments?auctionId=${notification.data.auctionId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.data?.payment?.id) {
              console.log('Found payment, routing to:', data.data.payment.id);
              router.push(`/vendor/payments/${data.data.payment.id}`);
              onClose();
              return; // Early return
            }
          }
        } catch (error) {
          console.error('Error fetching payment:', error);
        }
        // Fallback to auction details if payment not found
        console.log('Payment not found, falling back to auction details');
        router.push(`/vendor/auctions/${notification.data.auctionId}`);
        onClose();
        return; // Early return
      }
    }
    
    // Handle payment_reminder notifications
    if (notification.type === 'payment_reminder' && notification.data?.vendorId) {
      // Finance Officer "Escrow Payment Failed" → go to finance payments page
      router.push('/finance/payments');
      onClose();
      return; // Early return
    }
    
    // Default: route to auction details
    if (notification.data?.auctionId) {
      router.push(`/vendor/auctions/${notification.data.auctionId}`);
      onClose();
      return; // Early return
    }

    onClose();
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });
      
      onMarkAllRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleViewAll = () => {
    router.push('/notifications');
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-16 max-sm:bottom-auto max-sm:mt-0 max-sm:w-auto"
      style={{ maxHeight: 'calc(100vh - 5rem)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        <div className="flex items-center gap-2">
          {notifications.some((n) => !n.read) && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-[var(--brand-primary)] hover:underline"
            >
              Mark all read
            </button>
          )}
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="sm:hidden text-gray-400 hover:text-gray-600"
            aria-label="Close notifications"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-96 max-sm:max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No notifications
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200">
          <button
            onClick={handleViewAll}
            className="w-full text-sm text-center text-[var(--brand-primary)] hover:underline font-medium"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
