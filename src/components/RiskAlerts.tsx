import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { analyzeRisks } from '@/lib/store';

export default function RiskAlerts() {
  const warnings = analyzeRisks();

  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-safe/20 bg-safe/8 p-4">
        <div className="rounded-lg bg-safe/15 p-2">
          <CheckCircle className="h-5 w-5 shrink-0 text-safe" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Alles ziet er goed uit!</p>
          <p className="text-sm text-muted-foreground">Geen waarschuwingen vandaag.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {warnings.map((warning, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/8 p-4"
        >
          <div className="mt-0.5 rounded-lg bg-warning/15 p-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          </div>
          <p className="text-sm font-medium text-foreground">{warning}</p>
        </div>
      ))}
    </div>
  );
}
