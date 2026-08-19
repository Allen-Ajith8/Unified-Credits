import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LoadingScreen = ({ ready, onSkip }) => {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState('');

  // Simulate progress
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (ready) return 100;
        // Slow down as we approach 90 to simulate real loading
        const increment = prev < 60 ? 3 : prev < 85 ? 1 : 0.3;
        return Math.min(prev + increment, 90);
      });
    }, 80);
    return () => clearInterval(interval);
  }, [ready]);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // When ready, snap to 100 and auto-dismiss
  useEffect(() => {
    if (ready) {
      setProgress(100);
    }
  }, [ready]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F4F5F7]"
    >
      {/* Subtle star particles in background */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 60 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-[#0F2350]"
            style={{
              width: Math.random() * 2 + 1,
              height: Math.random() * 2 + 1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.1, 0.6, 0.1],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Logo & Text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 text-center"
      >
        {/* Logo Mark */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-white/40 border border-[#0F2350]/15 backdrop-blur-xl flex items-center justify-center p-2 shadow-xl">
            <img src="/uce-logo.svg" alt="UCE Logo" className="w-full h-full object-contain rounded-xl" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold text-[#0F2350] mb-3 tracking-tight">
          Unified Credit Engine
        </h1>
        <p className="text-[#0F2350]/50 text-sm md:text-base mb-12">
          Initializing 3D network constellation{dots}
        </p>

        {/* Progress Bar */}
        <div className="w-64 md:w-80 mx-auto mb-8">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #0F2350, #006A67, #4A2C76)',
                width: `${progress}%`,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex justify-between mt-3">
            <span className="text-[#0F2350]/30 text-xs">
              {progress < 100 ? 'Loading 3D graph...' : 'Ready'}
            </span>
            <span className="text-[#0F2350]/30 text-xs font-mono">
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Skip Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          onClick={onSkip}
          className="px-6 py-2.5 rounded-full text-sm text-[#0F2350]/60 border border-white/15 hover:text-[#0F2350] hover:border-white/40 hover:bg-white/5 transition-all duration-300 cursor-pointer"
        >
          Skip →
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default LoadingScreen;
