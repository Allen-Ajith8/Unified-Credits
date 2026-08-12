import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, ShieldAlert, Target } from 'lucide-react';
import { engineMetrics } from '../data/dashboardMetrics';

const InsightsSection = ({ activeMode }) => {
  const activeData = engineMetrics[activeMode];
  
  // Create combined ROC data for rendering
  const rocData = engineMetrics.a.rocCurve.map((point, index) => {
    return {
      fpr: point.fpr,
      modelA: point.tpr,
      modelB: engineMetrics.b.rocCurve[index]?.tpr || 0,
    };
  });

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
                  {(activeMode === 'a' || activeMode === 'c') && (
                    <Line type="monotone" dataKey="modelA" name={`Legacy (${engineMetrics.a.metrics.rocAuc})`} stroke={activeMode === 'a' ? engineMetrics.a.accentColor : "#86868B"} strokeWidth={2} dot={false} />
                  )}
                  {(activeMode === 'b' || activeMode === 'c') && (
                    <Line type="monotone" dataKey="modelB" name={`Hybrid (${engineMetrics.b.metrics.rocAuc})`} stroke={engineMetrics.b.accentColor} strokeWidth={2} dot={false} />
                  )}
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
            {activeMode === 'c' ? (
              <>
                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#006A67] mb-4"><TrendingUp size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">ROC-AUC Lift</div>
                  <div className="text-2xl font-bold text-[#0F2350]">{engineMetrics.a.metrics.rocAuc} → {engineMetrics.b.metrics.rocAuc}</div>
                  <div className="text-sm font-medium text-[#006A67] mt-2">+{(activeData.metrics.rocAucLift * 100).toFixed(2)}% Improvement</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#006A67] mb-4"><Target size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Recall Lift</div>
                  <div className="text-2xl font-bold text-[#0F2350]">{(engineMetrics.a.metrics.recall * 100).toFixed(2)}% → {(engineMetrics.b.metrics.recall * 100).toFixed(2)}%</div>
                  <div className="text-sm font-medium text-[#006A67] mt-2">+{(activeData.metrics.recallLift * 100).toFixed(2)}% Improvement</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#D4AF37] mb-4"><Users size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">False Negatives Caught</div>
                  <div className="text-2xl font-bold text-[#0F2350]">{activeData.metrics.falseNegativesCaught}</div>
                  <div className="text-sm font-medium text-[#D4AF37] mt-2">Risky applicants correctly flagged</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#4A2C76] mb-4"><ShieldAlert size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Contagion Effect</div>
                  <div className="text-2xl font-bold text-[#0F2350]">{activeData.clusterComparison[0].engineB}% <span className="text-sm font-normal text-[#6E6E73]">vs</span> {activeData.clusterComparison[1].engineB}%</div>
                  <div className="text-sm font-medium text-[#4A2C76] mt-2">Inside vs Outside Clusters</div>
                </div>
              </>
            ) : (
              <>
                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#006A67] mb-4"><TrendingUp size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Model Accuracy</div>
                  <div className="text-2xl font-bold text-[#0F2350]">{(activeData.metrics.accuracy * 100).toFixed(2)}%</div>
                  <div className="text-sm font-medium text-[#006A67] mt-2">Overall correctness</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#006A67] mb-4"><Target size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Precision Score</div>
                  <div className="text-2xl font-bold text-[#0F2350]">{(activeData.metrics.precision * 100).toFixed(2)}%</div>
                  <div className="text-sm font-medium text-[#006A67] mt-2">True positives / Total predicted positive</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#D4AF37] mb-4"><Users size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">Strongest Predictor</div>
                  <div className="text-xl font-bold text-[#0F2350] break-words">{activeData.featureWeights[0].name}</div>
                  <div className="text-sm font-medium text-[#D4AF37] mt-2">Weight: {activeData.featureWeights[0].weight}</div>
                </div>

                <div className="glass-subtle rounded-3xl p-6 flex flex-col justify-center">
                  <div className="text-[#4A2C76] mb-4"><ShieldAlert size={28} /></div>
                  <div className="text-sm text-[#6E6E73] mb-1">F1 Score</div>
                  <div className="text-2xl font-bold text-[#0F2350]">{(activeData.metrics.f1 * 100).toFixed(2)}%</div>
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
