import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Activity, AlertTriangle, ShieldCheck, Zap, Upload, CheckCircle, TrendingUp, TrendingDown, Target, MinusCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ModelToggle from './ModelToggle';
import { engineMetrics } from '../data/dashboardMetrics';

const DashboardCard = ({ liveData, onGraphUpdate, activeMode, setActiveMode, apiData }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', acceptedFiles[0]);
    try {
      const res = await fetch('http://localhost:8000/api/upload', { method: 'POST', body: formData });
      const result = await res.json();
      setUploadResult(result);
      // Fetch updated graph
      const graphRes = await fetch('http://localhost:8000/api/graph');
      const graphData = await graphRes.json();
      if (onGraphUpdate) onGraphUpdate(graphData);
    } catch (e) {
      console.error(e);
    }
    setUploading(false);
  }, [onGraphUpdate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] } });

  const clusterData = [
    { name: 'Inside Cluster', rate: 45.29 },
    { name: 'Outside Cluster', rate: 23.70 }
  ];

  // Use real API data if available, fallback to placeholder
  const placeholderData = engineMetrics[activeMode];
  const realData = apiData?.[activeMode];
  const activeData = realData ? { ...placeholderData, ...realData, metrics: { ...placeholderData.metrics, ...realData.metrics } } : placeholderData;
  
  const getMetricTiles = () => {
    if (activeMode === 'c') {
      return [
        { icon: TrendingUp, label: 'ROC-AUC Lift', value: `+${(activeData.metrics.rocAucLift * 100).toFixed(2)}%`, badge: 'Performance', badgeColor: 'bg-[#D4AF37]/15 text-[#D4AF37]' },
        { icon: Target, label: 'Recall Lift', value: `+${(activeData.metrics.recallLift * 100).toFixed(2)}%`, badge: 'Accuracy', badgeColor: 'bg-[#006A67]/15 text-[#006A67]' },
        { icon: CheckCircle, label: 'Reclassified Nodes', value: activeData.metrics.reclassifiedNodes, badge: 'Nodes', badgeColor: 'bg-[#4A2C76]/15 text-[#4A2C76]' },
        { icon: MinusCircle, label: 'False Positives Reduced', value: activeData.metrics.falsePositivesReduced, badge: 'Efficiency', badgeColor: 'bg-[#0F2350]/15 text-[#0F2350]' },
      ];
    } else {
      return [
        { icon: Zap, label: 'Total Processed', value: liveData.total_processed?.toLocaleString() || activeData.metrics.totalProcessed.toLocaleString(), badge: 'Live', badgeColor: 'bg-[#006A67]/15 text-[#006A67]' },
        { icon: Activity, label: 'Default Rate', value: `${liveData.running_default_rate?.toFixed(2) || activeData.metrics.defaultRate.toFixed(2)}%`, badge: 'Running Avg', badgeColor: 'bg-[#4A2C76]/15 text-[#4A2C76]' },
        { icon: ShieldCheck, label: 'ROC-AUC Score', value: liveData.running_roc_auc?.toFixed(4) || activeData.metrics.rocAuc.toFixed(4), badge: activeMode === 'a' ? 'Legacy Model' : 'Hybrid Model', badgeColor: 'bg-[#0F2350]/15 text-[#0F2350]' },
        { icon: AlertTriangle, label: 'Fraud Alerts', value: liveData.fraud_alerts || '0', badge: 'Review', badgeColor: 'bg-[#D4AF37]/15 text-[#D4AF37]' },
      ];
    }
  };

  return (
    <div className="relative z-20 max-w-6xl mx-auto px-6 -mt-48 mb-24" id="dashboard">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass rounded-3xl p-8 shadow-2xl"
      >
        <ModelToggle activeMode={activeMode} setActiveMode={setActiveMode} />

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-5 border-b border-black/5">
          <div>
            <h2 className="text-2xl font-semibold text-[#0F2350] tracking-tight flex items-center gap-3">
              <Activity className="w-6 h-6 text-[#0F2350]" />
              {activeMode === 'c' ? 'Engine Comparison View' : 'Real-Time Credit Engine Monitor'}
            </h2>
            <p className="text-sm text-[#86868B] mt-1">{activeMode === 'c' ? 'Head-to-head performance deltas' : 'Live metrics from the inference engine'}</p>
          </div>
          <div className="text-sm text-[#86868B] font-mono mt-2 md:mt-0">
            {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Metric Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {getMetricTiles().map((tile, i) => (
            <motion.div
              key={`${activeMode}-${i}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-black/[0.03] rounded-2xl p-5 border border-black/5"
            >
              <div className="text-[#86868B] text-sm mb-2 flex items-center gap-2">
                <tile.icon className="w-4 h-4" />{tile.label}
              </div>
              <div className="text-3xl font-semibold text-[#0F2350] tracking-tight">{tile.value}</div>
              <div className={`mt-2 text-xs font-medium inline-block px-2.5 py-1 rounded-full ${tile.badgeColor}`}>{tile.badge}</div>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        {activeMode === 'c' ? (
          <div className="grid grid-cols-1 mb-8">
             <div className="h-64 bg-black/[0.03] rounded-2xl p-4 border border-black/5">
              <h3 className="text-sm font-medium text-[#6E6E73] mb-3">Cluster Default Rates: Legacy vs Hybrid</h3>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={activeData.clusterComparison} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#86868B" fontSize={11} />
                  <YAxis stroke="#86868B" fontSize={11} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: '#0F2350' }} />
                  <Bar dataKey="engineA" name="Legacy Engine" fill="#0F2350" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="engineB" name="Hybrid Engine" fill="#4A2C76" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="h-56 bg-black/[0.03] rounded-2xl p-4 border border-black/5">
              <h3 className="text-sm font-medium text-[#6E6E73] mb-3">Running Default Rate (Last 30 ticks)</h3>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={liveData.history}>
                  <defs>
                    <linearGradient id={`gradDefault-${activeMode}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={activeData.accentColor} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={activeData.accentColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#86868B" fontSize={11} domain={['auto', 'auto']} tickFormatter={t => `${t?.toFixed(1)}%`} />
                  <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: '#0F2350' }} formatter={v => [v?.toFixed(2) + '%', 'Default Rate']} />
                  <Area type="monotone" dataKey="default_rate" stroke={activeData.accentColor} strokeWidth={2} fillOpacity={1} fill={`url(#gradDefault-${activeMode})`} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56 bg-black/[0.03] rounded-2xl p-4 border border-black/5">
              <h3 className="text-sm font-medium text-[#6E6E73] mb-3">Cluster Default Rates (%)</h3>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={clusterData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#86868B" fontSize={11} />
                  <YAxis stroke="#86868B" fontSize={11} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: '#0F2350' }} />
                  <Bar dataKey="rate" fill={activeData.accentColor} radius={[6, 6, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
            isDragActive ? 'border-[#0F2350] bg-[#0F2350]/5' : uploading ? 'border-[#D4AF37]/50 bg-[#D4AF37]/5' : uploadResult ? 'border-[#006A67]/50 bg-[#006A67]/5' : 'border-black/10 hover:border-[#0F2350]/50 hover:bg-[#0F2350]/5'
          }`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <div className="text-[#D4AF37]">
              <div className="animate-spin w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full mx-auto mb-3" />
              <p className="font-medium">Processing dataset...</p>
              <p className="text-sm text-[#86868B] mt-1">Building multi-view graph & computing scores</p>
            </div>
          ) : uploadResult ? (
            <div className="text-[#006A67]">
              <CheckCircle className="w-8 h-8 mx-auto mb-3" />
              <p className="font-medium">Dataset processed — All 3 Engines updated!</p>
              <p className="text-sm text-[#86868B] mt-1">
                {uploadResult.total_nodes} nodes · Engine A: {uploadResult.engines?.a?.rocAuc?.toFixed(4)} · Engine B: {uploadResult.engines?.b?.rocAuc?.toFixed(4)} · Lift: {uploadResult.engines?.c?.rocAucLift > 0 ? '+' : ''}{(uploadResult.engines?.c?.rocAucLift * 100)?.toFixed(2)}%
              </p>
              <p className="text-xs text-[#86868B] mt-2">Drop another CSV to re-process</p>
            </div>
          ) : (
            <div className="text-[#86868B]">
              <Upload className="w-8 h-8 mx-auto mb-3 text-[#6E6E73]" />
              <p className="font-medium text-[#0F2350]">Upload Dataset (CSV)</p>
              <p className="text-sm mt-1">Drag & drop your credit dataset to run the inference engine</p>
              <p className="text-xs mt-2">Supports 5,000+ node datasets · Builds graph in real-time</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardCard;
