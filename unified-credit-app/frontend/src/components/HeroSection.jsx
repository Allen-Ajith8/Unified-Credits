import React from 'react';
import { motion } from 'framer-motion';

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
        <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 text-[#0F2350]/80 text-xs font-medium tracking-widest uppercase">
          Data Science Project
        </span>
      </motion.div>
      <motion.h1 variants={item}
        className="text-5xl md:text-7xl lg:text-8xl font-semibold text-[#0F2350] tracking-tight leading-[1.05] mb-6"
      >
        The Unified<br />Credit Engine
      </motion.h1>
      <motion.p variants={item}
        className="text-lg md:text-xl text-[#0F2350]/50 max-w-2xl mx-auto mb-10 leading-relaxed"
      >
        Integrating Cash Flow Analytics & Network Contagion Mapping for Holistic Risk Assessment
      </motion.p>
      <motion.div variants={item} className="flex flex-wrap gap-4 justify-center">
        <a href="#dashboard"
          className="px-8 py-3.5 rounded-full bg-white text-[#0F2350] text-sm font-semibold hover:bg-white/90 transition-all hover:scale-105"
        >
          View Live Dashboard ↓
        </a>
        <a href="#methodology"
          className="px-8 py-3.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 text-[#0F2350] text-sm font-semibold hover:bg-white/20 transition-all"
        >
          Explore Methodology
        </a>
      </motion.div>
    </motion.div>
  </section>
);

export default HeroSection;
