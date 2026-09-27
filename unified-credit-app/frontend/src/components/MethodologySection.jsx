import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useInView } from 'framer-motion';
import { AnimatedTitle } from './AnimatedTitle';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { Workflow, Network, ShieldCheck } from 'lucide-react';
import { engineMetrics } from '../data/dashboardMetrics';
import { useTheme } from 'next-themes';

const MethodologySection = ({ activeMode }) => {
  const { resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [activeIndex, setActiveIndex] = useState(null);

  const activeData = activeMode === 'c' ? engineMetrics.b : engineMetrics[activeMode];

  const radarData = [
    { subject: 'Savings Bal', A: 120, fullMark: 150 },
    { subject: 'Salary Reg', A: 98, fullMark: 150 },
    { subject: 'EMI Bounces', A: 86, fullMark: 150 },
    { subject: 'Credit Util', A: 99, fullMark: 150 },
    { subject: 'Txn Vol', A: 85, fullMark: 150 },
    { subject: 'Overdraft', A: 65, fullMark: 150 },
  ];

  const weightsData = activeData.featureWeights;

  const pillars = [
    {
      num: '001',
      icon: <Workflow className="w-7 h-7" />,
      title: activeData.methodology.title,
      subtitle: activeData.methodology.steps[0],
      desc: activeData.methodology.description,
      highlights: [
        { label: 'Feature Count', value: activeMode === 'b' || activeMode === 'c' ? '60+' : '28' },
        { label: 'Model Core', value: 'XGBoost' },
        { label: 'Network Info', value: activeMode === 'b' || activeMode === 'c' ? 'Included' : 'None' },
      ],
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: isDark ? '#A1A1AA' : '#6E6E73', fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
            <Radar name="Feature Importance" dataKey="A" stroke={isDark ? "#60A5FA" : "#0F2350"} fill={isDark ? "#60A5FA" : "#0F2350"} fillOpacity={0.15} />
          </RadarChart>
        </ResponsiveContainer>
      ),
    },
    {
      num: '002',
      icon: <Network className="w-7 h-7" />,
      title: activeMode === 'b' || activeMode === 'c' ? 'Multi-View Relational Network' : 'Tabular Processing Pipeline',
      subtitle: activeData.methodology.steps[1],
      desc: activeMode === 'b' || activeMode === 'c' ? 'Treating customers as interconnected nodes sharing IPs, devices, and employers to map hidden financial contagion and fraud rings.' : 'Sequential preprocessing pipeline mapping raw attributes to standard scales before boosting.',
      highlights: [
        { label: 'Step 2', value: activeData.methodology.steps[1].split(' ')[0] },
        { label: 'Step 3', value: activeData.methodology.steps[2].split(' ')[0] },
      ],
      chart: (
        <div className="flex flex-col gap-3 w-full h-full justify-center px-2">
          {[
            { view: 'Digital View', edges: 458, desc: 'Shared device_id → Fraud Rings', pct: 22 },
            { view: 'Geospatial View', edges: 162, desc: 'Shared ip_address → Household Risk', pct: 8 },
            { view: 'Socio-Economic', edges: 1053, desc: 'Shared employer_id → Layoff Contagion', pct: 50 },
            { view: 'Geographic Risk', edges: 159, desc: 'Shared zip_code → Regional Collapse', pct: 8 },
            { view: 'Corporate Contagion', edges: 419, desc: 'Shared employer_name → Mass Layoffs', pct: 12 },
          ].map((v, i) => (
            <div key={i} className="bg-black/[0.03] border border-black/5 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#0F2350] dark:text-white font-semibold text-sm">{v.view}</span>
                <span className="text-[#0F2350] dark:text-white font-mono text-sm">{v.edges} edges</span>
              </div>
              <div className="w-full bg-black/5 dark:bg-white/10 rounded-full h-2 mb-2">
                <div className="bg-[#0F2350] dark:bg-white h-2 rounded-full transition-all duration-1000" style={{ width: `${v.pct}%` }} />
              </div>
              <div className="text-[#86868B] text-xs">{v.desc}</div>
            </div>
          ))}
        </div>
      ),
    },
    {
      num: '003',
      icon: <ShieldCheck className="w-7 h-7" />,
      title: 'Explainable Scorecard Model',
      subtitle: activeData.methodology.steps[activeData.methodology.steps.length - 1],
      desc: 'Ensuring 100% regulatory compliance. Every credit decision comes with exact point-deduction explanations, satisfying FCRA adverse action requirements.',
      highlights: [
        { label: 'Model Type', value: 'XGBoost' },
        { label: 'Top Predictor', value: activeData.featureWeights[0].name },
        { label: 'Explainability', value: 'SHAP' },
      ],
      chart: (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={weightsData} margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"} horizontal={true} vertical={false} />
            <XAxis type="number" stroke={isDark ? "#A1A1AA" : "#86868B"} fontSize={11} />
            <YAxis dataKey="name" type="category" stroke={isDark ? "#A1A1AA" : "#86868B"} fontSize={11} width={80} />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              contentStyle={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: '#0F2350' }}
            />
            <Bar dataKey="weight" radius={[0, 4, 4, 0]} barSize={16}>
              {weightsData.map((entry, index) => (
                <Cell key={index} fill={isDark ? '#FFFFFF' : '#0F2350'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ),
    },
  ];


  return (
    <section className="py-24 overflow-hidden relative z-10 scroll-mt-24" id="methodology" ref={sectionRef}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="px-6 mb-12"
      >
        <div className="max-w-6xl mx-auto flex flex-col justify-start items-start gap-2">
          <div className="text-[#0F2350] dark:text-white font-mono text-xs tracking-widest uppercase">How it works</div>
          <AnimatedTitle text="Core Methodology" className="text-4xl md:text-5xl font-semibold text-[#0F2350] dark:text-white tracking-tight justify-start" />
        </div>
      </motion.div>

      {/* Horizontal Carousel */}
      <motion.div
        initial={{ opacity: 0, x: 60 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <div 
          className="flex w-full items-center justify-center gap-4 px-6 mx-auto h-[600px] md:h-[500px]"
          onMouseLeave={() => setActiveIndex(null)}
        >
          {pillars.map((pillar, index) => (
            <motion.div
              key={index}
              className="relative cursor-pointer overflow-hidden rounded-3xl glass shrink-0"
              initial={{ width: "6rem", height: "100%" }}
              animate={{
                width: activeIndex === index ? "100%" : "6rem",
                height: "100%",
                maxWidth: activeIndex === index ? "72rem" : "6rem"
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setActiveIndex(index)}
              onHoverStart={() => setActiveIndex(index)}
            >
              <div className="flex flex-col lg:flex-row h-full w-[85vw] md:w-[72rem]">
                {/* Left: Content */}
                <div className="flex-[0_0_50%] p-8 md:p-12 flex flex-col justify-center">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3] shrink-0">
                      {pillar.icon}
                    </div>
                    <div className="text-[#0071E3]/30 font-mono text-3xl font-bold">{pillar.num}</div>
                  </div>
                  
                  <motion.div 
                    animate={{ opacity: activeIndex === index ? 1 : 0 }} 
                    transition={{ duration: 0.3 }}
                  >
                    <h3 className="text-3xl md:text-4xl font-semibold text-[#0F2350] dark:text-white tracking-tight mb-2 whitespace-nowrap">{pillar.title}</h3>
                    <div className="text-[#0071E3] font-mono text-sm mb-6 tracking-wide">{pillar.subtitle}</div>
                    <p className="text-[#6E6E73] text-lg leading-relaxed mb-8 max-w-xl">{pillar.desc}</p>

                    <div className="flex flex-wrap gap-3">
                      {pillar.highlights.map((h, i) => (
                        <div key={i} className="bg-black/[0.03] border border-black/5 rounded-xl px-4 py-3 shrink-0">
                          <div className="text-xl font-semibold text-[#0F2350] dark:text-white">{h.value}</div>
                          <div className="text-xs text-[#86868B] uppercase tracking-wider mt-1">{h.label}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* Right: Chart */}
                <div className="flex-[0_0_50%] p-6 md:p-8 flex items-center justify-center min-h-[350px] bg-black/[0.02]">
                  <motion.div 
                    className="w-full h-full min-h-[300px]"
                    animate={{ opacity: activeIndex === index ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {pillar.chart}
                  </motion.div>
                </div>
              </div>
              
              {/* Vertical Title when collapsed */}
              {activeIndex !== index && (
                <div className="absolute top-32 left-0 right-0 flex items-center justify-center pointer-events-none">
                  <div className="rotate-90 whitespace-nowrap text-[#0F2350] dark:text-white/60 font-semibold tracking-widest uppercase">
                    {pillar.title}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default MethodologySection;
