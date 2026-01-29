import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InsightChartProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function InsightChart({ 
  title, 
  description, 
  children, 
  className,
  action 
}: InsightChartProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

// Chart color constants for consistent styling
export const chartColors = {
  primary: 'hsl(var(--chart-1))',
  success: 'hsl(var(--chart-2))',
  purple: 'hsl(var(--chart-3))',
  warning: 'hsl(var(--chart-4))',
  destructive: 'hsl(var(--chart-5))',
};

// Tooltip style for Recharts
export const tooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  labelStyle: {
    color: 'hsl(var(--foreground))',
    fontWeight: 600,
  },
};
