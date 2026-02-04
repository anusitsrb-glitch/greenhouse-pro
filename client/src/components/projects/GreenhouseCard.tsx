import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import {
  Home,
  ChevronRight,
  Wifi,
  WifiOff,
  Construction,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Greenhouse } from '@/lib/projectsApi';

interface GreenhouseCardProps {
  greenhouse: Greenhouse;
  projectKey: string;
}

export function GreenhouseCard({ greenhouse, projectKey }: GreenhouseCardProps) {
  const isReady = greenhouse.status === 'ready';
  const hasDevice = greenhouse.hasDevice;

  const deviceStatus = greenhouse.deviceStatus; // 'online' | 'offline' | undefined
  const isOnline = deviceStatus === 'online';
  const isUnknown = isReady && hasDevice && !deviceStatus;

  // Extract number from ghKey (e.g., "greenhouse8" -> 8)
  const numberMatch = greenhouse.ghKey.match(/\d+/);
  const number = numberMatch ? numberMatch[0] : '';

  const statusClass = !isReady
    ? 'bg-yellow-100 text-yellow-800'
    : isOnline
      ? 'bg-green-100 text-green-800'
      : isUnknown
        ? 'bg-gray-100 text-gray-700'
        : 'bg-red-100 text-red-800';

  const statusText = !isReady
    ? greenhouse.statusText
    : isOnline
      ? 'พร้อมใช้งาน'
      : isUnknown
        ? 'กำลังตรวจสอบ'
        : 'ออฟไลน์';

  const cardContent = (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300 group',
        isReady && 'hover:-translate-y-1 hover:shadow-elevated cursor-pointer',
        !isReady && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-4">
        {/* Number badge (Home + number) */}
        <div
          className={cn(
            'w-14 h-14 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 relative',
            isReady ? 'bg-primary' : 'bg-gray-400'
          )}
        >
          <Home className="w-7 h-7 text-white" />
          {number && (
            <span className="absolute bottom-1 right-1 bg-white/90 text-gray-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {number}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {greenhouse.nameTh}
            </h3>

            {/* Wifi icon (only when ready) */}
            {isReady && (
              <div
                className={cn(
                  'flex items-center',
                  isOnline ? 'text-green-600' : isUnknown ? 'text-gray-400' : 'text-red-500'
                )}
                title={statusText}
              >
                {isOnline ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
              </div>
            )}
          </div>

          {/* Status badge (single source of truth) */}
          <div className="flex items-center gap-2">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusClass)}>
              {statusText}
            </span>

            {!isReady && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Construction className="w-3 h-3" />
                ยังไม่มี Device ID
              </span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight
          className={cn(
            'w-5 h-5 text-gray-400 flex-shrink-0 transition-transform',
            isReady && 'group-hover:translate-x-1 group-hover:text-primary'
          )}
        />
      </div>

      {/* Developing banner */}
      {!isReady && (
        <div className="absolute top-0 right-0 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-bl-lg">
          กำลังพัฒนา
        </div>
      )}
    </Card>
  );

  return <Link to={`/project/${projectKey}/${greenhouse.ghKey}`}>{cardContent}</Link>;
}

// Skeleton for loading state
export function GreenhouseCardSkeleton() {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gray-200 animate-pulse flex-shrink-0" />
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-32 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
        </div>
      </div>
    </Card>
  );
}
