'use client';

/**
 * Notifications Page
 * 
 * Full notifications page with tabs (All, Unread), infinite scroll,
 * and mark all as read functionality.
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const router = useRouter();

  const LIMIT = 20;

  // Fetch notifications
  useEffect(() => {
    fetchNotifications(true);
  }, [activeTab]);

  const fetchNotifications = async (reset = false) => {
    try {
      const currentOffset = reset ? 0 : offset;
      const unreadOnly = activeTab === 'unread';
      
      const response = await fetch(
        `/api/notifications?limit=${LIMIT}&offset=${currentOffset}&unreadOnly=${unreadOnly}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const newNotifications = data.data.notifications;

        if (reset) {
          setNotifications(newNotifications);
          setOffset(LIMIT);
        } else {
          setNotifications((prev) => [...prev, ...newNotifications]);
          setOffset((prev) => prev + LIMIT);
        }

        setHasMore(newNotifications.length === LIMIT);
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
        
        // Update local state
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate to relevant page based on notification type
    // Handle PAYMENT_UNLOCKED notifications
    if (notification.type === 'PAYMENT_UNLOCKED') {
      if (notification.data?.paymentId) {
        // New notifications with paymentId → go to payment page
        console.log('Routing to payment page with paymentId:', notification.data.paymentId);
        router.push(`/vendor/payments/${notification.data.paymentId}`);
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
              return; // Early return
            }
          }
        } catch (error) {
          console.error('Error fetching payment:', error);
        }
        // Fallback to auction details if payment not found
        console.log('Payment not found, falling back to auction details');
        router.push(`/vendor/auctions/${notification.data.auctionId}`);
        return; // Early return
      }
    }
    
    // Handle payment_reminder notifications
    if (notification.type === 'payment_reminder' && notification.data?.vendorId) {
      // Finance Officer "Escrow Payment Failed" → go to finance payments page
      router.push('/finance/payments');
      return; // Early return
    }
    
    // Default: route to auction details
    if (notification.data?.auctionId) {
      router.push(`/vendor/auctions/${notification.data.auctionId}`);
      return; // Early return
    }
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
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleLoadMore = () => {
    fetchNotifications(false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 lg:ml-64 pt-16 lg:pt-0">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-600 mt-1">
              Stay updated with your auction activity
            </p>
          </div>
          
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#800020] bg-white border border-[#800020] rounded-lg hover:bg-[#800020] hover:text-white transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'text-[#800020] border-b-2 border-[#800020]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'unread'
                ? 'text-[#800020] border-b-2 border-[#800020]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {isLoading ? (
            <div className="px-4 py-12 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No notifications</p>
              <p className="text-sm">
                {activeTab === 'unread'
                  ? "You're all caught up!"
                  : "You'll see notifications here when you have activity"}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="px-4 py-4 text-center border-t border-gray-200">
                  <button
                    onClick={handleLoadMore}
                    className="text-sm text-[#800020] hover:underline font-medium"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
