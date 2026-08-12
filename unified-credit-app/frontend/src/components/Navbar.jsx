import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const Navbar = ({ isConnected }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${
        scrolled
          ? 'bg-white/70 backdrop-blur-2xl border-b border-white/20 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0F2350] flex items-center justify-center">
            <span className="text-[#0F2350] text-xs font-bold">UCE</span>
          </div>
          <span className={`text-lg font-semibold tracking-tight ${scrolled ? 'text-[#0F2350]' : 'text-[#0F2350]'}`}>
            Unified Credit Engine
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-6">
            {['Overview', 'Methodology', 'Insights'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className={`text-sm font-medium transition-colors ${
                  scrolled ? 'text-[#6E6E73] hover:text-[#0F2350]' : 'text-[#0F2350]/70 hover:text-[#0F2350]'
                }`}>
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#006A67] animate-pulse' : 'bg-[#4A2C76]'}`} />
            <span className={`text-xs ${scrolled ? 'text-[#86868B]' : 'text-[#0F2350]/50'}`}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
