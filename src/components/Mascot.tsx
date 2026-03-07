import { motion } from 'framer-motion';
import mascotGreeting from '@/assets/mascot-greeting.png';
import mascotThinking from '@/assets/mascot-thinking.png';
import mascotHappy from '@/assets/mascot-happy.png';
import mascotNeutral from '@/assets/mascot-neutral.png';

export type MascotMood = 'greeting' | 'thinking' | 'happy' | 'neutral';

const mascotImages: Record<MascotMood, string> = {
  greeting: mascotGreeting,
  thinking: mascotThinking,
  happy: mascotHappy,
  neutral: mascotNeutral,
};

interface MascotProps {
  mood?: MascotMood;
  className?: string;
}

export default function Mascot({ mood = 'neutral', className = '' }: MascotProps) {
  return (
    <motion.img
      src={mascotImages[mood]}
      alt="Uw gezondheidsassistent"
      className={`object-contain ${className}`}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      draggable={false}
    />
  );
}
