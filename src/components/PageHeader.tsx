import Mascot from '@/components/Mascot';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  mascotMood?: 'greeting' | 'thinking' | 'happy' | 'neutral';
  mascotMessage?: string;
}

export default function PageHeader({ title, subtitle, action, mascotMood = 'neutral', mascotMessage }: PageHeaderProps) {
  return (
    <div className="relative mb-6 pt-2">
      {/* Mascot - pops out above the card */}
      <div className="relative z-10 flex justify-end pr-4 -mb-12">
        <Mascot mood={mascotMood} className="h-28 w-auto drop-shadow-lg" />
      </div>

      {/* Header card */}
      <div className="relative rounded-2xl gradient-header p-5 pb-4 shadow-md">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 pr-20">
            <h1 className="font-display text-2xl font-bold text-primary-foreground">{title}</h1>
            {mascotMessage && (
              <div className="mt-2 inline-block rounded-xl bg-primary-foreground/15 px-3 py-1.5 backdrop-blur-sm">
                <p className="text-sm text-primary-foreground/95">
                  {mascotMessage}
                </p>
              </div>
            )}
            {!mascotMessage && subtitle && (
              <p className="mt-1 text-sm text-primary-foreground/80">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0 ml-2 mt-12">{action}</div>}
        </div>
      </div>
    </div>
  );
}
