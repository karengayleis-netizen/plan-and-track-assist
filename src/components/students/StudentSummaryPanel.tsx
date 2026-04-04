import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Student, Benchmark, MarkbookEntry } from '@/types';
import { freshnessLabel, isStale } from '@/lib/freshness';
import { X, BarChart3, BookOpen, Eye, MessageCircle, Package, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StudentSummaryPanelProps {
  student: Student | null;
  open: boolean;
  onClose: () => void;
  benchmarks: Benchmark[];
  markbookEntries: MarkbookEntry[];
}

type RiskLevel = 'low' | 'medium' | 'high';

function computeRisk(student: Student, benchmarkCount: number, markbookCount: number): RiskLevel {
  if (student.isHighNeed) return 'high';
  if (benchmarkCount === 0 && markbookCount === 0) return 'high';
  if (benchmarkCount === 0 || markbookCount === 0) return 'medium';
  if (student.isFocusStudent) return 'medium';
  return 'low';
}

const RISK_STYLES: Record<RiskLevel, { bg: string; text: string; icon: typeof TrendingUp }> = {
  low: { bg: 'bg-success/10', text: 'text-success', icon: TrendingUp },
  medium: { bg: 'bg-warning/10', text: 'text-warning', icon: Minus },
  high: { bg: 'bg-destructive/10', text: 'text-destructive', icon: TrendingDown },
};

export function StudentSummaryPanel({ student, open, onClose, benchmarks, markbookEntries }: StudentSummaryPanelProps) {
  const data = useMemo(() => {
    if (!student) return null;

    const studentBenchmarks = benchmarks
      .filter(b => b.studentId === student.id)
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date.getTime() : 0;
        const db2 = b.date instanceof Date ? b.date.getTime() : 0;
        return db2 - da;
      });

    const studentMarkbook = markbookEntries
      .filter(e => e.studentId === student.id)
      .sort((a, b) => {
        const da = a.date instanceof Date ? a.date.getTime() : 0;
        const db2 = b.date instanceof Date ? b.date.getTime() : 0;
        return db2 - da;
      });

    const risk = computeRisk(student, studentBenchmarks.length, studentMarkbook.length);

    return {
      benchmarks: studentBenchmarks,
      markbook: studentMarkbook,
      risk,
      latestBenchmarks: studentBenchmarks.slice(0, 5),
      recentMarkbook: studentMarkbook.slice(0, 5),
      triangulation: {
        benchmarks: studentBenchmarks.length,
        markbook: studentMarkbook.length,
        total: studentBenchmarks.length + studentMarkbook.length,
      },
    };
  }, [student, benchmarks, markbookEntries]);

  if (!student || !data) return null;

  const riskStyle = RISK_STYLES[data.risk];
  const RiskIcon = riskStyle.icon;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="font-mono text-lg">{student.studentNumber}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {student.initials && <span className="mr-2">{student.initials}</span>}
                Grade {student.grade} · {student.homeroom}
              </p>
            </div>
          </div>

          {/* Risk Indicator */}
          <div className={`flex items-center gap-2 mt-3 px-3 py-2 rounded-lg ${riskStyle.bg}`}>
            <RiskIcon className={`h-4 w-4 ${riskStyle.text}`} />
            <span className={`text-sm font-medium ${riskStyle.text} capitalize`}>{data.risk} Risk</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {data.triangulation.total} data point{data.triangulation.total !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Flags */}
          {(student.isFocusStudent || student.isHighNeed) && (
            <div className="flex gap-1.5 mt-2">
              {student.isFocusStudent && (
                <Badge variant="outline" className="text-xs border-primary/30 text-primary">Focus Student</Badge>
              )}
              {student.isHighNeed && (
                <Badge variant="destructive" className="text-xs">High Need</Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <Separator />

        <div className="p-6 space-y-6">
          {/* Triangulation Counts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/40">
              <BarChart3 className="h-4 w-4 mx-auto text-chart-1 mb-1" />
              <p className="text-lg font-semibold text-foreground">{data.triangulation.benchmarks}</p>
              <p className="text-xs text-muted-foreground">Benchmarks</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/40">
              <BookOpen className="h-4 w-4 mx-auto text-chart-2 mb-1" />
              <p className="text-lg font-semibold text-foreground">{data.triangulation.markbook}</p>
              <p className="text-xs text-muted-foreground">Markbook</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/40">
              <Eye className="h-4 w-4 mx-auto text-chart-3 mb-1" />
              <p className="text-lg font-semibold text-foreground">{data.triangulation.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>

          {/* Latest Benchmarks */}
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-chart-1" />
              Latest Benchmarks
            </h4>
            {data.latestBenchmarks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center bg-muted/20 rounded-lg">
                No benchmarks recorded
              </p>
            ) : (
              <div className="space-y-2">
                {data.latestBenchmarks.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-2.5 border border-border/50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{b.assessmentType}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.date instanceof Date ? b.date.toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <span className="text-sm font-semibold text-primary">{b.score}</span>
                      <p className={`text-xs ${isStale(b.lastUpdated) ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {freshnessLabel(b.lastUpdated)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Markbook */}
          <div>
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-chart-2" />
              Recent Markbook
            </h4>
            {data.recentMarkbook.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center bg-muted/20 rounded-lg">
                No markbook entries
              </p>
            ) : (
              <div className="space-y-2">
                {data.recentMarkbook.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-2.5 border border-border/50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{e.taskName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">{e.subject}</Badge>
                        {e.strand && <span className="text-xs text-muted-foreground">{e.strand}</span>}
                      </div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <span className="text-sm font-semibold text-primary">{e.score}</span>
                      <p className={`text-xs ${isStale(e.lastUpdated) ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {freshnessLabel(e.lastUpdated)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
