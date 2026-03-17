import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
import { 
  Leaf, 
  Droplets, 
  Sprout, 
  TreeDeciduous,
  Lock,
  ChevronRight,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project } from '@/lib/projectsApi';
import { useT } from '@/i18n';

interface ProjectCardProps {
  project: Project;
}

const PROJECT_STYLES: Record<string, { 
  icon: typeof Leaf; 
  gradient: string;
  iconBg: string;
}> = {
  maejard: {
    icon: Leaf,
    gradient: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)',
    iconBg: 'bg-green-500',
  },
  hydroponics: {
    icon: Droplets,
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    iconBg: 'bg-blue-500',
  },
  vegetable_house: {
    icon: Sprout,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    iconBg: 'bg-pink-500',
  },
  guava_outdoor: {
    icon: TreeDeciduous,
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    iconBg: 'bg-orange-500',
  },
};

export function ProjectCard({ project }: ProjectCardProps) {
  const { t } = useT();
  const style = PROJECT_STYLES[project.key] || {
    icon: Building2,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    iconBg: 'bg-purple-500',
  };
  
  const Icon = style.icon;
  const isReady = project.status === 'ready';
  const isLocked = !project.hasAccess;

  const cardContent = (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-300',
        isReady && !isLocked && 'hover:-translate-y-1 hover:shadow-elevated cursor-pointer',
        isLocked && 'opacity-60 cursor-not-allowed'
      )}
    >
      <div 
        className="absolute top-0 left-0 right-0 h-1.5"
        style={{ background: style.gradient }}
      />

      <div className="pt-4">
        {/* Icon & Status */}
        <div className="flex items-start justify-between mb-4">
          <div 
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm',
              style.iconBg
            )}
          >
            <Icon className="w-6 h-6" />
          </div>

          {isLocked ? (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs">
              <Lock className="w-3 h-3" />
              <span>{t('project.locked')}</span>
            </div>
          ) : (
            <span
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium',
                isReady 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              )}
            >
              {isReady ? t('greenhouse.ready') : t('greenhouse.developing')}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {project.nameTh}
        </h3>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-1">
            <Building2 className="w-4 h-4" />
            <span>{project.greenhouseCount} {t('page.greenhouse')}</span>
          </div>
          {project.readyGreenhouseCount > 0 && (
            <div className="text-green-600">
              {project.readyGreenhouseCount} {t('greenhouse.ready')}
            </div>
          )}
        </div>

        {/* Action hint */}
        {isReady && !isLocked && (
          <div className="flex items-center justify-end text-primary text-sm font-medium">
            <span>{t('project.viewGreenhouses')}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}

        {/* Locked tooltip */}
        {isLocked && (
          <div className="text-xs text-gray-400">
            {t('project.noAccess')}
          </div>
        )}
      </div>
    </Card>
  );

  if (isReady && !isLocked) {
    return (
      <Link to={`/project/${project.key}`}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}