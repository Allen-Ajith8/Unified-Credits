import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingScreen from './components/LoadingScreen';
import NetworkBackground from './components/NetworkBackground';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import DashboardCard from './components/DashboardCard';
import MethodologySection from './components/MethodologySection';
import InsightsSection from './components/InsightsSection';
import Footer from './components/Footer';

function App() {
  const [bgReady, setBgReady] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  const [liveData, setLiveData] = useState({
    total_processed: 0,
    running_default_rate: 0,
    running_roc_auc: 0,
    fraud_alerts: 0,
    history: [],
  });
  const [isConnected, setIsConnected] = useState(false);

  const [activeMode, setActiveMode] = useState("a");
  const [apiData, setApiData] = useState({});

  // Fetch real engine metrics from API when mode changes
  useEffect(() => {
    fetch(`http://localhost:8000/api/engine/${activeMode}/metrics`)
      .then(r => r.json())
      .then(data => {
        setApiData(prev => ({ ...prev, [activeMode]: data }));
      })
      .catch(() => {});
  }, [activeMode]);

  // Fetch initial graph for background
  useEffect(() => {
    fetch('http://localhost:8000/api/graph')
      .then(r => r.json())
      .then(data => {
        setGraphData(data);
        // Give Three.js a moment to render, then mark ready
        setTimeout(() => setBgReady(true), 2000);
      })
      .catch(() => {
        // If backend isn't up, still allow entry after timeout
        setTimeout(() => setBgReady(true), 4000);
      });
  }, []);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/live-metrics');
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLiveData(prev => {
        const newHistory = [...prev.history, {
          time: new Date().toLocaleTimeString(),
          default_rate: data.running_default_rate,
        }].slice(-30);
        return { ...data, history: newHistory };
      });
    };
    return () => ws.close();
  }, []);

  // When bg is ready OR user skips, reveal the content
  useEffect(() => {
    if (bgReady || skipped) {
      setShowContent(true);
    }
  }, [bgReady, skipped]);

  const handleSkip = useCallback(() => {
    setSkipped(true);
  }, []);

  const handleGraphUpdate = useCallback((data) => {
    setGraphData(data);
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* 3D Background — always renders, loads in background */}
      <NetworkBackground graphData={graphData} />

      {/* Loading Screen — hides when content should show */}
      {!showContent && (
        <LoadingScreen ready={bgReady} onSkip={handleSkip} />
      )}

      {/* Main Content — fades in */}
      <div
        className={`relative z-10 transition-opacity duration-1000 ${
          showContent ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <Navbar isConnected={isConnected} />
        <HeroSection />
        <DashboardCard liveData={liveData} onGraphUpdate={handleGraphUpdate} activeMode={activeMode} setActiveMode={setActiveMode} apiData={apiData} />
        <MethodologySection activeMode={activeMode} apiData={apiData} />
        <InsightsSection activeMode={activeMode} apiData={apiData} />
        <Footer />
      </div>
    </div>
  );
}

export default App;
