import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, ShieldAlert, Target } from 'lucide-react';
import { engineMetrics } from '../data/dashboardMetrics';
import { useTheme } from 'next-themes';

const InsightsSection = ({ activeMode, apiData }) => {
  const { resolvedTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  const getAccentColor = (mode) => {
    if (!isDark) return engineMetrics[mode]?.accentColor || '#0F2350';
    if (mode === 'a') return '#3B82F6';
    if (mode === 'b') return '#A855F7';
    if (mode === 'c') return '#FACC15';
    return engineMetrics[mode]?.accentColor || '#0F2350';
  };

  // Merge real API data over placeholders for each engine
  const getEngineData = (mode) => {
    const placeholder = engineMetrics[mode] || {};
    const real = apiData?.[mode];
    if (!real) return { ...placeholder, accentColor: getAccentColor(mode) };
    return {
      ...placeholder,
      ...real,
      metrics: { ...placeholder.metrics, ...real.metrics },
      featureWeights: real.featureWeights || placeholder.featureWeights,
      rocCurve: real.rocCurve || placeholder.rocCurve,
      clusterComparison: real.clusterComparison || placeholder.clusterComparison,
      accentColor: getAccentColor(mode),
    };
  };

  const dataA = getEngineData('a');
  const dataB = getEngineData('b');
  const dataC = getEngineData('c');
  const activeData = activeMode === 'c' ? dataC : getEngineData(activeMode);

  // Create combined ROC data from real API curves or placeholders
  const rocCurveA = dataA.rocCurve || engineMetrics.a.rocCurve;
  const rocCurveB = dataB.rocCurve || engineMetrics.b.rocCurve;
  const maxLen = Math.max(rocCurveA.length, rocCurveB.length);
  const rocData = [];
  for (let i = 0; i < maxLen; i++) {
    const pointA = rocCurveA[Math.min(i, rocCurveA.length - 1)];
    const pointB = rocCurveB[Math.min(i, rocCurveB.length - 1)];
    rocData.push({
      fpr: pointA?.fpr ?? i / maxLen,
      modelA: pointA?.tpr ?? 0,
      modelB: pointB?.tpr ?? 0,
      random: pointA?.fpr ?? i / maxLen,
    });
  }

  return (
    <section className="py-24 px-6 relative z-10 scroll-mt-24" id="insights">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-[#0F2350] dark:text-white mb-4">Empirical Results</h2>
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
            <h3 className="text-xl font-semibold text-[#0F2350] dark:text-white mb-6">ROC-AUC Comparison</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rocData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="fpr" stroke={isDark ? "#A1A1AA" : "#86868B"} label={{ value: 'False Positive Rate', position: 'insideBottomRight', offset: -10, fill: '#86868B' }} />
                  <YAxis stroke={isDark ? "#A1A1AA" : "#86868B"} label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', fill: '#86868B' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderColor: 'rgba(0,0,0,0.1)', color: '#0F2350', borderRadius: '12px' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', marginTop: '10px' }} />
                  {(activeMode === 'a' || activeMode === 'c') && (
                    <Line type="monotone" dataKey="modelA" name={`Legacy (${dataA.metrics?.rocAuc?.toFixed(4) || '—'})`} stroke={activeMode === 'a' ? getAccentColor('a') : (isDark ? 'rgba(255,255,255,0.3)' : "#86868B")} strokeWidth={2} dot={false} />
                  )}
                  {(activeMode === 'b' || activeMode === 'c') && (
                    <Line type="monotone" dataKey="modelB" name={`Hybrid (${dataB.metrics?.rocAuc?.toFixed(4) || '—'})`} stroke={getAccentColor('b')} strokeWidth={2} dot={false} />
                  )}
                  <Line type="dashed" dataKey="random" name="Random Guess" stroke={isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)"} strokeWidth={1} dot={false} />
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
            {activeMode === 'c' ? (
              <>
                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#006A67] mb-4"><TrendingUp size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">ROC-AUC Lift</div>
                  <div className="text-2xl font-bold text-[#0F2350] dark:text-white">{dataA.metrics?.rocAuc?.toFixed(4) || '—'} → {dataB.metrics?.rocAuc?.toFixed(4) || '—'}</div>
                  <div className="text-sm font-medium text-[#006A67] mt-2">+{((dataC.metrics?.rocAucLift || 0) * 100).toFixed(2)}% Improvement</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#006A67] mb-4"><Target size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Recall Lift</div>
                  <div className="text-2xl font-bold text-[#0F2350] dark:text-white">{((dataA.metrics?.recall || 0) * 100).toFixed(2)}% → {((dataB.metrics?.recall || 0) * 100).toFixed(2)}%</div>
                  <div className="text-sm font-medium text-[#006A67] mt-2">+{((dataC.metrics?.recallLift || 0) * 100).toFixed(2)}% Improvement</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#D4AF37] mb-4"><Users size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">False Negatives Caught</div>
                  <div className="text-2xl font-bold text-[#0F2350] dark:text-white">{dataC.metrics?.falseNegativesCaught ?? activeData.metrics?.falseNegativesCaught ?? '—'}</div>
                  <div className="text-sm font-medium text-[#D4AF37] mt-2">Risky applicants correctly flagged</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#4A2C76] mb-4"><ShieldAlert size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Reclassified Nodes</div>
                  <div className="text-2xl font-bold text-[#0F2350] dark:text-white">{dataC.metrics?.reclassifiedNodes ?? '—'}</div>
                  <div className="text-sm font-medium text-[#4A2C76] mt-2">Predictions changed by GNN</div>
                </div>
              </>
            ) : (
              <>
                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#006A67] mb-4"><TrendingUp size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Model Accuracy</div>
                  <div className="text-2xl font-bold text-[#0F2350] dark:text-white">{(activeData.metrics.accuracy * 100).toFixed(2)}%</div>
                  <div className="text-sm font-medium text-[#006A67] mt-2">Overall correctness</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#006A67] mb-4"><Target size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Precision Score</div>
                  <div className="text-2xl font-bold text-[#0F2350] dark:text-white">{(activeData.metrics.precision * 100).toFixed(2)}%</div>
                  <div className="text-sm font-medium text-[#006A67] mt-2">True positives / Total predicted positive</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#D4AF37] mb-4"><Users size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Strongest Predictor</div>
                  <div className="text-xl font-bold text-[#0F2350] dark:text-white break-words">{activeData.featureWeights[0].name}</div>
                  <div className="text-sm font-medium text-[#D4AF37] mt-2">Weight: {activeData.featureWeights[0].weight}</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#4A2C76] mb-4"><ShieldAlert size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">F1 Score</div>
                  <div className="text-2xl font-bold text-[#0F2350] dark:text-white">{(activeData.metrics.f1 * 100).toFixed(2)}%</div>
                  <div className="text-sm font-medium text-[#4A2C76] mt-2">Harmonic mean of precision & recall</div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default InsightsSection;
