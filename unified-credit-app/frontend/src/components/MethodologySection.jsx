import React, { useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ChevronLeft, ChevronRight, Workflow, Network, ShieldCheck } from 'lucide-react';
import { engineMetrics } from '../data/dashboardMetrics';

const MethodologySection = ({ activeMode }) => {
  const scrollRef = useRef(null);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [activeIndex, setActiveIndex] = useState(0);

  const activeData = activeMode === 'c' ? engineMetrics.b : engineMetrics[activeMode]; // Default to b for comparison mode methodology

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
            <PolarGrid stroke="rgba(0,0,0,0.08)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#6E6E73', fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
            <Radar name="Feature Importance" dataKey="A" stroke="#0F2350" fill="#0F2350" fillOpacity={0.15} />
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
            { view: 'Digital View', edges: 458, desc: 'Shared device_id → Fraud Rings', pct: 27 },
            { view: 'Geospatial View', edges: 162, desc: 'Shared ip_address → Household Risk', pct: 10 },
            { view: 'Socio-Economic', edges: 1053, desc: 'Shared employer_id → Layoff Contagion', pct: 63 },
          ].map((v, i) => (
            <div key={i} className="bg-black/[0.03] border border-black/5 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[#0F2350] font-semibold text-sm">{v.view}</span>
                <span className="text-[#0F2350] font-mono text-sm">{v.edges} edges</span>
              </div>
              <div className="w-full bg-black/5 rounded-full h-2 mb-2">
                <div className="bg-[#0F2350] h-2 rounded-full transition-all duration-1000" style={{ width: `${v.pct}%` }} />
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
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={true} vertical={false} />
            <XAxis type="number" stroke="#86868B" fontSize={11} />
            <YAxis dataKey="name" type="category" stroke="#86868B" fontSize={11} width={80} />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              contentStyle={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: '#0F2350' }}
            />
            <Bar dataKey="weight" radius={[0, 4, 4, 0]} barSize={16}>
              {weightsData.map((entry, index) => (
                <motion.rect key={index} fill={entry.weight > 0 ? '#4A2C76' : '#006A67'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ),
    },
  ];

  const scrollTo = (direction) => {
    if (!scrollRef.current) return;
    let newIndex = activeIndex;
    if (direction === 'left') {
      newIndex = Math.max(0, activeIndex - 1);
    } else {
      newIndex = Math.min(pillars.length - 1, activeIndex + 1);
    }
    const children = Array.from(scrollRef.current.children);
    if (children[newIndex]) {
      children[newIndex].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      setActiveIndex(newIndex);
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const scrollLeft = container.scrollLeft;
    const cardWidth = container.firstChild?.offsetWidth || 1;
    const newIndex = Math.round(scrollLeft / (cardWidth + 24));
    setActiveIndex(newIndex);
  };

  return (
    <section className="py-24 overflow-hidden relative z-10" id="methodology" ref={sectionRef}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="px-6 mb-12"
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <div className="text-[#0F2350] font-mono text-xs mb-3 tracking-widest uppercase">How it works</div>
            <h2 className="text-4xl md:text-5xl font-semibold text-[#0F2350] tracking-tight">Core Methodology</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-2 mr-4">
              {pillars.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const children = Array.from(scrollRef.current.children);
                    if (children[i]) {
                      children[i].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                      setActiveIndex(i);
                    }
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === activeIndex ? 'bg-[#0071E3] w-6' : 'bg-white/20 w-2 hover:bg-white/40'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => scrollTo('left')}
              disabled={activeIndex === 0}
              className="p-3 rounded-full glass-subtle text-[#0F2350] hover:bg-white/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollTo('right')}
              disabled={activeIndex === pillars.length - 1}
              className="p-3 rounded-full glass-subtle text-[#0F2350] hover:bg-white/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Horizontal Carousel */}
      <motion.div
        initial={{ opacity: 0, x: 60 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide px-6 md:px-[calc((100vw-72rem)/2+1.5rem)] pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {pillars.map((pillar, index) => (
            <div
              key={index}
              className="snap-start flex-shrink-0 w-[85vw] md:w-[72rem] glass rounded-3xl overflow-hidden"
            >
              <div className="flex flex-col lg:flex-row h-full">
                {/* Left: Content */}
                <div className="flex-1 p-8 md:p-12 flex flex-col justify-center">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 border border-[#0071E3]/20 flex items-center justify-center text-[#0071E3]">
                      {pillar.icon}
                    </div>
                    <div className="text-[#0071E3]/30 font-mono text-3xl font-bold">{pillar.num}</div>
                  </div>
                  <h3 className="text-3xl md:text-4xl font-semibold text-[#0F2350] tracking-tight mb-2">{pillar.title}</h3>
                  <div className="text-[#0071E3] font-mono text-sm mb-6 tracking-wide">{pillar.subtitle}</div>
                  <p className="text-[#6E6E73] text-lg leading-relaxed mb-8 max-w-xl">{pillar.desc}</p>

                  <div className="flex flex-wrap gap-3">
                    {pillar.highlights.map((h, i) => (
                      <div key={i} className="bg-black/[0.03] border border-black/5 rounded-xl px-4 py-3">
                        <div className="text-xl font-semibold text-[#0F2350]">{h.value}</div>
                        <div className="text-xs text-[#86868B] uppercase tracking-wider mt-1">{h.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Chart */}
                <div className="flex-1 p-6 md:p-8 flex items-center justify-center min-h-[350px] bg-black/[0.02]">
                  <div className="w-full h-full min-h-[300px]">
                    {pillar.chart}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default MethodologySection;
