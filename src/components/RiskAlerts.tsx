import { AlertTriangle, CheckCircle } from 'lucide-react';
import { analyzeRisks } from '@/lib/store';

export default function RiskAlerts() {
  const warnings = analyzeRisks();

  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        <CheckCircle className="h-6 w-6 shrink-0 text-safe" />
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
          className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm font-medium text-foreground">{warning}</p>
        </div>
      ))}
    </div>
  );
}
