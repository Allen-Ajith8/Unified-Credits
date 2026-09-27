import React from 'react';
import { GitBranch, FileText, Code, BookOpen } from 'lucide-react';

const AnimatedLink = ({ children, href, className }) => {
  return (
    <a
      href={href}
      target="_blank"
      className={`group relative flex items-center text-[#6E6E73] hover:text-[#0F2350] dark:hover:text-white transition-colors text-sm ${className || ''} 
        before:pointer-events-none before:absolute before:left-0 before:top-[1.6em] before:h-[0.05em] before:w-full before:bg-current before:content-[''] 
        before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] 
        hover:before:origin-left hover:before:scale-x-100`}
    >
      {children}
      <svg
        className="ml-[0.3em] mt-[0em] size-[0.55em] translate-y-1 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        fill="none"
        viewBox="0 0 10 10"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        ></path>
      </svg>
    </a>
  );
};

const Footer = () => (
  <footer className="relative z-10 py-12 px-6">
    <div className="max-w-6xl mx-auto glass-subtle rounded-3xl p-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
          <div className="text-lg font-semibold text-[#0F2350] dark:text-white mb-1 flex items-center justify-center md:justify-start gap-2">
            <img src="/uce-logo.svg" alt="UCE Logo" className="w-6 h-6 rounded-md shadow-sm" />
            Unified Credit Engine
          </div>
          <p className="text-[#86868B] text-sm">
            From reactive debt assessment to proactive, capacity-based lending.
          </p>
        </div>
        <div className="flex gap-6 text-[#6E6E73]">
          <AnimatedLink href="#">
            <FileText size={15} className="mr-1.5" /> Docs
          </AnimatedLink>
          <AnimatedLink href="#">
            <Code size={15} className="mr-1.5" /> API
          </AnimatedLink>
          <AnimatedLink href="#">
            <BookOpen size={15} className="mr-1.5" /> Research Papers
          </AnimatedLink>
          <AnimatedLink href="https://github.com/Allen-Ajith8/Unified-Credits">
            <GitBranch size={15} className="mr-1.5" /> GitHub
          </AnimatedLink>
        </div>
      </div>
      <div className="text-center text-[#86868B] text-xs mt-8 pt-6 border-t border-black/5">
        Unified Credit Engine © 2026. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
