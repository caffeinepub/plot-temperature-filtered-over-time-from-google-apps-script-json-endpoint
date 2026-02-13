import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
  className?: string;
}

export function DashboardCard({ title, children, headerAction, className = '' }: DashboardCardProps) {
  return (
    <Card className={`shadow-lg border-2 p-0 overflow-hidden ${className}`}>
      <CardHeader className="border-b p-6 bg-chart-header rounded-t-[calc(var(--radius)-2px)]">
        <CardTitle className="flex items-center justify-between">
          <span className="text-xl">{title}</span>
          {headerAction}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {children}
      </CardContent>
    </Card>
  );
}
