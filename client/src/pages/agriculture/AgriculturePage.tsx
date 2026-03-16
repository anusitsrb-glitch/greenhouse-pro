import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout';
import { Card } from '@/components/ui';
import { Sprout, TrendingUp, Droplets, Bug, Package, Waves } from 'lucide-react';

const AGRICULTURE_MENUS = [
  {
    title: 'จัดการพืช',
    description: 'บันทึกและติดตามพืชที่ปลูก',
    icon: Sprout,
    color: 'bg-green-100 text-green-600',
    border: 'border-green-200 hover:border-green-400',
    href: '/agriculture/crops',
  },
  {
    title: 'บันทึกการเติบโต',
    description: 'ติดตามการเจริญเติบโตของพืช',
    icon: TrendingUp,
    color: 'bg-blue-100 text-blue-600',
    border: 'border-blue-200 hover:border-blue-400',
    href: '/agriculture/growth',
  },
  {
    title: 'ตารางใส่ปุ๋ย',
    description: 'วางแผนและติดตามการใส่ปุ๋ย',
    icon: Droplets,
    color: 'bg-yellow-100 text-yellow-600',
    border: 'border-yellow-200 hover:border-yellow-400',
    href: '/agriculture/fertilizer',
  },
  {
    title: 'โรค/แมลง',
    description: 'บันทึกและติดตามปัญหาโรคและแมลง',
    icon: Bug,
    color: 'bg-orange-100 text-orange-600',
    border: 'border-orange-200 hover:border-orange-400',
    href: '/agriculture/pest-disease',
  },
  {
    title: 'ผลผลิต',
    description: 'ติดตามการเก็บเกี่ยวและรายได้',
    icon: Package,
    color: 'bg-purple-100 text-purple-600',
    border: 'border-purple-200 hover:border-purple-400',
    href: '/agriculture/yield',
  },
  {
    title: 'การใช้น้ำ',
    description: 'ติดตามปริมาณและค่าใช้จ่ายน้ำ',
    icon: Waves,
    color: 'bg-cyan-100 text-cyan-600',
    border: 'border-cyan-200 hover:border-cyan-400',
    href: '/agriculture/water',
  },
];

export function AgriculturePage() {
  const navigate = useNavigate();

  return (
    <PageContainer title="การเกษตร" subtitle="เลือกหมวดหมู่ที่ต้องการจัดการ">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {AGRICULTURE_MENUS.map((menu) => {
          const Icon = menu.icon;
          return (
            <Card
              key={menu.href}
              className={`p-6 cursor-pointer border-2 transition-all hover:shadow-md ${menu.border}`}
              onClick={() => navigate(menu.href)}
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className={`w-14 h-14 rounded-2xl ${menu.color} flex items-center justify-center`}>
                  <Icon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{menu.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{menu.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}