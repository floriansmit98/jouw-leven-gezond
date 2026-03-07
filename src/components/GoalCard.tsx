import { getGoalStatus, getGoalLabel } from '@/lib/store';

interface GoalCardProps {
  label: string;
  current: number;
  goal: number;
  unit: string;
  icon: React.ReactNode;
}

export default function GoalCard({ label, current, goal, unit, icon }: GoalCardProps) {
  const status = getGoalStatus(current, goal);
  const percentage = Math.min((current / goal) * 100, 100);

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

  const iconBg = {
    safe: 'bg-safe/10 text-safe',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  }[status];

  const remaining = Math.max(0, goal - current);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm gradient-card-highlight">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`rounded-lg p-1.5 ${iconBg}`}>{icon}</span>
          <div>
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <span className="ml-1.5 text-xs text-muted-foreground">(doel)</span>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${bgColor}`}>
          {getGoalLabel(status)}
        </span>
      </div>
      <div className="mb-1.5 text-2xl font-bold text-foreground">
        {current} <span className="text-sm font-normal text-muted-foreground">/ {goal} {unit}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {remaining > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Nog <span className="font-semibold text-foreground">{remaining} {unit}</span> nodig vandaag
        </p>
      )}
    </div>
  );
}
