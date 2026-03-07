import Mascot from '@/components/Mascot';
import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  mascotMood?: 'greeting' | 'thinking' | 'happy' | 'neutral';
  mascotMessage?: string;
}

export default function PageHeader({ title, subtitle, action, mascotMood = 'neutral', mascotMessage }: PageHeaderProps) {
  return (
    <div className="relative mb-6">
      {/* Header card with extra top padding for mascot space */}
      <div className="relative rounded-2xl gradient-header pt-20 p-5 shadow-md overflow-visible mt-28">
        <div className="flex items-end gap-4">
          {/* Mascot - anchored bottom-right, popping out of the card */}
          <div className="absolute -top-14 right-4 z-10">
            <Mascot mood={mascotMood} className="h-32 w-auto drop-shadow-xl" />
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1 pr-24">
            <div className="flex items-start justify-between">
              <h1 className="font-display text-2xl font-bold text-primary-foreground">{title}</h1>
              {action && <div className="shrink-0">{action}</div>}
            </div>

            {mascotMessage && (
              <motion.div
                className="mt-2.5 relative"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                {/* Speech bubble */}
                <div className="rounded-2xl rounded-tr-sm bg-primary-foreground/20 px-4 py-2.5 backdrop-blur-sm border border-primary-foreground/10">
                  <p className="text-sm text-primary-foreground leading-relaxed">
                    {mascotMessage}
                  </p>
                </div>
                {/* Bubble tail pointing to mascot */}
                <div className="absolute -right-1 top-2 h-3 w-3 rotate-45 bg-primary-foreground/20 border-r border-t border-primary-foreground/10" />
              </motion.div>
            )}

            {!mascotMessage && subtitle && (
              <p className="mt-1 text-sm text-primary-foreground/80">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
