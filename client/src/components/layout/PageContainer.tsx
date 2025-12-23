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

  // ✅ เพิ่มเพื่อให้เพจเรียก title/subtitle ได้
  title?: string;
  subtitle?: string;
}

export function PageContainer({
  children,
  breadcrumbs,
  maxWidth = '7xl',
  padding = true,
  title,
  subtitle,
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
        {(title || subtitle) && (
          <div className="mb-4">
            {title && <h1 className="text-xl font-semibold text-gray-900">{title}</h1>}
            {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
