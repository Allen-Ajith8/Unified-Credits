import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Activity, AlertTriangle, ShieldCheck, Zap, Upload, CheckCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const DashboardCard = ({ liveData, onGraphUpdate }) => {
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

  return (
    <div className="relative z-20 max-w-6xl mx-auto px-6 -mt-48 mb-24" id="dashboard">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass rounded-3xl p-8 shadow-2xl"
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-5 border-b border-black/5">
          <div>
            <h2 className="text-2xl font-semibold text-[#0F2350] tracking-tight flex items-center gap-3">
              <Activity className="w-6 h-6 text-[#0F2350]" />
              Real-Time Credit Engine Monitor
            </h2>
            <p className="text-sm text-[#86868B] mt-1">Live metrics from the inference engine</p>
          </div>
          <div className="text-sm text-[#86868B] font-mono mt-2 md:mt-0">
            {new Date().toLocaleTimeString()}
          </div>
        </div>

        {/* Metric Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Zap, label: 'Total Processed', value: liveData.total_processed?.toLocaleString() || '0', badge: 'Live', badgeColor: 'bg-[#006A67]/15 text-[#006A67]' },
            { icon: Activity, label: 'Default Rate', value: `${liveData.running_default_rate?.toFixed(2) || '0.00'}%`, badge: 'Running Avg', badgeColor: 'bg-[#4A2C76]/15 text-[#4A2C76]' },
            { icon: ShieldCheck, label: 'ROC-AUC Score', value: liveData.running_roc_auc?.toFixed(4) || '0.0000', badge: 'Model B', badgeColor: 'bg-[#0F2350]/15 text-[#0F2350]' },
            { icon: AlertTriangle, label: 'Fraud Alerts', value: liveData.fraud_alerts || '0', badge: 'Review', badgeColor: 'bg-[#D4AF37]/15 text-[#D4AF37]' },
          ].map((tile, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="h-56 bg-black/[0.03] rounded-2xl p-4 border border-black/5">
            <h3 className="text-sm font-medium text-[#6E6E73] mb-3">Running Default Rate (Last 30 ticks)</h3>
            <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={liveData.history}>
                <defs>
                  <linearGradient id="gradDefault" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F2350" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0F2350" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#86868B" fontSize={11} domain={['auto', 'auto']} tickFormatter={t => `${t?.toFixed(1)}%`} />
                <Tooltip contentStyle={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', color: '#0F2350' }} formatter={v => [v?.toFixed(2) + '%', 'Default Rate']} />
                <Area type="monotone" dataKey="default_rate" stroke="#0F2350" strokeWidth={2} fillOpacity={1} fill="url(#gradDefault)" isAnimationActive={false} />
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
                <Bar dataKey="rate" fill="#4A2C76" radius={[6, 6, 0, 0]} barSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

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
              <p className="font-medium">Dataset processed successfully!</p>
              <p className="text-sm text-[#86868B] mt-1">
                {uploadResult.total_nodes} nodes · {uploadResult.total_edges} edges · {uploadResult.total_clusters} clusters · Avg Score: {uploadResult.avg_credit_score}
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
