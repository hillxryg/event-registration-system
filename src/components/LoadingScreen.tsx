import { motion } from 'motion/react';

interface LoadingScreenProps {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading PassFlow…' }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pastel-mesh-bg flex min-h-screen items-center justify-center p-4"
    >
      <div className="liquid-glass flex w-full max-w-xs flex-col items-center gap-6 px-8 py-10 text-center">
        <div className="relative flex size-24 items-center justify-center">
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400/40 to-fuchsia-300/40 blur-xl"
            animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.img
            src="/passflow-logo.svg"
            alt="PassFlow"
            className="relative size-16"
            animate={{ y: [0, -8, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="text-xl font-extrabold tracking-tight text-[#18181B]">PassFlow</span>
          <p className="text-sm font-semibold text-[#18181B]/60">{message}</p>
        </div>

        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/60">
          <motion.div
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-violet-500 via-[#bbaeec] to-[#f0c9ef]"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    </div>
  );
}