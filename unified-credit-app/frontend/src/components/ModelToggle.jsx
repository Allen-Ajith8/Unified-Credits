import React from 'react';
import { motion } from 'framer-motion';
import { TableProperties, Network, GitCompare } from 'lucide-react';
import { engineMetrics } from '../data/dashboardMetrics';

const ModelToggle = ({ activeMode, setActiveMode }) => {
  const options = [
    { id: 'a', icon: TableProperties, ...engineMetrics.a },
    { id: 'b', icon: Network, ...engineMetrics.b },
    { id: 'c', icon: GitCompare, ...engineMetrics.c },
  ];

  return (
    <div className="flex justify-center mb-8 w-full">
      <div className="glass rounded-full p-2 flex gap-2 relative shadow-lg">
        {options.map((option) => {
          const isActive = activeMode === option.id;
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              onClick={() => setActiveMode(option.id)}
              className={`relative flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-300 z-10`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSegment"
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: option.accentColor }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              
              <Icon className={`w-5 h-5 relative z-10 ${isActive ? 'text-white' : 'text-[#86868B]'}`} />
              <div className="flex flex-col items-start relative z-10">
                <span className={`text-sm font-semibold tracking-tight ${isActive ? 'text-white' : 'text-[#0F2350]'}`}>
                  {option.name}
                </span>
                <span className={`text-xs ${isActive ? 'text-white/80' : 'text-[#86868B]'}`}>
                  {option.subtitle}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ModelToggle;
