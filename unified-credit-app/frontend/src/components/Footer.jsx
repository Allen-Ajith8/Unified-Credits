import React from 'react';
import { GitBranch, FileText, Code } from 'lucide-react';

const Footer = () => (
  <footer className="relative z-10 py-12 px-6">
    <div className="max-w-6xl mx-auto glass-subtle rounded-3xl p-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
          <div className="text-lg font-semibold text-[#0F2350] mb-1 flex items-center justify-center md:justify-start gap-2">
            <div className="w-6 h-6 rounded-md bg-[#0F2350] flex items-center justify-center">
              <span className="text-[#0F2350] text-[10px] font-bold">UCE</span>
            </div>
            Unified Credit Engine
          </div>
          <p className="text-[#86868B] text-sm">
            From reactive debt assessment to proactive, capacity-based lending.
          </p>
        </div>
        <div className="flex gap-6 text-[#6E6E73]">
          <a href="#" className="hover:text-[#0F2350] transition-colors flex items-center gap-2 text-sm">
            <FileText size={15} /> Docs
          </a>
          <a href="#" className="hover:text-[#0F2350] transition-colors flex items-center gap-2 text-sm">
            <Code size={15} /> API
          </a>
          <a href="#" className="hover:text-[#0F2350] transition-colors flex items-center gap-2 text-sm">
            <GitBranch size={15} /> GitHub
          </a>
        </div>
      </div>
      <div className="text-center text-[#86868B] text-xs mt-8 pt-6 border-t border-black/5">
        Unified Credit Engine © 2026. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
