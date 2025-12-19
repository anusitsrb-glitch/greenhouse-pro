import { ReactNode } from 'react';
import { Header } from './Header';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageContainerProps {
  children: ReactNode;
  breadcrumbs?: Breadcrumb[];
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  padding?: boolean;
}

export function PageContainer({
  children,
  breadcrumbs,
  maxWidth = '7xl',
  padding = true,
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header breadcrumbs={breadcrumbs} />
      <main className={`${maxWidthClasses[maxWidth]} mx-auto ${padding ? 'px-4 py-6' : ''}`}>
        {children}
      </main>
    </div>
  );
}
