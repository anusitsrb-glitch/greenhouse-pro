import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout';
import { GreenhouseCard, GreenhouseCardSkeleton } from '@/components/projects';
import { Button } from '@/components/ui';
import { projectsApi, ProjectDetail, Greenhouse } from '@/lib/projectsApi';
import { AlertCircle, RefreshCw, ArrowLeft, Building2 } from 'lucide-react';

export function ProjectPage() {
  const { projectKey } = useParams<{ projectKey: string }>();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [greenhouses, setGreenhouses] = useState<Greenhouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!projectKey) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await projectsApi.getGreenhouses(projectKey);
      setProject(data.project);
      setGreenhouses(data.greenhouses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectKey]);

  const breadcrumbs = project ? [
    { label: project.nameTh }
  ] : [];

  // Count ready vs developing
  const readyCount = greenhouses.filter(g => g.status === 'ready').length;
  const developingCount = greenhouses.length - readyCount;

  return (
    <PageContainer breadcrumbs={breadcrumbs}>
      {/* Back button (mobile) */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/')}
        className="mb-4 -ml-2 md:hidden"
      >
        <ArrowLeft className="w-4 h-4" />
        กลับ
      </Button>

      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {project?.nameTh || 'กำลังโหลด...'}
            </h1>
            {!isLoading && (
              <p className="text-sm text-gray-500">
                {greenhouses.length} โรงเรือน
                {readyCount > 0 && ` • ${readyCount} พร้อมใช้งาน`}
                {developingCount > 0 && ` • ${developingCount} กำลังพัฒนา`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-800">{error}</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
            >
              <RefreshCw className="w-4 h-4" />
              ลองใหม่
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <GreenhouseCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Greenhouses Grid */}
      {!isLoading && !error && projectKey && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {greenhouses.map((greenhouse) => (
            <GreenhouseCard
              key={greenhouse.id}
              greenhouse={greenhouse}
              projectKey={projectKey}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && greenhouses.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            ไม่พบโรงเรือน
          </h3>
          <p className="text-gray-500">
            โปรเจกต์นี้ยังไม่มีโรงเรือน
          </p>
        </div>
      )}
    </PageContainer>
  );
}
