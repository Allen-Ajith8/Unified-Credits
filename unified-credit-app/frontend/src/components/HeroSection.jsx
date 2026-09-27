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
      <motion.div variants={item} className="flex flex-wrap gap-5 justify-center mt-4">
        {/* Apple-style Liquid Glass Primary Button */}
        <a href="#dashboard"
          className="relative group px-8 py-4 rounded-3xl bg-white/10 dark:bg-white/5 backdrop-blur-2xl backdrop-saturate-[180%] backdrop-brightness-110 border border-white/20 dark:border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),_0_8px_32px_rgba(0,0,0,0.1)] text-[#0F2350] dark:text-white text-sm font-semibold hover:bg-white/20 dark:hover:bg-white/10 transition-all hover:scale-[1.02] overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-2">
            View Live Dashboard 
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:translate-y-0.5 transition-transform"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
          </span>
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </a>

        {/* Apple-style Liquid Glass Secondary Button */}
        <a href="#methodology"
          className="relative px-8 py-4 rounded-3xl bg-black/5 dark:bg-black/20 backdrop-blur-2xl backdrop-saturate-[180%] border border-[#0F2350]/10 dark:border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.05)] text-[#0F2350]/80 dark:text-white/80 text-sm font-semibold hover:bg-black/10 dark:hover:bg-black/40 transition-all hover:scale-[1.02]"
        >
          Explore Methodology
        </a>
      </motion.div>
    </motion.div>
  </section>
);

export default HeroSection;
