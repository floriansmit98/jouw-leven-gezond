import { motion } from 'framer-motion';

export type MascotMood = 'greeting' | 'thinking' | 'happy' | 'neutral';

interface MascotProps {
  mood?: MascotMood;
  className?: string;
}

export default function Mascot({ mood = 'neutral', className = '' }: MascotProps) {
  const isWaving = mood === 'greeting';
  const isThinking = mood === 'thinking';
  const isHappy = mood === 'happy';

  return (
    <motion.svg
      viewBox="0 0 120 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* === LEGS === */}
      {/* Left leg */}
      <rect x="42" y="162" width="12" height="24" rx="6" className="fill-primary/25 stroke-primary" strokeWidth="2" />
      {/* Right leg */}
      <rect x="66" y="162" width="12" height="24" rx="6" className="fill-primary/25 stroke-primary" strokeWidth="2" />
      {/* Left shoe */}
      <ellipse cx="48" cy="188" rx="10" ry="5" className="fill-primary stroke-primary" strokeWidth="1.5" />
      {/* Right shoe */}
      <ellipse cx="72" cy="188" rx="10" ry="5" className="fill-primary stroke-primary" strokeWidth="1.5" />

      {/* === BODY === */}
      <ellipse cx="60" cy="138" rx="28" ry="32" className="fill-primary-foreground stroke-primary" strokeWidth="2.5" />

      {/* Lab coat - V-neck */}
      <path d="M46 115 L60 155 L74 115" className="stroke-primary/30" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Lab coat pocket */}
      <rect x="65" y="130" width="12" height="8" rx="2" className="stroke-primary/25" strokeWidth="1.5" fill="none" />

      {/* Coat buttons */}
      <circle cx="60" cy="128" r="1.5" className="fill-primary/30" />
      <circle cx="60" cy="138" r="1.5" className="fill-primary/30" />
      <circle cx="60" cy="148" r="1.5" className="fill-primary/30" />

      {/* Stethoscope */}
      <path d="M50 108 Q42 120 44 135 Q46 145 50 148" className="stroke-accent" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="150" r="3.5" className="fill-accent stroke-accent" strokeWidth="1" />
      <circle cx="50" cy="150" r="1.5" className="fill-primary-foreground" />

      {/* === LEFT ARM === */}
      <motion.g>
        <path d="M32 120 Q22 135 26 152" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="26" cy="154" r="5" className="fill-primary-foreground stroke-primary" strokeWidth="2" />
      </motion.g>

      {/* === RIGHT ARM === */}
      {isWaving ? (
        <motion.g
          animate={{ rotate: [0, -8, 0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '88px', originY: '120px' }}
        >
          <path d="M88 120 Q98 105 94 85" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="94" cy="83" r="5" className="fill-primary-foreground stroke-primary" strokeWidth="2" />
          {/* Fingers spread for wave */}
          <line x1="92" y1="78" x2="90" y2="74" className="stroke-primary" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="94" y1="78" x2="94" y2="73" className="stroke-primary" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="96" y1="78" x2="98" y2="74" className="stroke-primary" strokeWidth="1.5" strokeLinecap="round" />
        </motion.g>
      ) : isThinking ? (
        <motion.g>
          <path d="M88 120 Q96 112 82 88" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="81" cy="86" r="5" className="fill-primary-foreground stroke-primary" strokeWidth="2" />
        </motion.g>
      ) : (
        <motion.g>
          <path d="M88 120 Q98 135 94 152" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="94" cy="154" r="5" className="fill-primary-foreground stroke-primary" strokeWidth="2" />
        </motion.g>
      )}

      {/* === HEAD === */}
      <circle cx="60" cy="62" r="28" className="fill-primary-foreground stroke-primary" strokeWidth="2.5" />

      {/* Hair */}
      <path d="M34 55 Q38 32 60 30 Q82 32 86 55" className="stroke-primary" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M38 50 Q42 36 60 34 Q78 36 82 50" className="fill-primary/15" />

      {/* Eyebrows */}
      <path d="M46 50 Q50 47 54 50" className="stroke-foreground/40" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M66 50 Q70 47 74 50" className="stroke-foreground/40" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Eyes */}
      {isHappy || isWaving ? (
        <>
          <path d="M47 57 Q50 53 53 57" className="stroke-foreground" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M67 57 Q70 53 73 57" className="stroke-foreground" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="50" cy="56" r="3" className="fill-foreground" />
          <circle cx="70" cy="56" r="3" className="fill-foreground" />
          <circle cx="51" cy="55" r="1" className="fill-primary-foreground" />
          <circle cx="71" cy="55" r="1" className="fill-primary-foreground" />
        </>
      )}

      {/* Nose */}
      <path d="M59 63 Q60 66 62 63" className="stroke-foreground/30" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Mouth */}
      {isHappy || isWaving ? (
        <path d="M52 70 Q60 78 68 70" className="stroke-foreground" strokeWidth="2" strokeLinecap="round" fill="none" />
      ) : isThinking ? (
        <>
          <circle cx="67" cy="72" r="2.5" className="fill-foreground/40" />
          {/* Thought dots */}
          <circle cx="88" cy="72" r="2" className="fill-primary/30" />
          <circle cx="95" cy="65" r="2.8" className="fill-primary/20" />
        </>
      ) : (
        <path d="M54 71 Q60 74 66 71" className="stroke-foreground/50" strokeWidth="2" strokeLinecap="round" fill="none" />
      )}

      {/* Blush */}
      <ellipse cx="42" cy="66" rx="5" ry="2.5" className="fill-destructive/10" />
      <ellipse cx="78" cy="66" rx="5" ry="2.5" className="fill-destructive/10" />

      {/* === FLOATING ANIMATION for gentle breathing === */}
      <animateTransform
        attributeName="transform"
        type="translate"
        values="0,0; 0,-3; 0,0"
        dur="3s"
        repeatCount="indefinite"
      />
    </motion.svg>
  );
}
