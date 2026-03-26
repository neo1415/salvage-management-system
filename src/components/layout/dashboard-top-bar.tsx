'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { User as UserIcon } from 'lucide-react';
import NotificationBell from '@/components/notifications/notification-bell';

/**
 * Dashboard Top Bar Component
 * 
 * Fixed top bar for desktop view with notifications and profile picture on the right
 * Only visible on desktop (lg breakpoint and above)
 */
export function DashboardTopBar() {
  const { data: session } = useSession();
  const userRole = session?.user?.role || 'vendor';

  return (
    <div className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-end px-6">
      {/* Right side: Notification Bell + Profile Picture */}
      <div className="flex items-center gap-4">
        <NotificationBell />
        
        <Link 
          href="/settings/profile-picture"
          className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 hover:border-[#800020] transition-colors"
        >
          {session?.user?.profilePictureUrl ? (
            <Image
              src={session.user.profilePictureUrl}
              alt={session.user.name || 'User'}
              fill
              className="object-cover rounded-full"
              sizes="40px"
            />
          ) : (
            <div className="w-full h-full bg-[#800020] flex items-center justify-center rounded-full">
              <UserIcon className="w-5 h-5 text-white" />
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}
