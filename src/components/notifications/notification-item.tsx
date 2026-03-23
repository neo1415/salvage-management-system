'use client';

/**
 * Notification Item Component
 * 
 * Individual notification display with icon, title, message, and timestamp.
 * Shows unread indicator and handles click events.
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import {
  Bell,
  Trophy,
  Gavel,
  Clock,
  Tag,
  Key,
  CreditCard,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  read: boolean;
  createdAt: string;
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

// Map notification types to icons
const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  outbid: Bell,
  auction_won: Trophy,
  auction_lost: Gavel,
  auction_closing_soon: Clock,
  new_auction: Tag,
  otp_sent: Key,
  payment_reminder: CreditCard,
  kyc_update: CheckCircle,
  system_alert: AlertCircle,
  account_update: CheckCircle,
};

// Map notification types to colors
const notificationColors: Record<string, string> = {
  outbid: 'text-orange-500',
  auction_won: 'text-green-500',
  auction_lost: 'text-gray-500',
  auction_closing_soon: 'text-red-500',
  new_auction: 'text-blue-500',
  otp_sent: 'text-purple-500',
  payment_reminder: 'text-yellow-600',
  kyc_update: 'text-green-500',
  system_alert: 'text-red-500',
  account_update: 'text-blue-500',
};

export default function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const Icon = notificationIcons[notification.type] || Bell;
  const iconColor = notificationColors[notification.type] || 'text-gray-500';

  // Format timestamp
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
  });

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
        !notification.read ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Unread Indicator */}
        {!notification.read && (
          <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full" />
        )}

        {/* Icon */}
        <div className={`flex-shrink-0 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm ${
              !notification.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
            }`}
          >
            {notification.title}
          </p>
          <p className="mt-1 text-xs text-gray-600 line-clamp-2">
            {notification.message}
          </p>
          <p className="mt-1 text-xs text-gray-400">{timeAgo}</p>
        </div>
      </div>
    </button>
  );
}
