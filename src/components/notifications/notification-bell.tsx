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

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch unread count on mount
  useEffect(() => {
    fetchUnreadCount();
  }, []);

  // Fetch unread count from API
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch('/api/notifications/unread-count');
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

  // Handle notification read
  const handleNotificationRead = () => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // Handle mark all as read
  const handleMarkAllRead = () => {
    setUnreadCount(0);
  };

  return (
    <div className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
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
          onClose={() => setIsOpen(false)}
          onNotificationRead={handleNotificationRead}
          onMarkAllRead={handleMarkAllRead}
        />
      )}
    </div>
  );
}
