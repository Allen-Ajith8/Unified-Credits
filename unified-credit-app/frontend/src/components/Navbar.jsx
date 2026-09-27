import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ThemeToggleButton } from './ThemeToggle';

const Navbar = ({ isConnected, onOpen3D, onOpenChat }) => {
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
          ? 'bg-white/70 dark:bg-black/70 backdrop-blur-2xl border-b border-white/20 dark:border-white/10 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src="/uce-logo.svg" alt="UCE Logo" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className={`text-lg font-semibold tracking-tight text-[#0F2350] dark:text-white`}>
            Unified Credit Engine
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-6">
            {['Overview', 'Methodology', 'Insights'].map(item => (
              <a key={item} href={`#${item.toLowerCase()}`}
                className={`text-sm font-medium transition-colors text-[#0F2350]/70 hover:text-[#0F2350] dark:text-white/70 dark:hover:text-white`}>
                {item}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggleButton />
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#30D158] animate-pulse' : 'bg-[#FF453A]'}`} />
              <span className={`text-xs text-[#0F2350]/50 dark:text-white/50`}>
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            <button
              onClick={onOpenChat}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                scrolled 
                  ? 'bg-[#006A67] text-white hover:bg-[#005550] shadow-md' 
                  : 'bg-[#006A67]/10 dark:bg-white/10 text-[#006A67] dark:text-white hover:bg-[#006A67]/20 dark:hover:bg-white/20 border border-[#006A67]/20 dark:border-white/20'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              AI Copilot
            </button>
            <button
              onClick={onOpen3D}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
                scrolled 
                  ? 'bg-[#0F2350] dark:bg-white text-white dark:text-black hover:bg-[#006A67] dark:hover:bg-gray-200 shadow-md' 
                  : 'bg-[#0F2350]/10 dark:bg-white/10 text-[#0F2350] dark:text-white hover:bg-[#0F2350]/20 dark:hover:bg-white/20 border border-[#0F2350]/20 dark:border-white/20'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              3D View
            </button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
