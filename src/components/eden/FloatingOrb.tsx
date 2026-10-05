import { motion } from "framer-motion";

interface FloatingOrbProps {
  size?: number;
  speed?: number;
  opacity?: number;
  className?: string;
}

export function FloatingOrb({ size = 300, speed = 20, opacity = 0.1, className = "" }: FloatingOrbProps) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 30% 30%, oklch(0.45 0.11 155), oklch(0.62 0.13 50), transparent 70%)",
        opacity,
      }}
      animate={{
        y: [0, -30, 0],
        x: [0, 20, 0],
        scale: [1, 1.05, 1],
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}
