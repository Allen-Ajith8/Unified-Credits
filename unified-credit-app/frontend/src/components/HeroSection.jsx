import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedTitle } from './AnimatedTitle';

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 }
  }
};

const item = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};

const HeroSection = () => (
  <section className="relative min-h-screen flex items-center justify-center px-6 pb-60" id="overview">
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="text-center max-w-4xl mx-auto"
    >
      <motion.div variants={item} className="mb-6">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[#0F2350]/5 dark:bg-white/10 border border-[#0F2350]/10 dark:border-white/10 text-[#0F2350]/70 dark:text-white/70 text-xs font-semibold tracking-widest uppercase">
          Data Science Project
        </span>
      </motion.div>
      <AnimatedTitle text="The Unified Credit Engine" className="text-5xl md:text-7xl lg:text-8xl font-bold text-[#0F2350] dark:text-white tracking-tight leading-[1.05] mb-6" />
      <motion.p variants={item}
        className="text-lg md:text-xl text-[#0F2350]/60 dark:text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed font-medium"
      >
        Integrating Cash Flow Analytics & Network Contagion Mapping for Holistic Risk Assessment
      </motion.p>
      <motion.div variants={item} className="flex flex-wrap gap-4 justify-center">
        <a href="#dashboard"
          className="px-8 py-3.5 rounded-full bg-[#0F2350] dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-[#006A67] dark:hover:bg-gray-200 transition-all hover:scale-105 shadow-lg shadow-[#0F2350]/20"
        >
          View Live Dashboard ↓
        </a>
        <a href="#methodology"
          className="px-8 py-3.5 rounded-full bg-white/50 dark:bg-white/10 backdrop-blur-xl border border-[#0F2350]/10 dark:border-white/10 text-[#0F2350] dark:text-white text-sm font-semibold hover:bg-white/80 dark:hover:bg-white/20 transition-all shadow-sm"
        >
          Explore Methodology
        </a>
      </motion.div>
    </motion.div>
  </section>
);

export default HeroSection;
