'use client';

/**
 * Notification Bell Component
 * 
 * Bell icon with unread count badge that opens notification dropdown.
 * Integrates into dashboard sidebar.
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import NotificationDropdown from './notification-dropdown';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);

  // Fetch unread count on mount
  useEffect(() => {
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Fetch unread count from API
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/unread-count', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.data.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNotifications = async (force = false) => {
    const isFresh = lastFetchedAt && Date.now() - lastFetchedAt < 30000;
    if (!force && (notifications.length > 0 || isFresh)) {
      return;
    }

    setNotificationsLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=6', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data.notifications);
        setLastFetchedAt(Date.now());
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const handleBellClick = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      fetchNotifications();
    }
  };

  // Handle notification read
  const handleNotificationRead = () => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // Handle mark all as read
  const handleMarkAllRead = () => {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={handleBellClick}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-700" />
        
        {/* Unread Badge */}
        {!isLoading && unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          isLoading={notificationsLoading}
          onClose={() => setIsOpen(false)}
          onNotificationRead={handleNotificationRead}
          onMarkAllRead={handleMarkAllRead}
          onNotificationUpdated={(notificationId) =>
            setNotifications((prev) =>
              prev.map((notification) =>
                notification.id === notificationId ? { ...notification, read: true } : notification
              )
            )
          }
        />
      )}
    </div>
  );
}
