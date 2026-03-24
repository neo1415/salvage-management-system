import Image from 'next/image';
import { User as UserIcon } from 'lucide-react';

interface UserAvatarProps {
  profilePictureUrl?: string | null;
  userName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

export function UserAvatar({ 
  profilePictureUrl, 
  userName, 
  size = 'md',
  className = '' 
}: UserAvatarProps) {
  return (
    <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0 ${className}`}>
      {profilePictureUrl ? (
        <Image
          src={profilePictureUrl}
          alt={userName}
          fill
          className="object-cover"
          sizes={sizeClasses[size]}
        />
      ) : (
        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
          <UserIcon className={`${iconSizes[size]} text-gray-400`} />
        </div>
      )}
    </div>
  );
}
