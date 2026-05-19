'use client';

/**
 * Notifications Page
 *
 * Full notifications page with tabs (All, Unread), infinite scroll,
 * and mark all as read functionality.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { DataLoadingState, DataRefreshingHint } from '@/components/ui/loading-states';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import NotificationItem from '@/components/notifications/notification-item';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

type NotificationTab = 'all' | 'unread';

interface TabCacheEntry {
  notifications: Notification[];
  hasMore: boolean;
  offset: number;
}

const LIMIT = 20;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationsRef = useRef<Notification[]>([]);
  const tabCacheRef = useRef<Map<NotificationTab, TabCacheEntry>>(new Map());
  const prefetchedTabsRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const [hasMore, setHasMore] = useState(true);
  const router = useRouter();

  const loadTab = useCallback(async (tab: NotificationTab, reset: boolean) => {
    const cached = tabCacheRef.current.get(tab);
    const currentOffset = reset ? 0 : cached?.offset ?? notificationsRef.current.length;

    if (reset) {
      if (cached) {
        notificationsRef.current = cached.notifications;
        setNotifications(cached.notifications);
        setHasMore(cached.hasMore);
      } else {
        notificationsRef.current = [];
        setNotifications([]);
        setHasMore(true);
      }
    }

    const showFullPageLoader = notificationsRef.current.length === 0;
    try {
      if (showFullPageLoader) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const response = await fetch(
        `/api/notifications?limit=${LIMIT}&offset=${currentOffset}&unreadOnly=${tab === 'unread'}`
      );

      if (!response.ok) return;

      const data = await response.json();
      const newNotifications: Notification[] = data.data.notifications;
      const merged = reset
        ? newNotifications
        : [...notificationsRef.current, ...newNotifications];
      const nextOffset = reset ? LIMIT : currentOffset + LIMIT;
      const nextHasMore = newNotifications.length === LIMIT;

      notificationsRef.current = merged;
      setNotifications(merged);
      setHasMore(nextHasMore);

      tabCacheRef.current.set(tab, {
        notifications: merged,
        hasMore: nextHasMore,
        offset: nextOffset,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTab(activeTab, true);
  }, [activeTab, loadTab]);

  // Prefetch the other tab (page 1) for instant tab switches
  useEffect(() => {
    if (prefetchedTabsRef.current) return;
    prefetchedTabsRef.current = true;

    const tabs: NotificationTab[] = ['all', 'unread'];
    void Promise.all(
      tabs.map(async (tab) => {
        if (tabCacheRef.current.has(tab)) return;
        try {
          const response = await fetch(
            `/api/notifications?limit=${LIMIT}&offset=0&unreadOnly=${tab === 'unread'}`
          );
          if (!response.ok) return;
          const data = await response.json();
          const items: Notification[] = data.data.notifications;
          tabCacheRef.current.set(tab, {
            notifications: items,
            hasMore: items.length === LIMIT,
            offset: LIMIT,
          });
        } catch {
          // Prefetch is best-effort
        }
      })
    );
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}`, {
          method: 'PATCH',
        });

        const markRead = (list: Notification[]) =>
          list.map((n) => (n.id === notification.id ? { ...n, read: true } : n));

        notificationsRef.current = markRead(notificationsRef.current);
        setNotifications(notificationsRef.current);

        for (const [tab, entry] of tabCacheRef.current.entries()) {
          tabCacheRef.current.set(tab, {
            ...entry,
            notifications: markRead(entry.notifications),
          });
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    if (notification.type === 'PAYMENT_UNLOCKED') {
      if (notification.data?.paymentId) {
        router.push(`/vendor/payments/${notification.data.paymentId as string}`);
        return;
      }

      if (notification.data?.auctionId) {
        try {
          const response = await fetch(
            `/api/payments?auctionId=${notification.data.auctionId as string}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data.data?.payment?.id) {
              router.push(`/vendor/payments/${data.data.payment.id}`);
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching payment:', error);
        }
        router.push(`/vendor/auctions/${notification.data.auctionId as string}`);
        return;
      }
    }

    if (notification.type === 'payment_reminder' && notification.data?.vendorId) {
      router.push('/finance/payments');
      return;
    }

    if (notification.data?.auctionId) {
      router.push(`/vendor/auctions/${notification.data.auctionId as string}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });

      const markAllRead = (list: Notification[]) =>
        list.map((n) => ({ ...n, read: true }));

      notificationsRef.current = markAllRead(notificationsRef.current);
      setNotifications(notificationsRef.current);

      for (const [tab, entry] of tabCacheRef.current.entries()) {
        tabCacheRef.current.set(tab, {
          ...entry,
          notifications: markAllRead(entry.notifications),
        });
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleLoadMore = () => {
    void loadTab(activeTab, false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 lg:ml-64 pt-16 lg:pt-0">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-600 mt-1">
              Stay updated with your auction activity
              {isRefreshing && (
                <span className="ml-2">
                  <DataRefreshingHint className="mb-0 inline-flex" />
                </span>
              )}
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

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {isLoading && notifications.length === 0 ? (
            <div className="px-4 py-6">
              <DataLoadingState label="Notifications" variant="table" />
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

              {hasMore && (
                <div className="px-4 py-4 text-center border-t border-gray-200">
                  <button
                    onClick={handleLoadMore}
                    disabled={isRefreshing}
                    className="text-sm text-[#800020] hover:underline font-medium disabled:opacity-50"
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
