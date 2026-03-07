import Mascot from '@/components/Mascot';
import type { MascotMood } from '@/components/Mascot';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  mascotMood?: 'greeting' | 'thinking' | 'happy' | 'neutral';
  mascotMessage?: string;
}

export default function PageHeader({ title, subtitle, action, mascotMood = 'neutral', mascotMessage }: PageHeaderProps) {
  return (
    <div className="mb-6 rounded-2xl gradient-header p-5 shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Mascot mood={mascotMood} className="h-14 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-primary-foreground">{title}</h1>
            {mascotMessage ? (
              <p className="mt-1 text-sm text-primary-foreground/90 italic">"{mascotMessage}"</p>
            ) : subtitle ? (
              <p className="mt-1 text-sm text-primary-foreground/80">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action && <div className="shrink-0 ml-2">{action}</div>}
      </div>
    </div>
  );
}
