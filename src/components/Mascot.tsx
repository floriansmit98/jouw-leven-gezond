import { motion } from 'framer-motion';

type MascotMood = 'greeting' | 'thinking' | 'happy' | 'neutral';

interface MascotProps {
  mood?: MascotMood;
  className?: string;
}

export default function Mascot({ mood = 'neutral', className = '' }: MascotProps) {
  // Arm position based on mood
  const isWaving = mood === 'greeting';
  const isThinking = mood === 'thinking';

  return (
    <motion.svg
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`h-16 w-auto ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Body - rounded friendly shape */}
      <ellipse cx="40" cy="72" rx="18" ry="22" className="fill-primary/20 stroke-primary" strokeWidth="2" />

      {/* Lab coat / vest detail */}
      <path d="M30 62 L40 85 L50 62" className="stroke-primary/40" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Stethoscope */}
      <path d="M34 58 Q30 65 33 72" className="stroke-accent" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="33" cy="73" r="2" className="fill-accent" />

      {/* Head */}
      <circle cx="40" cy="36" r="18" className="fill-primary-foreground stroke-primary" strokeWidth="2" />

      {/* Hair - simple clean top */}
      <path d="M24 30 Q28 18 40 17 Q52 18 56 30" className="fill-primary/30 stroke-primary" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Eyes */}
      {mood === 'happy' ? (
        <>
          <path d="M33 34 Q35 31 37 34" className="stroke-foreground" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M43 34 Q45 31 47 34" className="stroke-foreground" strokeWidth="2" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="35" cy="34" r="2" className="fill-foreground" />
          <circle cx="45" cy="34" r="2" className="fill-foreground" />
          {/* Tiny highlights */}
          <circle cx="35.8" cy="33.2" r="0.6" className="fill-primary-foreground" />
          <circle cx="45.8" cy="33.2" r="0.6" className="fill-primary-foreground" />
        </>
      )}

      {/* Mouth */}
      {mood === 'happy' || mood === 'greeting' ? (
        <path d="M36 41 Q40 45 44 41" className="stroke-foreground" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      ) : mood === 'thinking' ? (
        <circle cx="43" cy="42" r="1.5" className="fill-foreground/50" />
      ) : (
        <path d="M37 42 Q40 43 43 42" className="stroke-foreground/60" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      )}

      {/* Blush */}
      <ellipse cx="30" cy="39" rx="3" ry="1.5" className="fill-destructive/15" />
      <ellipse cx="50" cy="39" rx="3" ry="1.5" className="fill-destructive/15" />

      {/* Left arm - always down */}
      <motion.path
        d="M22 65 Q16 72 18 80"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* Right arm - waves when greeting, touches chin when thinking */}
      {isWaving ? (
        <motion.path
          d="M58 62 Q64 54 60 44"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          animate={{ d: ['M58 62 Q64 54 60 44', 'M58 62 Q66 52 62 42', 'M58 62 Q64 54 60 44'] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : isThinking ? (
        <path
          d="M58 62 Q62 56 52 45"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <path
          d="M58 65 Q64 72 62 80"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Hand detail for waving */}
      {isWaving && (
        <motion.circle
          cx="60"
          cy="43"
          r="3"
          className="fill-primary-foreground stroke-primary"
          strokeWidth="1.5"
          animate={{ cy: [43, 41, 43] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.svg>
  );
}
