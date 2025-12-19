import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import { 
  Home,
  Lock,
  ChevronRight,
  Wifi,
  WifiOff,
  Construction
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

  // Extract number from ghKey (e.g., "greenhouse8" -> 8)
  const numberMatch = greenhouse.ghKey.match(/\d+/);
  const number = numberMatch ? numberMatch[0] : '';

  const cardContent = (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300 group',
        isReady && 'hover:-translate-y-1 hover:shadow-elevated cursor-pointer',
        !isReady && 'opacity-70'
      )}
    >
      <div className="flex items-center gap-4">
        {/* Number badge */}
        <div 
          className={cn(
            'w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm flex-shrink-0',
            isReady ? 'bg-primary' : 'bg-gray-400'
          )}
        >
          {number || <Home className="w-6 h-6" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {greenhouse.nameTh}
            </h3>
            
            {/* Device status indicator */}
            {isReady && (
              <div className={cn(
                'flex items-center gap-1 text-xs',
                hasDevice ? 'text-green-600' : 'text-gray-400'
              )}>
                {hasDevice ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                isReady 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              )}
            >
              {greenhouse.statusText}
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

  // Always linkable, but show different UI inside greenhouse page
  return (
    <Link to={`/project/${projectKey}/${greenhouse.ghKey}`}>
      {cardContent}
    </Link>
  );
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
