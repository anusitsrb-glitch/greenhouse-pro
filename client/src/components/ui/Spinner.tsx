import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3',
  };
  
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-gray-300 border-t-primary',
        sizes[size],
        className
      )}
    />
  );
}

interface LoadingProps {
  message?: string;
}

export function Loading({ message = 'กำลังโหลด...' }: LoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Spinner size="lg" />
      <p className="mt-4 text-gray-500">{message}</p>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Spinner size="lg" />
        <p className="mt-4 text-gray-500">กำลังโหลด...</p>
      </div>
    </div>
  );
}
