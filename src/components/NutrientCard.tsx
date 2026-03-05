import { getStatusColor, getStatusLabel } from '@/lib/store';

interface NutrientCardProps {
  label: string;
  current: number;
  limit: number;
  unit: string;
  icon: React.ReactNode;
}

export default function NutrientCard({ label, current, limit, unit, icon }: NutrientCardProps) {
  const status = getStatusColor(current, limit);
  const percentage = Math.min((current / limit) * 100, 100);

  const barColor = {
    safe: 'bg-safe',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }[status];

  const bgColor = {
    safe: 'status-safe-bg',
    warning: 'status-warning-bg',
    danger: 'status-danger-bg',
  }[status];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${bgColor}`}>
          {getStatusLabel(status)}
        </span>
      </div>
      <div className="mb-1 text-2xl font-bold text-foreground">
        {current} <span className="text-sm font-normal text-muted-foreground">/ {limit} {unit}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
