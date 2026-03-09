import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  mascotMessage?: string;
}

export default function PageHeader({ title, subtitle, action, mascotMessage }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="rounded-2xl gradient-header p-5 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold text-primary-foreground">{title}</h1>

            {mascotMessage && (
              <motion.p
                className="mt-1.5 text-sm text-primary-foreground/80 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                {mascotMessage}
              </motion.p>
            )}

            {!mascotMessage && subtitle && (
              <p className="mt-1 text-sm text-primary-foreground/80">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    </div>
  );
}
