'use client';

/**
 * Notification Dropdown Component
 * 
 * Dropdown showing latest 3-4 notifications with "View All" link.
 * Displays notification items with icons, titles, messages, and timestamps.
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  onClose: () => void;
  onNotificationRead: () => void;
  onMarkAllRead: () => void;
}

export default function NotificationDropdown({
  onClose,
  onNotificationRead,
  onMarkAllRead,
}: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch latest notifications
  useEffect(() => {
    fetchNotifications();
  }, []);

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

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=4');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data.notifications);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
        });
        onNotificationRead();
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
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
      
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      
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
      className="fixed top-16 right-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999]"
      style={{ maxHeight: 'calc(100vh - 5rem)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {notifications.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-[#800020] hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="max-h-96 overflow-y-auto">
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
            className="w-full text-sm text-center text-[#800020] hover:underline font-medium"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
