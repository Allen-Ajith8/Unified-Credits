import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, ShieldAlert, Target } from 'lucide-react';

const InsightsSection = () => {
  const rocData = [
    { fpr: 0, modelA: 0, modelB: 0 },
    { fpr: 0.1, modelA: 0.2, modelB: 0.35 },
    { fpr: 0.2, modelA: 0.38, modelB: 0.55 },
    { fpr: 0.3, modelA: 0.51, modelB: 0.68 },
    { fpr: 0.4, modelA: 0.62, modelB: 0.78 },
    { fpr: 0.5, modelA: 0.71, modelB: 0.85 },
    { fpr: 0.6, modelA: 0.79, modelB: 0.90 },
    { fpr: 0.7, modelA: 0.85, modelB: 0.94 },
    { fpr: 0.8, modelA: 0.90, modelB: 0.97 },
    { fpr: 0.9, modelA: 0.95, modelB: 0.99 },
    { fpr: 1, modelA: 1, modelB: 1 },
  ];

  return (
    <section className="py-24 px-6 relative z-10" id="insights">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#0F2350] mb-4">Empirical Results</h2>
          <div className="w-24 h-1 bg-[#0F2350] mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="glass rounded-3xl p-6"
          >
            <h3 className="text-xl font-semibold text-[#0F2350] mb-6">ROC-AUC Comparison</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rocData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="fpr" stroke="#86868B" label={{ value: 'False Positive Rate', position: 'insideBottomRight', offset: -10, fill: '#86868B' }} />
                  <YAxis stroke="#86868B" label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', fill: '#86868B' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(0,0,0,0.1)', color: '#0F2350', borderRadius: '12px' }}
                  />
                  <Legend verticalAlign="top" height={36}/>
                  <Line type="monotone" dataKey="modelA" name="Baseline (0.6909)" stroke="#86868B" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="modelB" name="Network + Engine (0.7277)" stroke="#0F2350" strokeWidth={2} dot={false} />
                  <Line type="dashed" dataKey="fpr" name="Random" stroke="rgba(0,0,0,0.1)" strokeWidth={1} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
              <div className="text-[#006A67] mb-4"><TrendingUp size={28} /></div>
              <div className="text-sm text-[#6E6E73] mb-1">ROC-AUC Lift</div>
              <div className="text-2xl font-bold text-[#0F2350]">0.691 → 0.728</div>
              <div className="text-sm font-medium text-[#006A67] mt-2">+3.68% Improvement</div>
            </div>

            <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
              <div className="text-[#006A67] mb-4"><Target size={28} /></div>
              <div className="text-sm text-[#6E6E73] mb-1">Recall Lift</div>
              <div className="text-2xl font-bold text-[#0F2350]">18.50% → 22.54%</div>
              <div className="text-sm font-medium text-[#006A67] mt-2">+4.05% Improvement</div>
            </div>

            <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
              <div className="text-[#D4AF37] mb-4"><Users size={28} /></div>
              <div className="text-sm text-[#6E6E73] mb-1">Strongest Predictor</div>
              <div className="text-xl font-bold text-[#0F2350] break-words">clustering_coefficient</div>
              <div className="text-sm font-medium text-[#D4AF37] mt-2">Weight: +0.6076</div>
            </div>

            <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
              <div className="text-[#4A2C76] mb-4"><ShieldAlert size={28} /></div>
              <div className="text-sm text-[#6E6E73] mb-1">Contagion Effect</div>
              <div className="text-2xl font-bold text-[#0F2350]">45.29% <span className="text-sm font-normal text-[#6E6E73]">vs</span> 23.70%</div>
              <div className="text-sm font-medium text-[#4A2C76] mt-2">Inside vs Outside Clusters</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default InsightsSection;
